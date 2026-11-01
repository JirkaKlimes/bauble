import { gsap } from 'gsap';
import * as THREE from 'three';
import type { Status } from '../domain/occasions';
import type { MemberId } from '../domain/types';
import { homeView } from './camera';
import { S, type SceneMember } from './ctx';
import { BAUBLE_R, CAKE, CAP_THETA, L_SOLID, SLOTS, slotPos } from './layout';
import { burst3D } from './particles';
import { clamp, reduced, stripeTex, V3 } from './util';

export type HatName = 'santa' | 'party' | 'partyGold';
type HatRig = { g: THREE.Group; y: number; s0: THREE.Vector3; rz: number };

export type Bauble = {
  id: MemberId;
  faceMat: THREE.MeshPhysicalMaterial;
  root: THREE.Group; yaw: THREE.Group; wob: THREE.Group; hatBox: THREE.Group;
  hats: Record<HatName, HatRig>; hat: HatName | null;
  base: THREE.Vector3; fwd: THREE.Vector3; hits: THREE.Object3D[];
  fo: number; dimS: number; modeS: number; phase: number;
  wobA: number; wobV: number; hatA: number; hatV: number; sc: number; scV: number;
  pop: number; dropY: number; labelAlpha: number; hover: boolean;
  str: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
};

export const baubles = new Map<MemberId, Bauble>();

const solid = (o: THREE.Object3D) => o.traverse(x => x.layers.set(L_SOLID));

function fluff<G extends THREE.BufferGeometry>(geo: G, amt: number): G {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = Math.sin(x * 41 + y * 13) * Math.sin(y * 37 + z * 17) * Math.sin(z * 43 + x * 11), k = amt * (0.5 + 0.5 * f);
    p.setXYZ(i, x + n.getX(i) * k, y + n.getY(i) * k, z + n.getZ(i) * k);
  }
  geo.computeVertexNormals(); return geo;
}

const PARTY_COLS: [string, string][] = [['#ff6f9c', '#fff1f5'], ['#2fb9b4', '#effffd'], ['#8e6bff', '#f4f0ff'], ['#ff9d3c', '#fff6e6'], ['#4f9bff', '#eef6ff'], ['#ff6b55', '#fff1ec'], ['#3fbf7f', '#effff5']];

type Assets = {
  goldMat: THREE.MeshStandardMaterial; velvet: THREE.MeshPhysicalMaterial; fur: THREE.MeshPhysicalMaterial;
  sphereGeo: THREE.SphereGeometry; capGeo: THREE.SphereGeometry; rimGeo: THREE.TorusGeometry;
  hat: { cone: THREE.LatheGeometry; brim: THREE.TorusGeometry; pom: THREE.IcosahedronGeometry; tip: THREE.Vector3 };
  party: { cone: THREE.LatheGeometry; ruffle: THREE.TorusGeometry; pom: THREE.IcosahedronGeometry };
};
let A: Assets | null = null;

