import { gsap } from 'gsap';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Mode } from '../domain/occasions';
import { PAL, S, type ColKey } from './ctx';
import { H_TREE, L_SOLID, L_TOP, MOON, Y0 } from './layout';
import { radialTex, V3 } from './util';

// Clearcoat highlights can exceed the half-float range of the render target and become Inf.
THREE.ShaderChunk.opaque_fragment = 'outgoingLight = min( outgoingLight, vec3( 48.0 ) );\n' + THREE.ShaderChunk.opaque_fragment;

class LayerPass extends Pass {
  constructor(private scene: THREE.Scene, private camera: THREE.Camera, private layer: number) { super(); this.needsSwap = false; }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const mask = this.camera.layers.mask, ac = renderer.autoClear;
    this.camera.layers.set(this.layer); renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = ac; this.camera.layers.mask = mask;
  }
}

export type Core = {
  composer: EffectComposer;
  finalPass: ShaderPass;
  stars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  ground: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  halo: THREE.Sprite;
  treeLight: THREE.PointLight;
  rimLight: THREE.DirectionalLight;
  hits: Record<Mode, THREE.Mesh>;
};

function buildEnvironment(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene(); env.background = new THREE.Color(0x03050c);
  const add = (geo: THREE.BufferGeometry, c: number, k: number, pos: THREE.Vector3) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.copy(pos); m.lookAt(0, 0, 0); env.add(m);
  };
  add(new THREE.PlaneGeometry(7, 4), 0xffc07a, 5, V3(-7, 5, 6));
  add(new THREE.PlaneGeometry(5, 3), 0xffe8c4, 3, V3(6, 7, 7));
  add(new THREE.PlaneGeometry(10, 2.5), 0x5c7cff, 1.8, V3(5, 2, -8));
  add(new THREE.PlaneGeometry(16, 16), 0x111a44, 1, V3(0, -7, 0));
  const dot = new THREE.SphereGeometry(0.17, 8, 6);
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, y = Math.random() * 9 - 2, r = 8 + Math.random() * 2;
    add(dot, i % 6 === 0 ? 0xff5a6a : 0xffc56e, 9, V3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  const pm = new THREE.PMREMGenerator(renderer); const tex = pm.fromScene(env, 0.02).texture; pm.dispose(); return tex;
}

