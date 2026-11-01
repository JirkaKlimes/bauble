import { gsap } from 'gsap';
import * as THREE from 'three';
import { S } from './ctx';
import { clamp, isMobile, lerp, reduced, V3 } from './util';

export const rig = { pos: V3(0, 6, 20), target: V3(0, 4, 0), offX: 0, offY: 0 };
export const cam = { mode: 'free' as 'free' | 'home', azimuth: 0, azVel: 0 };
export const pointer = { nx: 0, ny: 0, x: 0, y: 0, inside: false };
const par = { x: 0, y: 0 };

export type View = { pos: THREE.Vector3; target: THREE.Vector3; offX: number; offY: number };
const EXT = { xmas: { y0: 0.2, y1: 8.9, x: 3.4 }, bday: { y0: 0.2, y1: 8.75, x: 4.2 }, quiet: { y0: 1.5, y1: 9.1, x: 4.3 } };
export const SHEET_MED = 0.6;
/** How far a focused ornament moves out of its spot towards the camera. */
export const FWD = 1.7;

/** Frames the whole formation, leaving room for the hero text and top bar. */
export function homeView(az = cam.azimuth): View {
  const { W, H, WT, ui, camera } = S;
  const a = W / H, tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), portrait = a < 0.9;
  const mix = (k: 'y0' | 'y1' | 'x') => lerp(lerp(EXT.xmas[k], EXT.bday[k], WT.bday), EXT.quiet[k], WT.quiet);
  const ext = { y0: mix('y0'), y1: mix('y1'), x: mix('x') };
  if (portrait) {
    const top = ui.top + 8, bot = Math.min(H - 40, ui.heroTop - 6), region = Math.max(H * 0.35, bot - top);
    const y0 = ext.y0 + 0.75;
    const needH = (ext.y1 - y0) * H / region;
    const dist = Math.max(needH / 2 / tanH, ext.x * 1.12 / (tanH * a));
    const target = V3(0, (ext.y1 + y0) / 2, 0);
    const pos = V3(Math.sin(az) * dist, target.y + 0.9 + dist * 0.035, Math.cos(az) * dist);
    const pxPer = H / (2 * dist * tanH), needVisH = (ext.y1 - y0) * pxPer;
    const cy = top + region / 2 + Math.max(0, region - needVisH) * 0.1;
    return { pos, target, offX: 0, offY: H / 2 - cy };
  }
  const needH = (ext.y1 - ext.y0) + 1.6;
  const dist = Math.max(needH / 2 / tanH, ext.x * 1.15 / (tanH * a));
  const target = V3(0, (ext.y0 + ext.y1) / 2 - 0.1, 0);
  const pos = V3(Math.sin(az) * dist, target.y + 0.9 + dist * 0.035, Math.cos(az) * dist);
  return { pos, target, offX: -W * (0.085 * WT.xmas + 0.1 * WT.bday + 0.13 * WT.quiet), offY: 0 };
}

/** Close-up of one ornament, offset so the panel does not cover it. */
export function focusView(base: THREE.Vector3, fwd: THREE.Vector3, modeS: number): View {
  const { W, H, camera } = S;
  const p = base.clone().addScaledVector(fwd, FWD).add(V3(0, 0.12, 0));
  const out = V3(p.x, 0, p.z); if (out.lengthSq() < 0.01) out.set(0, 0, 1); out.normalize();
  const dir = fwd.clone().multiplyScalar(0.75).add(out.multiplyScalar(0.25)).normalize();
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), objH = 2.2 * modeS;
  let dist: number, offX = 0, offY = 0;
  if (isMobile()) {
    const region = Math.max(0.2, 1 - SHEET_MED);
    dist = (objH / (0.8 * region)) / (2 * tanH);
    offY = (0.5 - region / 2) * H + 6;
  } else { dist = (objH / 0.46) / (2 * tanH); offX = (Math.min(470, W - 32) + 16) / 2; }
  const target = p.clone().add(V3(0, 0.3 * modeS, 0));
  const pos = target.clone().addScaledVector(dir, dist).add(V3(0, 0.45, 0));
  return { pos, target, offX, offY };
}

export function flyTo(v: View, dur = 1.5, ease = 'power3.inOut', onDone?: () => void) {
  cam.mode = 'free';
  gsap.killTweensOf([rig.pos, rig.target, rig]);
  if (reduced) dur = 0.01;
  gsap.to(rig.pos, { x: v.pos.x, y: v.pos.y, z: v.pos.z, duration: dur, ease });
  gsap.to(rig.target, { x: v.target.x, y: v.target.y, z: v.target.z, duration: dur, ease });
  gsap.to(rig, { offX: v.offX, offY: v.offY, duration: dur, ease, onComplete: onDone });
}

export const goHome = (dur = 1.4) => flyTo(homeView(), dur, 'power3.inOut', () => { cam.mode = 'home'; });

export function jumpTo(v: View) {
  gsap.killTweensOf([rig.pos, rig.target, rig]);
  rig.pos.copy(v.pos); rig.target.copy(v.target); rig.offX = v.offX; rig.offY = v.offY;
}

export function applyCamera(dt: number, dragging: boolean) {
  const { camera, W, H } = S;
  if (!dragging && cam.mode === 'home') {
    cam.azimuth += cam.azVel * dt; cam.azVel *= Math.exp(-3.2 * dt);
    if (Math.abs(cam.azimuth) > 0.7) { cam.azimuth = clamp(cam.azimuth, -0.7, 0.7); cam.azVel = 0; }
  }
  if (cam.mode === 'home') {
    const hv = homeView(), k = 1 - Math.exp(-dt * 3.2);
    rig.pos.lerp(hv.pos, k); rig.target.lerp(hv.target, k); rig.offX = lerp(rig.offX, hv.offX, k); rig.offY = lerp(rig.offY, hv.offY, k);
  }
  const k = Math.min(1, dt * 2.5);
  const tx = pointer.inside && !reduced ? pointer.nx : 0, ty = pointer.inside && !reduced ? pointer.ny : 0;
  par.x += (tx - par.x) * k; par.y += (ty - par.y) * k;
  const amt = S.interaction === 'focus' ? 0.12 : 0.5;
  camera.position.set(rig.pos.x + par.x * amt, rig.pos.y + par.y * amt * 0.45, rig.pos.z);
  camera.lookAt(rig.target);
  if (Math.abs(rig.offX) > 0.5 || Math.abs(rig.offY) > 0.5) camera.setViewOffset(W, H, rig.offX, rig.offY, W, H);
  else if (camera.view?.enabled) camera.clearViewOffset();
  camera.updateMatrixWorld();
}