function assets(): Assets {
  if (A) return A;
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0ac4c, metalness: 1, roughness: 0.26 });
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0xb3122f, roughness: 0.72, sheen: 1, sheenRoughness: 0.42, sheenColor: new THREE.Color(0xff6b7d) });
  const fur = new THREE.MeshPhysicalMaterial({ color: 0xfbf8f2, roughness: 1, sheen: 1, sheenRoughness: 0.85, sheenColor: new THREE.Color(0xffffff), emissive: 0xffffff, emissiveIntensity: 0.07 });
  const sphereGeo = new THREE.SphereGeometry(BAUBLE_R, 64, 40);
  const capGeo = new THREE.SphereGeometry(BAUBLE_R * 1.004, 64, 24, 0, Math.PI * 2, 0, CAP_THETA); capGeo.rotateX(Math.PI / 2);
  const rc = BAUBLE_R * 1.004 * Math.sin(CAP_THETA);
  const cp = capGeo.attributes.position, uv = capGeo.attributes.uv;
  for (let i = 0; i < cp.count; i++) uv.setXY(i, cp.getX(i) / (2 * rc) + 0.5, cp.getY(i) / (2 * rc) + 0.5);
  uv.needsUpdate = true;
  const rimGeo = new THREE.TorusGeometry(rc, 0.03, 14, 120);
  const h = 0.94, pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 26; i++) { const t = i / 26; pts.push(new THREE.Vector2(0.285 * Math.pow(1 - t, 0.85) + 0.004, t * h)); }
  const cone = new THREE.LatheGeometry(pts, 44);
  const p = cone.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / h; p.setX(i, p.getX(i) + 0.64 * t * t * t); p.setY(i, y - 0.32 * Math.pow(t, 3.2)); }
  cone.computeVertexNormals();
  const pp: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; pp.push(new THREE.Vector2(0.235 * (1 - t) * (1 - 0.08 * Math.sin(t * Math.PI)) + 0.003, t * 0.74)); }
  A = {
    goldMat, velvet, fur, sphereGeo, capGeo, rimGeo,
    hat: { cone, brim: fluff(new THREE.TorusGeometry(0.29, 0.088, 18, 60).rotateX(Math.PI / 2), 0.022), pom: fluff(new THREE.IcosahedronGeometry(0.115, 5), 0.01), tip: V3(0.64, h - 0.32, 0) },
    party: { cone: new THREE.LatheGeometry(pp, 40), ruffle: fluff(new THREE.TorusGeometry(0.235, 0.04, 10, 48).rotateX(Math.PI / 2), 0.02), pom: fluff(new THREE.IcosahedronGeometry(0.075, 4), 0.02) },
  };
  return A;
}

function makeSanta(a: Assets) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(a.hat.cone, a.velvet); c.position.y = 0.04;
  const b = new THREE.Mesh(a.hat.brim, a.fur); b.position.y = 0.04;
  const pv = new THREE.Group(); pv.position.copy(a.hat.tip).add(V3(0, 0.04, 0));
  const pm = new THREE.Mesh(a.hat.pom, a.fur); pm.position.set(0.02, -0.07, 0); pv.add(pm);
  g.add(c, b, pv); return g;
}

function makeParty(a: Assets, i: number, gold: boolean) {
  const [ca, cb] = gold ? ['#e8b04c', '#fff0c8'] : PARTY_COLS[i % PARTY_COLS.length];
  const mat = gold ? new THREE.MeshStandardMaterial({ map: stripeTex(ca, cb, true), metalness: 0.75, roughness: 0.3 })
    : new THREE.MeshPhysicalMaterial({ map: stripeTex(ca, cb, false), roughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.3 });
  const g = new THREE.Group();
  const cone = new THREE.Mesh(a.party.cone, mat); cone.position.y = 0.02;
  const ruff = new THREE.Mesh(a.party.ruffle, new THREE.MeshPhysicalMaterial({ color: cb, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffffff) })); ruff.position.y = 0.03;
  const pom = new THREE.Mesh(a.party.pom, gold ? new THREE.MeshStandardMaterial({ color: 0xfff1b8, metalness: 0.6, roughness: 0.35, emissive: 0x332200 })
    : new THREE.MeshPhysicalMaterial({ color: ca, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffffff) }));
  pom.position.y = 0.8;
  g.add(cone, ruff, pom); return g;
}

function makeCap(a: Assets) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.14, 0.15, 32), a.goldMat); body.position.y = 0.06; g.add(body);
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.13 - k * 0.008, 0.011, 8, 36), a.goldMat);
    r.rotation.x = Math.PI / 2; r.position.y = 0.01 + k * 0.05; g.add(r);
  }
  return g;
}

export const hatFor = (st: Status, id: MemberId): HatName | null =>
  st.mode === 'xmas' ? 'santa' : st.mode === 'bday' ? (st.occ.who === id ? 'partyGold' : 'party') : null;

export function fwdFor(p: THREE.Vector3) { return homeView(0).pos.clone().sub(p).setY(0).normalize(); }