export function initCore(): Core {
  const { renderer, scene, camera, COLS, U, W, H, DPR } = S;
  U.scale.value = 60 * DPR;
  renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene.environment = buildEnvironment(renderer);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: COLS.top }, uMid: { value: COLS.mid }, uHor: { value: COLS.hor }, uGlow: { value: COLS.glow }, uFade: U.fade },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop, uMid, uHor, uGlow; uniform float uFade; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = mix(uHor, uMid, smoothstep(-0.08, 0.24, h)); c = mix(c, uTop, smoothstep(0.2, 0.85, h));
        float g = exp(-pow(atan(vDir.x, -vDir.z) * 1.2, 2.0)) * (1.0 - smoothstep(-0.1, 0.4, h));
        c += uGlow * g;
        gl_FragColor = vec4(c * (0.25 + 0.75 * uFade), 1.0); }`,
  }));
  sky.renderOrder = -3; scene.add(sky);

  const n = 1500, pos = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const th = Math.random() * Math.PI * 2, y = 0.06 + Math.pow(Math.random(), 0.75) * 0.94, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 150, y * 150, Math.sin(th) * r * 150], i * 3);
    size[i] = Math.random() < 0.05 ? 2.6 + Math.random() * 1.6 : 0.7 + Math.random() * 1.2; ph[i] = Math.random() * 100;
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sgeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  sgeo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const stars = new THREE.Points(sgeo, new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uFade: U.fade, uDpr: { value: DPR }, uBoost: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute float aPhase; uniform float uTime, uDpr; varying float vTw;
      void main(){ vTw = 0.55 + 0.45 * sin(uTime * (0.5 + fract(aPhase) * 2.0) + aPhase);
        gl_PointSize = aSize * uDpr * 1.6; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uFade, uBoost; varying float vTw;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = 1.0 - smoothstep(0.0, 0.5, d); a *= a;
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * a * vTw * uFade * 1.4 * uBoost, 1.0); }`,
  }));
  stars.renderOrder = -2; stars.frustumCulled = false; scene.add(stars);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(26, 96), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: U.time, uFade: U.fade, uLo: { value: COLS.gLo }, uHi: { value: COLS.gHi }, uPool: { value: COLS.pool }, uPath: { value: 0 }, uMoonX: { value: MOON.c.x } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uFade, uPath, uMoonX; uniform vec3 uLo, uHi, uPool; varying vec2 vP;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        float r = length(vP); float fade = 1.0 - smoothstep(3.0, 22.0, r);
        vec3 base = mix(uLo, uHi, fade);
        base += uPool * exp(-r * r / 6.0) * 0.32 * (1.0 - uPath * 0.6);
        vec2 g = vP * 7.0; vec2 cell = floor(g); vec2 f = fract(g) - 0.5;
        float hh = h(cell); vec2 o = vec2(h(cell + 3.1), h(cell + 7.7)) - 0.5;
        float s = 1.0 - smoothstep(0.0, 0.09, length(f - o * 0.7));
        float tw = step(0.9, hh) * pow(0.5 + 0.5 * sin(uTime * (1.5 + hh * 5.0) + hh * 60.0), 3.0);
        base += vec3(1.0, 0.95, 0.85) * s * tw * 2.4 * fade * (1.0 - uPath * 0.5);
        float path = exp(-pow(vP.x - uMoonX * 0.9, 2.0) * 0.55) * smoothstep(-6.0, 6.0, vP.y) * fade;
        float rip = 0.5 + 0.5 * sin(vP.y * 7.0 + uTime * 1.1 + sin(vP.x * 2.3 + vP.y * 0.7) * 2.6 + h(floor(vP * vec2(3.0, 1.5))) * 5.0);
        float brk = smoothstep(0.35, 0.75, h(floor(vP * vec2(5.0, 2.0)) + 1.7));
        base += vec3(0.62, 0.74, 1.0) * path * (0.07 + 0.2 * pow(rip, 8.0) * brk + s * step(0.7, hh) * 1.4) * uPath;
        gl_FragColor = vec4(base * uFade, fade);
      }`,
  }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTex([[0, 'rgba(255,255,255,.55)'], [0.35, 'rgba(255,255,255,.16)'], [1, 'rgba(255,255,255,0)']]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: COLS.halo,
  }));
  halo.scale.set(13, 13, 1); halo.position.set(0, 3.8, -1.5); scene.add(halo);

  const treeLight = new THREE.PointLight(COLS.light, 26, 16, 1.6); treeLight.position.set(0, 3.2, 0.4); scene.add(treeLight);
  const fill = new THREE.DirectionalLight(0xffe2bd, 0.9); fill.position.set(3, 7, 12); scene.add(fill);
  const rimLight = new THREE.DirectionalLight(COLS.rim, 1.4); rimLight.position.set(-6, 8, -9); scene.add(rimLight);
  const hemi = new THREE.HemisphereLight(0x2a3a7a, 0x0b0f20, 0.5); scene.add(hemi);
  [treeLight, fill, rimLight, hemi].forEach(l => l.layers.enableAll());

  const rt = new THREE.WebGLRenderTarget(W * DPR, H * DPR, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(DPR); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.7, 0.42, 0.9));
  composer.addPass(new LayerPass(scene, camera, L_SOLID));
  composer.addPass(new LayerPass(scene, camera, L_TOP));
  composer.addPass(new OutputPass());
  const finalPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.035 }, uVig: { value: 0.55 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uAmount, uVig; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); float n = h(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5;
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114)); c.rgb += n * uAmount * (1.0 - smoothstep(0.06, 0.45, l)); vec2 q = vUv - 0.5; c.rgb *= 1.0 - dot(q, q) * uVig; gl_FragColor = c; }`,
  });
  composer.addPass(finalPass);

  const inv = new THREE.MeshBasicMaterial({ visible: false });
  const hits: Record<Mode, THREE.Mesh> = {
    xmas: new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), inv),
    bday: new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 4.4, 16), inv),
    quiet: new THREE.Mesh(new THREE.SphereGeometry(MOON.R, 12, 8), inv),
  };
  hits.xmas.position.set(0, Y0 + H_TREE + 0.3, 0);
  hits.bday.position.set(0, 2.2, 0);
  hits.quiet.position.copy(MOON.c);
  Object.values(hits).forEach(m => { scene.add(m); m.updateMatrixWorld(); });

  return { composer, finalPass, stars, ground, halo, treeLight, rimLight, hits };
}

export function tweenPalette(mode: Mode, dur: number) {
  const P = PAL[mode];
  for (const k of Object.keys(S.COLS) as ColKey[]) {
    const t = new THREE.Color(P[k]);
    if (dur <= 0) S.COLS[k].copy(t);
    else gsap.to(S.COLS[k], { r: t.r, g: t.g, b: t.b, duration: dur, ease: 'power2.inOut' });
  }
}
