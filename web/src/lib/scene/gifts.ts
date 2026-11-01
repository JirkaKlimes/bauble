import { gsap } from 'gsap';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { WishId } from '../domain/types';
import { bell } from '../sound';
import { S } from './ctx';
import { L_SOLID } from './layout';
import { burst3D } from './particles';
import { radialTex, reduced } from './util';

type GiftMode = 'xmas' | 'bday';
type Slot = { x: number; z: number; w: number; h: number; d: number; r: number };
const SLOTS: Record<GiftMode, Slot[]> = {
  xmas: [
    { x: -0.9, z: 1.95, w: 0.78, h: 0.6, d: 0.7, r: 0.2 }, { x: 0.8, z: 2.2, w: 0.62, h: 0.5, d: 0.62, r: -0.35 },
    { x: -2.15, z: 1.25, w: 0.66, h: 0.78, d: 0.6, r: 0.5 }, { x: 2.0, z: 1.3, w: 0.84, h: 0.46, d: 0.7, r: 0.1 },
    { x: 0.05, z: 2.85, w: 0.5, h: 0.42, d: 0.5, r: 0.7 }, { x: -1.5, z: 2.8, w: 0.5, h: 0.5, d: 0.5, r: -0.2 },
    { x: 1.5, z: 2.9, w: 0.58, h: 0.36, d: 0.58, r: 0.4 }, { x: -2.8, z: 0.2, w: 0.6, h: 0.6, d: 0.6, r: 0.1 },
    { x: 2.75, z: 0.15, w: 0.62, h: 0.7, d: 0.52, r: -0.3 }, { x: -0.3, z: 1.1, w: 0.58, h: 0.9, d: 0.58, r: 0.25 },
    { x: 1.0, z: 0.95, w: 0.5, h: 0.5, d: 0.5, r: 0.6 }, { x: -1.25, z: 0.45, w: 0.7, h: 0.55, d: 0.6, r: -0.4 },
  ],
  bday: [1.05, -1.25, 1.4, -1.6, 1.75, -1.95, 0.75, -0.95, 2.1, -2.25].map((a, i) => {
    const r = 3.1 + (i % 3) * 0.3, s = [0.62, 0.5, 0.72, 0.46, 0.58, 0.66, 0.42, 0.54, 0.5, 0.6][i];
    return { x: Math.sin(a) * r, z: Math.cos(a) * r, w: s * 1.15, h: s * (0.8 + (i % 2) * 0.3), d: s, r: a * 0.7 };
  }),
};

type Pal = { paper: THREE.Material; ribbon: THREE.Material };
let PAL: Record<GiftMode, Pal[]> | null = null;
let shadowTex: THREE.Texture;