export function orbTargets(st: Status) {
  const out = new Map<MemberId, { pos: THREE.Vector3; scale: number }>(), ms = S.members;
  if (st.mode === 'xmas') ms.forEach(m => out.set(m.id, { pos: slotPos(SLOTS[m.slot % SLOTS.length]), scale: 1 }));
  else if (st.mode === 'bday') {
    const cel = st.occ.who, others = ms.filter(m => m.id !== cel);
    const ring: [number, number, number][] = [[-2.75, 5.0, 1.2], [2.8, 5.2, 1.0], [-1.95, 7.0, 0.0], [2.05, 7.2, -0.1], [-3.7, 6.5, -0.5], [3.8, 6.7, -0.6], [0, 8.2, -1.2], [-2.8, 8.1, -1.3]];
    out.set(cel, { pos: V3(0, 6.45, 0.75), scale: 1.3 });
    others.forEach((m, i) => out.set(m.id, { pos: V3(...ring[i % ring.length]), scale: 1 }));
  } else {
    const n = ms.length;
    ms.forEach((m, i) => {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      out.set(m.id, { pos: V3(u * 3.5, (i % 2 ? 3.6 : 2.55) + Math.cos(u * 1.3) * 0.3, 1.5 - Math.abs(u) * 0.8), scale: 1 });
    });
  }
  return out;
}

export function setHat(b: Bauble, name: HatName | null, { instant = false, delay = 0 } = {}) {
  if (b.hat === name) return;
  const old = b.hat ? b.hats[b.hat] : null, nw = name ? b.hats[name] : null;
  b.hat = name;
  if (instant || reduced) {
    Object.values(b.hats).forEach(h => {
      h.g.visible = h === nw; gsap.killTweensOf([h.g.position, h.g.scale, h.g.rotation]);
      h.g.position.y = h.y; h.g.scale.copy(h.s0); h.g.rotation.z = h.rz;
    });
    return;
  }
  if (old) {
    const dir = Math.random() < 0.5 ? -1 : 1, g = old.g;
    gsap.killTweensOf([g.position, g.scale, g.rotation]);
    gsap.to(g.position, { y: old.y + 0.9, x: dir * 0.35, duration: 0.5, ease: 'power2.out', delay });
    gsap.to(g.rotation, { z: old.rz + dir * 1.6, duration: 0.5, ease: 'power2.out', delay });
    gsap.to(g.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.42, ease: 'back.in(2)', delay: delay + 0.08, onComplete: () => { g.visible = false; g.position.x = 0; } });
  }
  if (nw) {
    const d2 = delay + (old ? 1.5 : 0.1), g = nw.g;
    gsap.killTweensOf([g.position, g.scale, g.rotation]);
    gsap.set(g.position, { y: nw.y + 1.8, x: 0, delay: d2 }); gsap.set(g.scale, { x: 0.001, y: 0.001, z: 0.001, delay: d2 });
    gsap.set(g, { visible: true, delay: d2 }); gsap.set(g.rotation, { z: nw.rz * 2.2, delay: d2 });
    gsap.to(g.position, { y: nw.y, duration: 0.95, ease: 'bounce.out', delay: d2 });
    gsap.to(g.scale, { x: nw.s0.x, y: nw.s0.y, z: nw.s0.z, duration: 0.6, ease: 'back.out(2.2)', delay: d2 });
    gsap.to(g.rotation, { z: nw.rz, duration: 1.2, ease: 'elastic.out(1, 0.4)', delay: d2 + 0.3 });
    gsap.delayedCall(d2 + 0.62, () => { b.hatV += 7; b.wobV += 1.5; });
  }
}

