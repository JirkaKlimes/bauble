import { gsap } from 'gsap';
import * as THREE from 'three';
import type { Mode } from '../domain/occasions';
import { S } from './ctx';
import { CAKE, candlePos, coneR, H_TREE, MOON, TURNS, Y0 } from './layout';
import { C3, clamp, lerp, radialTex, raysTex, reduced, V3 } from './util';

const N = 6400;
type Built = { pos: Float32Array; col: Float32Array; size: Float32Array; kind: Float32Array; t: Float32Array };

/*
 * Particle kinds drive the shimmer in the shader: 0/1 garland, 2 body, 3 bulbs and beads,
 * 4 twinkles, 5 icing, 6 candle flames, 7 moon, 8 far stars.
 */
class Form {
  pos: number[] = []; col: number[] = []; size: number[] = []; kind: number[] = []; t: number[] = [];
  push(p: THREE.Vector3, c: THREE.Color, s: number, k: number, t: number) {
    this.pos.push(p.x, p.y, p.z); this.col.push(c.r, c.g, c.b); this.size.push(s); this.kind.push(k); this.t.push(t);
  }
}

function finishForm(a: Form, filler: (a: Form) => void): Built {
  while (a.size.length < N) filler(a);
  a.pos.length = a.col.length = N * 3; a.size.length = a.kind.length = a.t.length = N;
  // sorted bottom to top so the intro reveal sweeps upwards
  const idx = [...Array(N).keys()].map(i => [i, a.pos[i * 3 + 1] + Math.random() * 0.7]).sort((p, q) => p[1] - q[1]).map(p => p[0]);
  const out: Built = { pos: new Float32Array(N * 3), col: new Float32Array(N * 3), size: new Float32Array(N), kind: new Float32Array(N), t: new Float32Array(N) };
  idx.forEach((j, i) => {
    out.pos.set(a.pos.slice(j * 3, j * 3 + 3), i * 3); out.col.set(a.col.slice(j * 3, j * 3 + 3), i * 3);
    out.size[i] = a.size[j]; out.kind[i] = a.kind[j]; out.t[i] = a.t[j];
  });
  return out;
}