function palette() {
  if (PAL) return PAL;
  const paper = (c: number) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.48, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.35, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) });
  const goldR = new THREE.MeshStandardMaterial({ color: 0xe8b55a, metalness: 0.9, roughness: 0.3 });
  const redR = new THREE.MeshPhysicalMaterial({ color: 0xb0122e, roughness: 0.35, metalness: 0.2, clearcoat: 0.6 });
  const whiteR = new THREE.MeshPhysicalMaterial({ color: 0xfff4f8, roughness: 0.4, clearcoat: 0.5 });
  PAL = {
    xmas: [{ paper: paper(0x9c1530), ribbon: goldR }, { paper: paper(0x1c3a8a), ribbon: goldR }, { paper: paper(0x0f5a40), ribbon: goldR }, { paper: paper(0xefe6d2), ribbon: redR },
      { paper: new THREE.MeshStandardMaterial({ color: 0xd8a845, metalness: 0.85, roughness: 0.3 }), ribbon: redR }],
    bday: [{ paper: paper(0xff7aa6), ribbon: whiteR }, { paper: paper(0x2fb9b4), ribbon: goldR }, { paper: paper(0x8e6bff), ribbon: whiteR }, { paper: paper(0xffc94d), ribbon: redR },
      { paper: paper(0xfff1f5), ribbon: new THREE.MeshPhysicalMaterial({ color: 0xff5b8e, roughness: 0.35, clearcoat: 0.6 }) }],
  };
  shadowTex = radialTex([[0, 'rgba(0,0,0,.7)'], [0.6, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']], 128);
  return PAL;
}

type Gift = { group: THREE.Group; inner: THREE.Group; shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; h: number; slot: number; mode: GiftMode };
const gifts = new Map<WishId, Gift>();
const pending: WishId[] = [];

function makeGift(mode: GiftMode, si: number): Omit<Gift, 'slot' | 'mode'> {
  const pals = palette()[mode], s = SLOTS[mode][si % SLOTS[mode].length], pal = pals[si % pals.length];
  const group = new THREE.Group(), inner = new THREE.Group();
  inner.add(new THREE.Mesh(new RoundedBoxGeometry(s.w, s.h, s.d, 3, 0.035), pal.paper));
  inner.add(new THREE.Mesh(new THREE.BoxGeometry(s.w + 0.014, s.h + 0.014, 0.075), pal.ribbon));
  inner.add(new THREE.Mesh(new THREE.BoxGeometry(0.075, s.h + 0.014, s.d + 0.014), pal.ribbon));
  const loop = new THREE.TorusGeometry(0.075, 0.022, 8, 22);
  const l1 = new THREE.Mesh(loop, pal.ribbon); l1.scale.set(1, 0.62, 1); l1.rotation.set(0, 0.35, 0.65); l1.position.set(-0.065, s.h / 2 + 0.05, 0);
  const l2 = new THREE.Mesh(loop, pal.ribbon); l2.scale.set(1, 0.62, 1); l2.rotation.set(0, -0.35, -0.65); l2.position.set(0.065, s.h / 2 + 0.05, 0);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), pal.ribbon); knot.position.y = s.h / 2 + 0.03;
  inner.add(l1, l2, knot); inner.position.y = s.h / 2;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(s.w * 2, s.d * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006;
  group.add(shadow, inner); group.position.set(s.x, 0, s.z); group.rotation.y = s.r;
  inner.traverse(x => x.layers.set(L_SOLID));
  return { group, inner, shadow, h: s.h };
}

function freeSlot(mode: GiftMode) {
  const used = new Set([...gifts.values()].filter(g => g.mode === mode).map(g => g.slot));
  for (let i = 0; i < 64; i++) if (!used.has(i)) return i;
  return 0;
}

type How = 'instant' | 'pending' | number;
function addGift(wid: WishId, mode: GiftMode, how: How) {
  if (gifts.has(wid)) return;
  const slot = freeSlot(mode), g: Gift = { ...makeGift(mode, slot), slot, mode };
  S.scene.add(g.group);
  gifts.set(wid, g);
  if (how === 'instant') return;
  g.group.visible = false;
  if (how === 'pending') pending.push(wid); else drop(wid, how);
}

function drop(wid: WishId, delay: number) {
  const g = gifts.get(wid); if (!g) return;
  g.group.visible = true; g.group.scale.setScalar(1);
  if (reduced) return;
  gsap.fromTo(g.inner.position, { y: g.h / 2 + 6 }, { y: g.h / 2, duration: 1.15, ease: 'bounce.out', delay });
  gsap.fromTo(g.inner.rotation, { y: -1.4, z: 0.3 }, { y: 0, z: 0, duration: 1.1, ease: 'power2.out', delay });
  gsap.fromTo(g.shadow.material, { opacity: 0 }, { opacity: 0.8, duration: 0.9, delay: delay + 0.2 });
  gsap.delayedCall(delay + 0.42, () => { const p = new THREE.Vector3(); g.group.getWorldPosition(p); p.y = 0.1; burst3D(p, 40, 1.6); bell(1567.98, 0, 0.08); });
}

/** Gifts claimed while a panel was open fall once the scene is visible again. */
export function dropPending(delay = 0.9) { pending.splice(0).forEach((wid, i) => drop(wid, delay + i * 0.32)); }

function removeGift(wid: WishId, delay = 0) {
  const g = gifts.get(wid); if (!g) return;
  gifts.delete(wid);
  const i = pending.indexOf(wid); if (i >= 0) pending.splice(i, 1);
  gsap.to(g.group.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.45, ease: 'back.in(2)', delay, onComplete: () => { S.scene.remove(g.group); } });
}

export type GiftSync = { instant?: boolean; delay?: number; defer?: boolean };

export function syncGifts(mode: 'xmas' | 'bday' | 'quiet', want: ReadonlySet<WishId>, { instant = false, delay = 0, defer = false }: GiftSync = {}) {
  let k = 0, j = 0;
  for (const [wid, g] of [...gifts]) {
    if (want.has(wid) && g.mode === mode) continue;
    if (instant) { S.scene.remove(g.group); gifts.delete(wid); } else removeGift(wid, (k++) * 0.05);
  }
  if (mode === 'quiet') return;
  for (const wid of want) if (!gifts.has(wid)) addGift(wid, mode, instant ? 'instant' : defer ? 'pending' : delay + (j++) * 0.28);
}

export const giftGroups = () => [...gifts.values()].map(g => g.group);
