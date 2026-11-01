import * as THREE from 'three';
import type { Mode } from '../domain/occasions';
import { bellGliss } from '../sound';
import { curMode, S } from './ctx';
import { L_TOP } from './layout';
import { C3, isMobile, reduced, V3 } from './util';

type Fall = THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

function fallSystem(n: number, extra: ((geo: THREE.BufferGeometry, n: number) => void) | null, vs: string, fs: string, blending: THREE.Blending = THREE.AdditiveBlending): Fall {
  const pos = new Float32Array(n * 3), size = new Float32Array(n), sp = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos.set([(Math.random() - 0.5) * 34, Math.random() * 18, -12 + Math.random() * 30], i * 3);
    size[i] = 0.5 + Math.pow(Math.random(), 3) * 2.2; sp[i] = 0.35 + Math.random() * 0.55; ph[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(sp, 1)); geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  if (extra) extra(geo, n);
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uTime: S.U.time, uScale: S.U.scale, uFade: S.U.fade, uW: { value: 0 }, uSpeed: { value: reduced ? 0.35 : 1 } },
    transparent: true, depthWrite: false, blending, vertexShader: vs, fragmentShader: fs,
  }));
  pts.frustumCulled = false; pts.layers.set(L_TOP); S.scene.add(pts); return pts;
}

export type Falling = { snow: Fall; confetti: Fall; motes: Fall };

export function buildFalling(): Falling {
  const n = isMobile() ? 1000 : 1600;
  const snow = fallSystem(n, null, `attribute float aSize, aSpeed, aPhase; uniform float uTime, uScale, uSpeed; varying float vA, vSoft;
    void main(){ vec3 p = position; float t = uTime * uSpeed;
      p.y = mod(p.y - t * aSpeed, 18.0) - 1.5; p.x += sin(t * 0.6 * aSpeed + aPhase) * 0.7; p.z += cos(t * 0.45 * aSpeed + aPhase * 1.7) * 0.5;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
      vSoft = 1.0 - smoothstep(2.0, 9.0, d); vA = smoothstep(0.4, 2.5, d) * (1.0 - smoothstep(30.0, 48.0, d)) * smoothstep(-1.5, -0.6, p.y);
      gl_PointSize = aSize * uScale * 0.9 / d; gl_Position = projectionMatrix * mv; }`,
    `uniform float uFade, uW; varying float vA, vSoft;
    void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float e = mix(0.16, 0.48, vSoft);
      float a = (1.0 - smoothstep(0.5 - e, 0.5, d)) * mix(0.9, 0.3, vSoft);
      gl_FragColor = vec4(vec3(0.9, 0.94, 1.0) * a * vA * uFade * uW, 1.0); }`);
  const cpal = [[1, 0.36, 0.58], [0.36, 0.86, 0.85], [1, 0.82, 0.32], [0.72, 0.55, 1], [0.5, 0.92, 0.55], [1, 0.55, 0.35], [1, 0.95, 0.9]];
  const confetti = fallSystem(Math.round(n * 0.6), (geo, k) => {
    const c = new Float32Array(k * 3), spin = new Float32Array(k);
    for (let i = 0; i < k; i++) { c.set(cpal[i % cpal.length], i * 3); spin[i] = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 3); }
    geo.setAttribute('aCol', new THREE.BufferAttribute(c, 3)); geo.setAttribute('aSpin', new THREE.BufferAttribute(spin, 1));
  }, `attribute float aSize, aSpeed, aPhase, aSpin; attribute vec3 aCol; uniform float uTime, uScale, uSpeed; varying float vA, vAng, vFlip; varying vec3 vC;
    void main(){ vec3 p = position; float t = uTime * uSpeed;
      p.y = mod(p.y - t * aSpeed * 0.75, 18.0) - 1.5; p.x += sin(t * 0.9 * aSpeed + aPhase) * 1.1; p.z += cos(t * 0.7 * aSpeed + aPhase * 1.7) * 0.7;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
      vA = smoothstep(0.6, 3.0, d) * (1.0 - smoothstep(26.0, 44.0, d)) * smoothstep(-1.5, -0.6, p.y);
      vAng = t * aSpin + aPhase; vFlip = cos(t * aSpin * 1.3 + aPhase * 2.0); vC = aCol;
      gl_PointSize = (0.9 + aSize * 0.6) * uScale * 1.1 / d; gl_Position = projectionMatrix * mv; }`,
    `uniform float uFade, uW; varying float vA, vAng, vFlip; varying vec3 vC;
    void main(){ vec2 q = gl_PointCoord - 0.5; float c = cos(vAng), s = sin(vAng); q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
      float w = 0.44 * abs(vFlip) + 0.05, h = 0.2;
      float m = (1.0 - smoothstep(w - 0.04, w, abs(q.x))) * (1.0 - smoothstep(h - 0.04, h, abs(q.y)));
      if (m < 0.01) discard;
      gl_FragColor = vec4(vC * (0.45 + 0.55 * abs(vFlip)) * uFade, m * vA * uW); }`, THREE.NormalBlending);
  const motes = fallSystem(Math.round(n * 0.4), null, `attribute float aSize, aSpeed, aPhase; uniform float uTime, uScale, uSpeed; varying float vA, vB;
    void main(){ vec3 p = position; float t = uTime * uSpeed;
      p.y = mod(p.y + t * aSpeed * 0.18, 14.0) - 1.0; p.x += sin(t * 0.25 * aSpeed + aPhase) * 1.2; p.z += cos(t * 0.2 * aSpeed + aPhase * 1.7) * 0.9;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
      vA = smoothstep(0.6, 3.0, d) * (1.0 - smoothstep(26.0, 44.0, d)); vB = pow(0.5 + 0.5 * sin(t * (0.8 + aSpeed) + aPhase * 30.0), 4.0);
      gl_PointSize = (0.5 + aSize * 0.5) * uScale * 0.7 / d; gl_Position = projectionMatrix * mv; }`,
    `uniform float uFade, uW; varying float vA, vB;
    void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = 1.0 - smoothstep(0.0, 0.5, d); a *= a;
      gl_FragColor = vec4(vec3(0.75, 0.88, 1.0) * a * vA * vB * 1.8 * uFade * uW, 1.0); }`);
  return { snow, confetti, motes };
}