export function addBauble(m: SceneMember, tex: THREE.Texture | null, st: Status, pop: boolean): Bauble {
  const a = assets();
  const root = new THREE.Group(), yaw = new THREE.Group(), wob = new THREE.Group(), hatBox = new THREE.Group();
  root.add(yaw); yaw.add(wob);
  const glass = new THREE.MeshPhysicalMaterial({ color: m.glass, metalness: 0.78, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.04,
    iridescence: 0.45, iridescenceIOR: 1.45, iridescenceThicknessRange: [180, 520], envMapIntensity: 1.5 });
  const sphere = new THREE.Mesh(a.sphereGeo, glass);
  const faceMat = new THREE.MeshPhysicalMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.5, roughness: 0.42, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.06, envMapIntensity: 0.32 });
  const face = new THREE.Mesh(a.capGeo, faceMat);
  const rim = new THREE.Mesh(a.rimGeo, a.goldMat); rim.position.z = BAUBLE_R * Math.cos(CAP_THETA);
  const cap = makeCap(a); cap.position.y = BAUBLE_R - 0.03;
  const rig = (g: THREE.Group, y: number, rz: number): HatRig => ({ g, y, s0: g.scale.clone(), rz });
  const santa = makeSanta(a); santa.rotation.z = m.tilt; if (m.tilt > 0) santa.scale.x = -1;
  const party = makeParty(a, m.slot, false); party.rotation.z = m.tilt * 0.5;
  const partyGold = makeParty(a, m.slot, true); partyGold.rotation.z = m.tilt * 0.5; partyGold.scale.setScalar(1.12);
  const hats: Record<HatName, HatRig> = { santa: rig(santa, BAUBLE_R + 0.05, m.tilt), party: rig(party, BAUBLE_R + 0.03, m.tilt * 0.5), partyGold: rig(partyGold, BAUBLE_R + 0.03, m.tilt * 0.5) };
  Object.values(hats).forEach(h => { h.g.position.y = h.y; h.g.visible = false; hatBox.add(h.g); });
  wob.add(sphere, face, rim, cap, hatBox);
  const str = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(22 * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0xffe6f0, transparent: true, opacity: 0, depthWrite: false }));
  str.frustumCulled = false; str.layers.enable(L_SOLID); S.scene.add(str);
  solid(root); S.scene.add(root);
  const hits: THREE.Object3D[] = [sphere, face];
  hatBox.traverse(o => { if (o instanceof THREE.Mesh) hits.push(o); });
  hits.forEach(o => { o.userData.member = m.id; });
  const tgt = orbTargets(st).get(m.id);
  const base = tgt ? tgt.pos.clone() : V3(0, 0, 0);
  const b: Bauble = {
    id: m.id, faceMat, root, yaw, wob, hatBox, hats, hat: null, base, fwd: fwdFor(base), hits,
    fo: 0, dimS: 1, modeS: tgt?.scale ?? 1, phase: Math.random() * 10, wobA: 0, wobV: 0, hatA: 0, hatV: 0, sc: 1, scV: 0,
    pop: pop ? 0 : 1, dropY: 0, labelAlpha: pop ? 0 : 1, hover: false, str,
  };
  baubles.set(m.id, b);
  setHat(b, hatFor(st, m.id), { instant: !pop, delay: 0.5 });
  if (pop) {
    gsap.to(b, { pop: 1, duration: 1.2, ease: 'elastic.out(1, 0.45)' });
    gsap.to(b, { labelAlpha: 1, duration: 0.6, delay: 0.6 });
    burst3D(b.base, 90, 2.4);
  }
  return b;
}

export function removeBauble(id: MemberId) {
  const b = baubles.get(id); if (!b) return;
  S.scene.remove(b.root); S.scene.remove(b.str);
  baubles.delete(id);
}

export function setFaceTexture(id: MemberId, tex: THREE.Texture) {
  const b = baubles.get(id); if (!b) return;
  b.faceMat.map?.dispose();
  b.faceMat.map = tex; b.faceMat.emissiveMap = tex; b.faceMat.needsUpdate = true;
}

export function moveOrbs(st: Status, instant = false) {
  const t = orbTargets(st);
  [...baubles.values()].forEach((b, i) => {
    const tg = t.get(b.id); if (!tg) return;
    gsap.killTweensOf(b.base); gsap.killTweensOf(b, 'modeS');
    if (instant || reduced) { b.base.copy(tg.pos); b.modeS = tg.scale; b.fwd = fwdFor(b.base); return; }
    const from = b.base.clone(), o = { p: 0 }, lift = 0.7 + Math.random() * 0.6;
    gsap.to(o, { p: 1, duration: 2.0, ease: 'power2.inOut', delay: 0.25 + i * 0.07,
      onUpdate: () => { b.base.lerpVectors(from, tg.pos, o.p); b.base.y += Math.sin(o.p * Math.PI) * lift; },
      onComplete: () => { b.fwd = fwdFor(b.base); } });
    gsap.to(b, { modeS: tg.scale, duration: 1.6, ease: 'power2.inOut', delay: 0.4 + i * 0.07 });
  });
}