function treeForm() {
  const f = new Form();
  const gold = C3(1, 0.66, 0.28, 1.6), warm = C3(1, 0.86, 0.62, 1.3), needle = C3(0.08, 0.34, 0.25, 1.15);
  const bulbs = [C3(1, 0.6, 0.22, 2.6), C3(1, 0.22, 0.3, 2.2), C3(1, 0.92, 0.75, 2.8)];
  for (let g = 0; g < 2; g++) for (let i = 0; i < 1500; i++) {
    const t = i / 1499, a = t * TURNS * Math.PI * 2 + g * Math.PI, r = coneR(t) + (Math.random() - 0.5) * 0.09;
    const p = V3(Math.sin(a) * r, Y0 + t * H_TREE + (Math.random() - 0.5) * 0.07, Math.cos(a) * r);
    f.push(p, g ? warm : gold, 0.75 + Math.random() * 0.9, g, t);
    if (i % 32 === 16) f.push(p, bulbs[((i / 32) | 0) % 3], 3.0 + Math.random() * 1.3, 3, t);
  }
  for (let i = 0; i < 2900; i++) {
    const t = (1 - Math.sqrt(Math.random())) * 0.98, a = Math.random() * Math.PI * 2, r = coneR(t) * (0.3 + 0.7 * Math.sqrt(Math.random()));
    f.push(V3(Math.sin(a) * r, Y0 + t * H_TREE, Math.cos(a) * r), needle, 0.5 + Math.random() * 0.9, 2, t);
  }
  return finishForm(f, a => {
    const t = 1 - Math.sqrt(Math.random()), an = Math.random() * Math.PI * 2, r = coneR(t) * (0.92 + Math.random() * 0.14);
    a.push(V3(Math.sin(an) * r, Y0 + t * H_TREE, Math.cos(an) * r), C3(1, 0.86, 0.62, 1.8), 1.3 + Math.random(), 4, t);
  });
}
function cakeForm() {
  const f = new Form();
  const cream = C3(1, 0.84, 0.66, 1.2), creamTop = C3(1, 0.9, 0.78, 0.75), pearl = C3(1, 0.95, 0.86, 2.0), gold = C3(1, 0.7, 0.32, 1.9);
  const icing = C3(1, 0.32, 0.58, 1.55), flame = C3(1, 0.72, 0.32, 2.7), flameCore = C3(1, 0.95, 0.75, 3.2);
  const spr = [C3(1, 0.3, 0.55, 1.8), C3(0.3, 0.95, 0.9, 1.6), C3(1, 0.85, 0.3, 1.8), C3(0.75, 0.55, 1, 1.7), C3(0.55, 1, 0.6, 1.6)];
  const TOP = 4.6, tt = (y: number) => clamp(y / TOP, 0, 1);
  for (let c = 0; c < CAKE.nC; c++) {
    const p = candlePos(c), y0 = CAKE.tiers[2].y1, y1 = CAKE.flameY - 0.16;
    for (let j = 0; j < 46; j++) {
      const y = y0 + (j / 46) * (y1 - y0), a = j * 0.9;
      const stripe = Math.sin(y * 18 + a * 0.2) > 0 ? C3(1, 0.96, 0.9, 1.1) : C3(1, 0.45, 0.65, 1.3);
      f.push(V3(p.x + Math.cos(a) * 0.035, y, p.z + Math.sin(a) * 0.035), stripe, 0.85, 2, tt(y));
    }
    for (let j = 0; j < 34; j++) {
      const u = Math.random(), r = 0.075 * Math.sin(Math.PI * Math.pow(u, 0.7)) * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      const y = CAKE.flameY - 0.1 + u * 0.3;
      f.push(V3(p.x + Math.cos(a) * r, y, p.z + Math.sin(a) * r), u < 0.45 ? flameCore : flame, 1.2 + (1 - u) * 1.3, 6, 1);
    }
  }
  for (let i = 0; i < 180; i++) { const a = i / 180 * Math.PI * 2; f.push(V3(Math.cos(a) * 2.85, 0.24, Math.sin(a) * 2.85), gold, 1.55, 3, 0); }
  for (let i = 0; i < 180; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 2.85;
    f.push(V3(Math.cos(a) * r, 0.22, Math.sin(a) * r), C3(1, 0.8, 0.6, 0.35), 0.8, 2, 0);
  }
  CAKE.tiers.forEach((T, ti) => {
    const h = T.y1 - T.y0, nWall = Math.round(750 * T.r * h / 3.0);
    for (let i = 0; i < nWall; i++) {
      const a = Math.random() * Math.PI * 2, y = T.y0 + 0.06 + Math.random() * (h - 0.16), r = T.r * (1 + (Math.random() - 0.5) * 0.02);
      f.push(V3(Math.cos(a) * r, y, Math.sin(a) * r), cream, 0.7 + Math.random() * 0.9, 2, tt(y));
    }
    const nTop = Math.round(110 * T.r);
    for (let i = 0; i < nTop; i++) { const a = i / nTop * Math.PI * 2; f.push(V3(Math.cos(a) * T.r * 1.01, T.y1, Math.sin(a) * T.r * 1.01), pearl, 1.9, 3, tt(T.y1)); }
    const nBot = Math.round(80 * T.r);
    for (let i = 0; i < nBot; i++) { const a = (i + 0.5) / nBot * Math.PI * 2; f.push(V3(Math.cos(a) * T.r * 1.02, T.y0 + 0.04, Math.sin(a) * T.r * 1.02), gold, 1.5, 3, tt(T.y0)); }
    const nDrip = Math.round(11 * T.r);
    for (let d = 0; d < nDrip; d++) {
      const a = (d + Math.random() * 0.4) / nDrip * Math.PI * 2, L = 0.18 + Math.random() * (ti === 0 ? 0.55 : 0.4), k = Math.round(L * 40);
      for (let j = 0; j < k; j++) { const y = T.y1 - (j / k) * L; f.push(V3(Math.cos(a) * T.r * 1.012, y, Math.sin(a) * T.r * 1.012), icing, 1.1, 5, tt(y)); }
      for (let j = 0; j < 5; j++) { const aa = a + (Math.random() - 0.5) * 0.03, y = T.y1 - L - Math.random() * 0.05; f.push(V3(Math.cos(aa) * T.r * 1.015, y, Math.sin(aa) * T.r * 1.015), icing, 1.7, 5, tt(y)); }
    }
    for (let i = 0; i < Math.round(120 * T.r); i++) { const a = Math.random() * Math.PI * 2; f.push(V3(Math.cos(a) * T.r * 1.01, T.y1 - Math.random() * 0.06, Math.sin(a) * T.r * 1.01), icing, 1.15, 5, tt(T.y1)); }
    const inner = ti < 2 ? CAKE.tiers[ti + 1].r : 0;
    for (let i = 0; i < Math.round(70 * T.r); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(lerp(inner * inner, T.r * T.r, Math.random()));
      f.push(V3(Math.cos(a) * r, T.y1 + 0.01, Math.sin(a) * r), creamTop, 0.7, 2, tt(T.y1));
    }
    for (let i = 0; i < Math.round(60 * T.r); i++) {
      const a = Math.random() * Math.PI * 2, y = T.y0 + 0.12 + Math.random() * (h - 0.3);
      f.push(V3(Math.cos(a) * T.r * 1.02, y, Math.sin(a) * T.r * 1.02), spr[i % 5], 1.3, 4, tt(y));
    }
  });
  return finishForm(f, a => {
    const an = Math.random() * Math.PI * 2, r = 3.0 + Math.random() * 1.4, y = 0.4 + Math.random() * 5.2;
    a.push(V3(Math.cos(an) * r, y, Math.sin(an) * r * 0.8 - 0.3), Math.random() < 0.5 ? C3(1, 0.75, 0.85, 1.6) : C3(1, 0.86, 0.6, 1.6), 0.9 + Math.random() * 1.2, 4, tt(y));
  });
}
function moonForm() {
  const f = new Form();
  const { c, R } = MOON;
  const cut = { x: 0.95 * R, y: 0.36 * R, r: 0.93 * R };
  const inside = (u: number, v: number) => (u - cut.x) ** 2 + (v - cut.y) ** 2 < cut.r * cut.r;
  const moonCol = C3(1, 0.94, 0.8, 1.2), rimCol = C3(1, 0.97, 0.88, 1.9);
  let k = 0;
  while (k < 3100) {
    const u = (Math.random() * 2 - 1) * R, v = (Math.random() * 2 - 1) * R;
    if (u * u + v * v > R * R || inside(u, v)) continue;
    const bulge = Math.sqrt(Math.max(0, R * R - u * u - v * v)) * 0.35;
    const edge = Math.max(Math.sqrt(u * u + v * v) / R, 1 - (Math.sqrt((u - cut.x) ** 2 + (v - cut.y) ** 2) - cut.r) / (0.35 * R));
    f.push(V3(c.x + u, c.y + v, c.z + bulge), moonCol.clone().multiplyScalar(0.75 + 0.45 * edge), 0.65 + Math.random() * 0.75, 7, (u + R) / (2 * R)); k++;
  }
  k = 0;
  while (k < 700) {
    const a = Math.random() * Math.PI * 2, r = R * (0.975 + Math.random() * 0.03), u = Math.cos(a) * r, v = Math.sin(a) * r;
    if (inside(u, v)) continue;
    f.push(V3(c.x + u, c.y + v, c.z + 0.05), rimCol, 1.15, 7, (u + R) / (2 * R)); k++;
  }
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * Math.PI * 2, r = R * (1.12 + Math.pow(Math.random(), 1.8) * 0.9);
    f.push(V3(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.z - 0.2), C3(0.6, 0.72, 1, 0.32), 0.9 + Math.random(), 2, Math.random());
  }
  return finishForm(f, a => {
    const big = Math.random() < 0.08;
    a.push(V3((Math.random() - 0.5) * 30, 3.5 + Math.random() * 10, -6 - Math.random() * 7), big ? C3(1, 0.95, 0.85, 1.25) : C3(0.82, 0.88, 1, 0.6 + Math.random() * 0.6), big ? 1.6 + Math.random() : 0.6 + Math.random() * 1.0, 8, Math.random());
  });
}