type Spark = { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; c: THREE.Color; g: number; drag: number };
const SPMAX = 900;
const sparks: Spark[] = [];
let spGeo: THREE.BufferGeometry;

export function buildSparks() {
  spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPMAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  spGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(SPMAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  spGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(SPMAX), 1).setUsage(THREE.DynamicDrawUsage));
  spGeo.setDrawRange(0, 0);
  const sparkPts = new THREE.Points(spGeo, new THREE.ShaderMaterial({
    uniforms: { uScale: S.U.scale }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSize; attribute vec3 aColor; uniform float uScale; varying vec3 vC;
      void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q);
        float st = max(0.0, 1.0 - abs(q.x) * 14.0) * max(0.0, 1.0 - abs(q.y) * 2.0) + max(0.0, 1.0 - abs(q.y) * 14.0) * max(0.0, 1.0 - abs(q.x) * 2.0);
        gl_FragColor = vec4(vC * ((1.0 - smoothstep(0.0, 0.5, d)) * 0.5 + st), 1.0); }`,
  }));
  sparkPts.frustumCulled = false; sparkPts.layers.enable(L_TOP); S.scene.add(sparkPts);
}

const SPARK_SETS: Record<Mode | 'smoke', THREE.Color[]> = {
  xmas: [C3(1, 0.75, 0.35), C3(1, 0.92, 0.75), C3(1, 0.35, 0.4)],
  bday: [C3(1, 0.45, 0.7), C3(0.4, 0.95, 0.9), C3(1, 0.88, 0.45), C3(0.8, 0.6, 1)],
  quiet: [C3(0.8, 0.88, 1), C3(1, 1, 1), C3(0.6, 0.75, 1)],
  smoke: [C3(0.35, 0.33, 0.38), C3(0.45, 0.42, 0.45)],
};
type BurstOpt = { v?: THREE.Vector3; life?: number; lifeVar?: number; size?: number; g?: number; drag?: number };

export function burst3D(at: THREE.Vector3, n = 60, spread = 2.0, set: Mode | 'smoke' = curMode(), opt: BurstOpt = {}) {
  if (!spGeo) return;
  const cols = SPARK_SETS[set];
  for (let i = 0; i < n; i++) {
    if (sparks.length >= SPMAX) sparks.shift();
    const v = opt.v ? opt.v.clone().add(V3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread))
      : V3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(spread * (0.35 + Math.random()));
    sparks.push({ p: at.clone(), v, life: 0, max: (opt.life || 0.7) + Math.random() * (opt.lifeVar ?? 1.0), size: (opt.size || 1.6) + Math.random() * 2.6,
      c: cols[(Math.random() * cols.length) | 0], g: opt.g ?? 1.1, drag: opt.drag ?? 1.8 });
  }
}

export function updateSparks(dt: number) {
  for (let k = sparks.length - 1; k >= 0; k--) { sparks[k].life += dt; if (sparks[k].life >= sparks[k].max) sparks.splice(k, 1); }
  const P = spGeo.attributes.position.array as Float32Array, C = spGeo.attributes.aColor.array as Float32Array, Sz = spGeo.attributes.aSize.array as Float32Array;
  sparks.forEach((s, i) => {
    s.v.y -= s.g * dt; s.v.multiplyScalar(Math.exp(-s.drag * dt)); s.p.addScaledVector(s.v, dt);
    const f = 1 - s.life / s.max;
    P[i * 3] = s.p.x; P[i * 3 + 1] = s.p.y; P[i * 3 + 2] = s.p.z;
    C[i * 3] = s.c.r * f * 2.4; C[i * 3 + 1] = s.c.g * f * 2.4; C[i * 3 + 2] = s.c.b * f * 2.4; Sz[i] = s.size * (0.5 + 0.5 * f);
  });
  spGeo.setDrawRange(0, sparks.length);
  spGeo.attributes.position.needsUpdate = spGeo.attributes.aColor.needsUpdate = spGeo.attributes.aSize.needsUpdate = true;
}

const shooters: { p: THREE.Vector3; v: THREE.Vector3; life: number; max: number }[] = [];

export function shootingStar(user: boolean) {
  const from = V3(-10 + Math.random() * 6, 10 + Math.random() * 2.5, -7 - Math.random() * 3);
  const v = V3(8.5 + Math.random() * 3, -3.2 - Math.random() * 1.5, 1.2);
  shooters.push({ p: from, v, life: 0, max: 1.15 });
  if (user) bellGliss();
}

export function updateShooters(dt: number) {
  for (let i = shooters.length - 1; i >= 0; i--) {
    const s = shooters[i]; s.life += dt; s.p.addScaledVector(s.v, dt);
    const f = 1 - s.life / s.max;
    for (let k = 0; k < 4; k++) {
      if (sparks.length >= SPMAX) sparks.shift();
      sparks.push({ p: s.p.clone().addScaledVector(s.v, -k * 0.012), v: V3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, 0), life: 0, max: 0.45 + Math.random() * 0.5,
        size: 1.2 + f * 2.4, c: SPARK_SETS.quiet[(Math.random() * 3) | 0], g: 0.15, drag: 2 });
    }
    if (s.life >= s.max) shooters.splice(i, 1);
  }
}