export function setFocusPose(id: MemberId | null) {
  for (const b of baubles.values())
    gsap.to(b, { fo: b.id === id ? 1 : 0, dimS: id && b.id !== id ? 0.8 : 1, duration: reduced ? 0.01 : 1.3, ease: 'power3.inOut', overwrite: 'auto' });
}

export function updateBaubles(dt: number, t: number) {
  const { WT, camera } = S;
  const amp = 0.07 + 0.12 * WT.bday, sway = 0.035 + 0.05 * WT.bday;
  for (const b of baubles.values()) {
    const target = (b.hover ? 1.08 : 1) * (S.interaction === 'focus' && S.focus === b.id ? 1.04 : 1);
    const steps = Math.max(1, Math.ceil(dt / 0.012)), h = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.scV += (170 * (target - b.sc) - 15 * b.scV) * h; b.sc += b.scV * h;
      b.wobV += (-38 * b.wobA - 2.8 * b.wobV) * h; b.wobA += b.wobV * h;
      b.hatV += (-95 * (b.hatA + b.wobA * 1.5) - 6.5 * b.hatV) * h; b.hatA += b.hatV * h;
    }
    b.wobA = clamp(b.wobA, -0.9, 0.9); b.hatA = clamp(b.hatA, -1.2, 1.2); b.sc = clamp(b.sc, 0.6, 1.5);
    b.root.position.set(b.base.x + b.fwd.x * 1.7 * b.fo, b.base.y + Math.sin(t * 0.9 + b.phase) * amp + b.dropY + 0.12 * b.fo, b.base.z + b.fwd.z * 1.7 * b.fo);
    b.yaw.rotation.y = Math.atan2(camera.position.x - b.root.position.x, camera.position.z - b.root.position.z);
    b.wob.rotation.z = b.wobA + Math.sin(t * 0.7 + b.phase) * sway;
    b.wob.rotation.x = Math.sin(t * 0.5 + b.phase * 2) * 0.03;
    b.hatBox.rotation.z = b.hatA;
    b.root.scale.setScalar(Math.max(0.0001, b.sc * b.pop * b.dimS * b.modeS));
  }
}

/** Balloon strings from each ornament down to the cake. */
export function updateStrings(t: number) {
  const w = S.WT.bday;
  for (const b of baubles.values()) {
    const vis = w > 0.01 && b.pop > 0.2;
    b.str.visible = vis; if (!vis) continue;
    b.str.material.opacity = 0.5 * w * Math.min(1, b.pop);
    const top = b.root.position.clone(); top.y -= BAUBLE_R * b.root.scale.y * 0.98;
    const end = V3(top.x * 0.18, CAKE.tiers[2].y1 + 0.02, top.z * 0.18 + 0.25);
    if (Math.abs(top.x) < 0.3) end.set(top.x * 0.5, CAKE.flameY + 0.2, top.z * 0.6);
    const mid = top.clone().lerp(end, 0.5); mid.x += Math.sin(t * 0.9 + b.phase) * 0.25; mid.z += Math.cos(t * 0.7 + b.phase) * 0.15; mid.y -= 0.25;
    const P = b.str.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < 22; i++) {
      const s = i / 21, q = 1 - s;
      P[i * 3] = q * q * top.x + 2 * q * s * mid.x + s * s * end.x;
      P[i * 3 + 1] = q * q * top.y + 2 * q * s * mid.y + s * s * end.y;
      P[i * 3 + 2] = q * q * top.z + 2 * q * s * mid.z + s * s * end.z;
    }
    b.str.geometry.attributes.position.needsUpdate = true;
  }
}