let FORMS: Record<Mode, Built>;
let points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

function attr(name: string) { return points.geometry.getAttribute(name) as THREE.BufferAttribute; }

export function buildMorph() {
  FORMS = { xmas: treeForm(), bday: cakeForm(), quiet: moonForm() };
  const F = FORMS.xmas, geo = new THREE.BufferGeometry();
  const rnd = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { rnd[i] = Math.random(); ph[i] = Math.random(); }
  const set = (k: string, a: Float32Array, n: number) => geo.setAttribute(k, new THREE.BufferAttribute(a, n));
  set('position', F.pos.slice(), 3); set('aFrom', F.pos.slice(), 3);
  set('cFrom', F.col.slice(), 3); set('cTo', F.col.slice(), 3);
  set('sFrom', F.size.slice(), 1); set('sTo', F.size.slice(), 1);
  set('kFrom', F.kind.slice(), 1); set('kTo', F.kind.slice(), 1);
  set('tTo', F.t.slice(), 1); set('aRand', rnd, 1); set('aPhase', ph, 1);
  points = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: { uTime: S.U.time, uScale: S.U.scale, ...S.morphU }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 aFrom, cFrom, cTo; attribute float sFrom, sTo, kFrom, kTo, tTo, aRand, aPhase;
      uniform float uTime, uScale, uMorph, uReveal, uCandles, uSwirl;
      varying vec3 vColor; varying float vAlpha;
      float lum(float k, float t, float ph){
        if (k < 1.5) return 0.72 + 0.28 * sin(uTime * (1.0 + ph * 2.0) + ph * 40.0) + pow(0.5 + 0.5 * sin(t * 70.0 - uTime * 2.4 + k * 3.14159), 12.0) * 1.7;
        if (k < 2.5) return 0.85 + 0.15 * sin(uTime * 0.8 + ph * 30.0);
        if (k < 3.5) return 0.78 + 0.22 * sin(uTime * (1.4 + ph) + ph * 20.0);
        if (k < 4.5) return pow(0.5 + 0.5 * sin(uTime * (2.0 + ph * 3.0) + ph * 50.0), 6.0) * 2.4;
        if (k < 5.5) return 0.9 + 0.1 * sin(uTime * 1.2 + ph * 10.0);
        if (k < 6.5) return uCandles * (0.85 + 0.35 * sin(uTime * (14.0 + ph * 9.0) + ph * 30.0) * sin(uTime * (7.0 + ph * 5.0)));
        if (k < 7.5) return 0.93 + 0.07 * sin(uTime * 0.6 + ph * 12.0);
        return 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * (0.7 + ph * 1.6) + ph * 60.0), 3.0);
      }
      void main(){
        float d = aRand * 0.42;
        float m = clamp((uMorph - d) / 0.58, 0.0, 1.0);
        float e = m < 0.5 ? 4.0 * m * m * m : 1.0 - pow(-2.0 * m + 2.0, 3.0) * 0.5;
        vec3 p = mix(aFrom, position, e);
        float arc = sin(e * 3.14159265);
        float ang = aRand * 6.2831853 + e * 2.6;
        p += vec3(cos(ang), 0.5 + aPhase, sin(ang)) * arc * (0.9 + aRand * 1.8) * uSwirl;
        if (kTo > 5.5 && kTo < 6.5) {
          p.y += sin(uTime * 11.0 + aPhase * 20.0) * 0.012 + (1.0 - uCandles) * 0.25 * aPhase;
          p.x += sin(uTime * 7.0 + aPhase * 9.0) * 0.01;
        }
        float b = mix(lum(kFrom, aRand, aPhase), lum(kTo, tTo, aPhase), e);
        vec3 c = mix(cFrom, cTo, e) * b + vec3(1.0, 0.82, 0.55) * arc * 0.55;
        float shown = smoothstep(tTo - 0.02, tTo + 0.004, uReveal);
        float front = (1.0 - smoothstep(0.0, 0.07, uReveal - tTo)) * shown * (1.0 - step(0.999, uReveal));
        vColor = c * (1.0 + front * 3.0); vAlpha = shown;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = mix(sFrom, sTo, e) * uScale * (1.0 + front * 1.6 + arc * 0.35) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying vec3 vColor; varying float vAlpha;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float halo = 1.0 - smoothstep(0.0, 0.5, d); float core = 1.0 - smoothstep(0.0, 0.2, d);
        gl_FragColor = vec4(vColor * (halo * halo * 0.6 + core * 1.3) * vAlpha, 1.0); }`,
  }));
  points.frustumCulled = false; S.scene.add(points);
}

/** Every particle flies from where it is now to its place in the next shape. */
export function morphTo(mode: Mode, dur = 2.8) {
  const F = FORMS[mode], m = S.morphU.uMorph.value;
  const P = attr('position').array as Float32Array, FR = attr('aFrom').array as Float32Array, R = attr('aRand').array as Float32Array;
  const PH = attr('aPhase').array as Float32Array, CF = attr('cFrom').array as Float32Array, CT = attr('cTo').array as Float32Array;
  const SF = attr('sFrom').array as Float32Array, ST = attr('sTo').array as Float32Array;
  const KF = attr('kFrom').array as Float32Array, KT = attr('kTo').array as Float32Array;
  if (m < 1) {
    // a morph is still running: start from the current in-between positions
    for (let i = 0; i < N; i++) {
      const mm = clamp((m - R[i] * 0.42) / 0.58, 0, 1), e = mm < 0.5 ? 4 * mm ** 3 : 1 - Math.pow(-2 * mm + 2, 3) / 2;
      const arc = Math.sin(e * Math.PI), ang = R[i] * Math.PI * 2 + e * 2.6, amp = arc * (0.9 + R[i] * 1.8) * S.morphU.uSwirl.value;
      for (let k = 0; k < 3; k++) FR[i * 3 + k] = lerp(FR[i * 3 + k], P[i * 3 + k], e) + (k === 0 ? Math.cos(ang) : k === 1 ? 0.5 + PH[i] : Math.sin(ang)) * amp;
      for (let k = 0; k < 3; k++) CF[i * 3 + k] = lerp(CF[i * 3 + k], CT[i * 3 + k], e);
      SF[i] = lerp(SF[i], ST[i], e);
      if (e > 0.5) KF[i] = KT[i];
    }
  } else { FR.set(P); CF.set(CT); SF.set(ST); KF.set(KT); }
  P.set(F.pos); CT.set(F.col); ST.set(F.size); KT.set(F.kind); (attr('tTo').array as Float32Array).set(F.t);
  Object.values(points.geometry.attributes).forEach(a => { a.needsUpdate = true; });
  S.morphU.uMorph.value = 0;
  gsap.killTweensOf(S.morphU.uMorph);
  gsap.to(S.morphU.uMorph, { value: 1, duration: reduced ? 0.01 : dur, ease: 'none' });
}

export function setFormInstant(mode: Mode) {
  const F = FORMS[mode];
  const put = (keys: string[], a: Float32Array) => keys.forEach(k => (attr(k).array as Float32Array).set(a));
  put(['position', 'aFrom'], F.pos); put(['cFrom', 'cTo'], F.col); put(['sFrom', 'sTo'], F.size); put(['kFrom', 'kTo'], F.kind); put(['tTo'], F.t);
  Object.values(points.geometry.attributes).forEach(a => { a.needsUpdate = true; });
  gsap.killTweensOf(S.morphU.uMorph); S.morphU.uMorph.value = 1;
}

export type Decor = {
  tube: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial>;
  topper: THREE.Group;
  star: THREE.Mesh;
  glow: THREE.Sprite;
  rays: THREE.Sprite;
  flames: THREE.Sprite[];
  moonGlow: THREE.Sprite;
};

class Helix extends THREE.Curve<THREE.Vector3> {
  constructor() { super(); }
  getPoint(u: number, target = new THREE.Vector3()) {
    const a = u * TURNS * Math.PI * 2, r = coneR(u) + 0.015;
    return target.set(Math.sin(a) * r, Y0 + u * H_TREE, Math.cos(a) * r);
  }
}

export function buildDecor(): Decor {
  const tg = new THREE.TubeGeometry(new Helix(), 1100, 0.013, 5, false);
  const tube = new THREE.Mesh(tg, new THREE.MeshBasicMaterial({ color: C3(1, 0.7, 0.32, 1.7), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  tg.setDrawRange(0, 0); S.scene.add(tube);

  const topper = new THREE.Group();
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.22 : 0.52, a = i / 10 * Math.PI * 2 + Math.PI / 2;
    if (i) shape.lineTo(Math.cos(a) * r, Math.sin(a) * r); else shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 4, curveSegments: 4 }); geo.center();
  const star = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffa53a, emissiveIntensity: 1.7, metalness: 0.5, roughness: 0.3 }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,224,160,1)'], [0.2, 'rgba(255,170,70,.4)'], [1, 'rgba(255,140,40,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.material.color.setScalar(0.85); glow.scale.setScalar(2.5);
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTex(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.4 }));
  rays.material.color.setScalar(0.75); rays.scale.setScalar(4.6);
  topper.add(rays, glow, star);
  topper.position.set(0, Y0 + H_TREE + 0.3, 0); S.scene.add(topper);

  const ftex = radialTex([[0, 'rgba(255,230,170,1)'], [0.25, 'rgba(255,170,80,.45)'], [1, 'rgba(255,120,40,0)']], 128);
  const flames = Array.from({ length: CAKE.nC }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.copy(candlePos(i)).add(V3(0, 0.05, 0)); s.scale.setScalar(0.85); S.scene.add(s);
    return s;
  });

  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(220,232,255,.55)'], [0.3, 'rgba(160,190,255,.16)'], [1, 'rgba(120,150,255,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  moonGlow.position.copy(MOON.c).add(V3(0, 0, -0.5)); moonGlow.scale.setScalar(MOON.R * 5.2); S.scene.add(moonGlow);

  return { tube, topper, star, glow, rays, flames, moonGlow };
}
