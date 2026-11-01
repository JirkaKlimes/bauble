import { gsap } from 'gsap';
import * as THREE from 'three';
import type { Mode, Status } from '../domain/occasions';
import type { MemberId, WishId } from '../domain/types';
import { bell, modeSound, pluck, whoosh, jingle } from '../sound';
import { applyCamera, cam, flyTo, focusView, goHome, homeView, jumpTo, pointer, rig } from './camera';
import { initCore, tweenPalette, type Core } from './core';
import { S, type Interaction, type SceneMember } from './ctx';
import { buildDecor, buildMorph, morphTo, setFormInstant, type Decor } from './formations';
import { dropPending, giftGroups, syncGifts } from './gifts';
import { layoutLabels } from './labels';
import { BAUBLE_R, CAKE, CAP_THETA, candlePos } from './layout';
import { addBauble, baubles, hatFor, moveOrbs, orbTargets, removeBauble, setFaceTexture, setFocusPose, setHat, updateBaubles, updateStrings } from './ornaments';
import { buildFalling, buildSparks, burst3D, shootingStar, updateShooters, updateSparks, type Falling } from './particles';
import { clamp, reduced, V3 } from './util';

export type SceneEvents = {
  pick: (id: MemberId) => void;
  background: () => void;
  tap: (kind: Mode) => void;
};

export { registerLabel } from './labels';

/** The three.js night scene. One per page; `create` returns null without WebGL. */
export class Scene {
  private core: Core;
  private decor: Decor;
  private fall: Falling;
  private clock = new THREE.Clock();
  private ray = new THREE.Raycaster();
  private textures = new Map<MemberId, THREE.Texture>();
  private wantGifts: ReadonlySet<WishId> = new Set();
  private intro: gsap.core.Timeline | null = null;
  private needRay = false;
  private hovered: MemberId | null = null;
  private perf = { frames: 0, time: 0 };
  private nextShooter = 6;
  private down: { x: number; y: number; az: number } | null = null;
  private dragging = false;
  private lastAz = 0;
  private lastAzT = 0;

  static create(canvas: HTMLCanvasElement, on: SceneEvents): Scene | null {
    try {
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
      if (!renderer.getContext()) return null;
      S.renderer = renderer;
      return new Scene(canvas, on);
    } catch {
      return null;
    }
  }

  private constructor(private canvas: HTMLCanvasElement, private on: SceneEvents) {
    this.core = initCore();
    buildMorph();
    this.decor = buildDecor();
    this.fall = buildFalling();
    buildSparks();
    this.ray.layers.enableAll();
    this.bindPointer();
    addEventListener('resize', () => this.resize());
    requestAnimationFrame(this.frame);
  }

  setPaused(v: boolean) { S.paused = v; }
  setFast(v: boolean) { S.fast = v; gsap.ticker.lagSmoothing(v ? 0 : 500, 33); }

  setPortrait(id: MemberId, c: HTMLCanvasElement) {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, S.renderer.capabilities.getMaxAnisotropy());
    this.textures.set(id, tex);
    setFaceTexture(id, tex);
  }

  setMe(id: MemberId | null) { S.me = id; }

  /** Adds new ornaments, removes gone ones. `how` animates the new ones. */
  setMembers(ms: SceneMember[], how: 'instant' | 'drop' | 'pop' = 'drop', delay = 0, skip: MemberId | null = null) {
    S.members = ms;
    const st = S.status;
    for (const id of [...baubles.keys()]) if (!ms.some(m => m.id === id)) removeBauble(id);
    if (!st) return;
    let i = 0;
    for (const m of ms) {
      if (baubles.has(m.id) || m.id === skip) continue;
      const b = addBauble(m, this.textures.get(m.id) ?? null, st, how === 'pop');
      if (how !== 'drop') continue;
      b.dropY = 7; b.labelAlpha = 0;
      gsap.to(b, { dropY: 0, duration: 1.7, ease: 'elastic.out(1, 0.5)', delay: delay + i * 0.13 });
      gsap.to(b, { labelAlpha: 1, duration: 0.6, delay: delay + 0.9 + i * 0.1 });
      i++;
    }
    // other ornaments make room in the quiet row and around the cake
    if (st.mode !== 'xmas') moveOrbs(st);
  }

  setInteraction(mode: Interaction) {
    S.interaction = mode;
    if (mode !== 'focus') S.focus = null;
  }

  setUi(ui: typeof S.ui) { S.ui = ui; }

  setGifts(want: ReadonlySet<WishId>, defer: boolean) {
    this.wantGifts = want;
    const st = S.status;
    if (st) syncGifts(st.mode, want, { defer });
  }

  applyStatus(st: Status, want: ReadonlySet<WishId>, instant = false) {
    const prev = S.status;
    S.status = st; this.wantGifts = want;
    if (!prev || prev.mode !== st.mode || instant) this.transition(st, instant || !prev);
    else if (prev.key !== st.key) {
      moveOrbs(st);
      baubles.forEach(b => setHat(b, hatFor(st, b.id), { delay: 0.1 }));
      syncGifts(st.mode, want, { delay: 1.2 });
    } else syncGifts(st.mode, want);
  }

  private transition(st: Status, instant: boolean) {
    const to = st.mode, WT = S.WT, morphU = S.morphU;
    const weights = { xmas: +(to === 'xmas'), bday: +(to === 'bday'), quiet: +(to === 'quiet') };
    if (instant || reduced) {
      Object.assign(WT, weights); tweenPalette(to, 0); setFormInstant(to); moveOrbs(st, true);
      baubles.forEach(b => setHat(b, hatFor(st, b.id), { instant: true }));
      syncGifts(to, this.wantGifts, { instant: true });
      return;
    }
    gsap.to(WT, { ...weights, duration: 2.4, ease: 'power2.inOut', delay: 0.15 });
    tweenPalette(to, 2.6);
    morphTo(to, 2.9);
    moveOrbs(st);
    [...baubles.values()].forEach((b, i) => setHat(b, hatFor(st, b.id), { delay: i * 0.06 }));
    syncGifts(to, this.wantGifts, { delay: 2.4 });
    if (to === 'bday') {
      morphU.uCandles.value = 0;
      gsap.to(morphU.uCandles, { value: 1, duration: 0.8, delay: 2.9, onStart: () => { for (let i = 0; i < CAKE.nC; i++) gsap.delayedCall(i * 0.09, () => burst3D(candlePos(i), 10, 0.9, 'xmas', { size: 1, life: 0.4 })); } });
      gsap.delayedCall(3.0, () => burst3D(V3(0, 4.6, 0.4), 140, 3.4, 'bday', { size: 1.4 }));
    }
    modeSound(to);
    if (to === 'quiet') this.nextShooter = 3.5;
  }

  focus(id: MemberId, quick: boolean) {
    const b = baubles.get(id);
    S.interaction = 'focus'; S.focus = id;
    this.setHover(null);
    setFocusPose(id);
    if (b) flyTo(focusView(b.base, b.fwd, b.modeS), quick ? 1.2 : 1.45, 'power3.inOut');
  }

  home(instant = false) {
    S.interaction = 'home'; S.focus = null;
    setFocusPose(null);
    if (instant) { jumpTo(homeView()); cam.mode = 'home'; return; }
    goHome(1.4);
    dropPending(1.0);
  }

  homeSoon(dur: number) { goHome(dur); }

  /** Where a member's ornament will sit on screen once the camera is home. */
  homeSpot(id: MemberId) {
    cam.mode = 'home'; applyCamera(1, false); S.camera.updateMatrixWorld();
    const st = S.status;
    const p = st ? orbTargets(st).get(id)?.pos : null;
    if (!p) return null;
    const proj = (v: THREE.Vector3) => { const t = v.clone().project(S.camera); return { x: (t.x * 0.5 + 0.5) * S.W, y: (-t.y * 0.5 + 0.5) * S.H }; };
    const a = proj(p), b = proj(p.clone().add(V3(0, BAUBLE_R, 0)));
    return { x: a.x, y: a.y, s: Math.max(30, Math.abs(a.y - b.y) * 2 * Math.sin(CAP_THETA)) };
  }

  get introRunning() { return !!this.intro; }
  skipIntro() { this.intro?.timeScale(6); }
  finishIntro() { this.intro?.progress(1, false); }

  /** The scene builds itself from darkness; `showHome` fires when the UI should fade in. */
  playIntro(showHome: () => void, done: () => void) {
    this.intro?.kill();
    S.interaction = 'intro';
    const hv = homeView(0); cam.azimuth = 0; cam.azVel = 0; cam.mode = 'free';
    rig.pos.set(0, hv.pos.y + 6, hv.pos.z + 13); rig.target.set(0, hv.target.y + 2.6, 0); rig.offX = hv.offX; rig.offY = hv.offY;
    const { morphU, tubeReveal, skyFade, topperS } = S;
    morphU.uReveal.value = 0; tubeReveal.v = 0; skyFade.v = 0; topperS.v = 0.0001;
    const mode = S.status?.mode ?? 'xmas';
    for (const b of baubles.values()) { b.dropY = mode === 'bday' ? -6 : mode === 'quiet' ? 2.5 : 7; b.labelAlpha = 0; }
    const gifts = giftGroups();
    gifts.forEach(g => g.scale.setScalar(0.0001));
    const candles = morphU.uCandles; candles.value = 0;
    if (reduced) {
      morphU.uReveal.value = 1; tubeReveal.v = 1; skyFade.v = 1; topperS.v = 1; candles.value = 1;
      for (const b of baubles.values()) { b.dropY = 0; b.labelAlpha = 1; }
      gifts.forEach(g => g.scale.setScalar(1));
      rig.pos.copy(hv.pos); rig.target.copy(hv.target); cam.mode = 'home';
      showHome(); done(); return;
    }
    const top = this.decor.topper;
    const tl = gsap.timeline({ onComplete: () => { this.intro = null; cam.mode = 'home'; done(); } });
    this.intro = tl;
    tl.to(skyFade, { v: 1, duration: 1.8, ease: 'power2.out' }, 0)
      .to(rig.pos, { x: hv.pos.x, y: hv.pos.y, z: hv.pos.z, duration: 4.8, ease: 'power3.inOut' }, 0)
      .to(rig.target, { x: hv.target.x, y: hv.target.y, z: hv.target.z, duration: 4.8, ease: 'power3.inOut' }, 0)
      .to(morphU.uReveal, { value: 1, duration: 2.7, ease: 'power1.inOut' }, 0.45)
      .to(tubeReveal, { v: 1, duration: 2.7, ease: 'power1.inOut' }, 0.45);
    if (mode === 'xmas') tl.to(topperS, { v: 1, duration: 1.1, ease: 'back.out(2.6)' }, 3.05).add(() => { burst3D(top.position, 110, 2.8, 'xmas'); bell(1046.5, 0, 0.18); bell(1568, 0.06, 0.1); }, 3.05);
    else topperS.v = 1;
    if (mode === 'bday') tl.to(candles, { value: 1, duration: 0.5 }, 3.0).add(() => {
      for (let i = 0; i < CAKE.nC; i++) gsap.delayedCall(i * 0.08, () => burst3D(candlePos(i), 10, 0.8, 'xmas', { size: 1, life: 0.4 }));
      burst3D(V3(0, 4.6, 0.4), 120, 3.2, 'bday', { size: 1.4 }); modeSound('bday');
    }, 3.0);
    else candles.value = 1;
    if (mode === 'quiet') tl.add(() => shootingStar(false), 3.2);
    [...baubles.values()].forEach((b, i) => {
      tl.to(b, { dropY: 0, duration: mode === 'bday' ? 2.0 : 1.7, ease: mode === 'bday' ? 'back.out(1.4)' : mode === 'quiet' ? 'power3.out' : 'elastic.out(1, 0.5)' }, 3.3 + i * 0.13);
      tl.to(b, { labelAlpha: 1, duration: 0.6 }, 4.2 + i * 0.1);
    });
    gifts.forEach((g, i) => tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(2.4)' }, 3.6 + i * 0.08));
    tl.add(showHome, 4.1);
  }

  nudge(id: MemberId) { const b = baubles.get(id); if (b) { b.wobV += 4.5; b.hatV += 6; } }

  private sceneTap(kind: Mode) {
    const morphU = S.morphU;
    if (kind === 'xmas') {
      burst3D(this.decor.topper.position, 90, 2.6, 'xmas'); bell(1568, 0, 0.14); bell(2093, 0.12, 0.12); bell(2637, 0.24, 0.1);
      gsap.fromTo(S.topperS, { v: 1.35 }, { v: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)' });
    } else if (kind === 'bday') {
      if (morphU.uCandles.value < 0.5) return;
      whoosh();
      gsap.to(morphU.uCandles, { value: 0, duration: 0.25, ease: 'power2.in' });
      for (let i = 0; i < CAKE.nC; i++) burst3D(candlePos(i).add(V3(0, 0.1, 0)), 12, 0.25, 'smoke', { v: V3(0, 0.9, 0), g: -0.2, drag: 0.8, life: 1.2, lifeVar: 0.8, size: 2.2 });
      gsap.delayedCall(0.35, () => { burst3D(V3(0, 4.4, 0.3), 160, 3.6, 'bday', { size: 1.4 }); jingle('bday'); });
      gsap.to(morphU.uCandles, { value: 1, duration: 0.6, delay: 4.2, onStart: () => {
        for (let i = 0; i < CAKE.nC; i++) gsap.delayedCall(i * 0.08, () => { burst3D(candlePos(i), 8, 0.7, 'xmas', { size: 1, life: 0.35 }); pluck(1046.5 + i * 60, 0, 0.05); });
      } });
    } else shootingStar(true);
    this.on.tap(kind);
  }

  private pick(e: PointerEvent): MemberId | null {
    pointer.x = (e.clientX / S.W) * 2 - 1; pointer.y = -(e.clientY / S.H) * 2 + 1;
    this.ray.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), S.camera);
    const hits = this.ray.intersectObjects([...baubles.values()].flatMap(b => b.hits), false);
    return (hits[0]?.object.userData.member as MemberId | undefined) ?? null;
  }

  private tapTarget(): Mode | null {
    const mode = S.status?.mode ?? 'xmas';
    return this.ray.intersectObject(this.core.hits[mode], false).length ? mode : null;
  }

  private bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      if (this.intro) { this.intro.timeScale(6); return; }
      this.down = { x: e.clientX, y: e.clientY, az: cam.azimuth }; this.dragging = false;
      c.setPointerCapture?.(e.pointerId); this.lastAz = cam.azimuth; this.lastAzT = performance.now();
    });
    c.addEventListener('pointermove', e => {
      pointer.inside = e.pointerType === 'mouse';
      pointer.x = (e.clientX / S.W) * 2 - 1; pointer.y = -(e.clientY / S.H) * 2 + 1; pointer.nx = pointer.x; pointer.ny = pointer.y;
      if (this.down) {
        const dx = e.clientX - this.down.x;
        if (!this.dragging && Math.abs(dx) > 8 && S.interaction === 'home') { this.dragging = true; c.style.cursor = 'grabbing'; }
        if (this.dragging) {
          cam.azimuth = clamp(this.down.az - dx * 0.0042, -0.7, 0.7);
          const now = performance.now();
          cam.azVel = (cam.azimuth - this.lastAz) / Math.max(0.008, (now - this.lastAzT) / 1000);
          this.lastAz = cam.azimuth; this.lastAzT = now;
        }
      }
      this.needRay = true;
    });
    c.addEventListener('pointerleave', () => { pointer.inside = false; this.needRay = true; });
    c.addEventListener('pointerup', e => {
      const wasDrag = this.dragging; this.down = null; this.dragging = false;
      if (wasDrag) { c.style.cursor = 'grab'; cam.azVel = clamp(cam.azVel, -2.5, 2.5); return; }
      cam.azVel = 0;
      if (S.interaction !== 'home' && S.interaction !== 'focus') return;
      const id = this.pick(e);
      if (id) {
        const b = baubles.get(id);
        if (b) { b.wobV += (e.clientX < S.W / 2 ? 1 : -1) * 4.5; b.hatV += 6; }
        if (S.interaction === 'home' || id !== S.focus) this.on.pick(id);
        else bell(2093, 0, 0.06);
        return;
      }
      if (S.interaction === 'focus') { this.on.background(); return; }
      const tg = this.tapTarget();
      if (tg) this.sceneTap(tg);
    });
  }

  setHover(id: MemberId | null) {
    if (this.hovered === id) return;
    const old = this.hovered ? baubles.get(this.hovered) : null;
    if (old) old.hover = false;
    this.hovered = id;
    const b = id ? baubles.get(id) : null;
    if (b) { b.hover = true; b.wobV += (Math.random() < 0.5 ? -1 : 1) * 1.6; }
    this.canvas.style.cursor = id ? 'pointer' : S.interaction === 'home' ? 'grab' : 'default';
  }

  private raycast() {
    this.needRay = false;
    if (!(S.interaction === 'home' || S.interaction === 'focus') || !pointer.inside) { this.setHover(null); return; }
    this.ray.setFromCamera(new THREE.Vector2(pointer.x, pointer.y), S.camera);
    const hits = this.ray.intersectObjects([...baubles.values()].flatMap(b => b.hits), false);
    const id = (hits[0]?.object.userData.member as MemberId | undefined) ?? null;
    this.setHover(id);
    if (!id && S.interaction === 'home') this.canvas.style.cursor = this.tapTarget() ? 'pointer' : 'grab';
  }

  resize() {
    S.W = innerWidth; S.H = innerHeight;
    const { camera, renderer, W, H, DPR } = S;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
    this.core.composer.setPixelRatio(DPR); this.core.composer.setSize(W, H);
    S.U.scale.value = 60 * DPR; this.core.stars.material.uniforms.uDpr.value = DPR;
    if (S.interaction === 'focus' && S.focus) {
      const b = baubles.get(S.focus);
      if (b) jumpTo(focusView(b.base, b.fwd, b.modeS));
    }
  }

  private frame = () => {
    requestAnimationFrame(this.frame);
    if (document.hidden || S.paused) { this.clock.getDelta(); return; }
    const dt = Math.min(this.clock.getDelta(), S.fast ? 0.4 : 0.05), t = this.clock.elapsedTime;
    const { U, WT, skyFade, morphU, COLS } = S, { tube, topper, glow, rays, flames, moonGlow } = this.decor, core = this.core;
    U.time.value = t;
    U.fade.value = skyFade.v;
    applyCamera(dt, this.dragging);
    const idx = tube.geometry.index;
    tube.geometry.setDrawRange(0, idx ? Math.floor(idx.count * S.tubeReveal.v / 6) * 6 : 0);
    tube.material.opacity = 0.6 * WT.xmas; tube.visible = WT.xmas > 0.01;
    topper.scale.setScalar(Math.max(0.0001, S.topperS.v * WT.xmas)); topper.visible = WT.xmas > 0.01;
    topper.rotation.y = t * 0.45; rays.material.rotation = t * 0.08;
    glow.material.opacity = 0.8 + Math.sin(t * 2.1) * 0.2;
    core.halo.material.opacity = (0.22 * WT.xmas + 0.18 * WT.bday + 0.08 * WT.quiet) * skyFade.v; core.halo.material.color.copy(COLS.halo);
    flames.forEach((s, i) => { s.material.opacity = WT.bday * morphU.uCandles.value * skyFade.v * (0.75 + 0.25 * Math.sin(t * 13 + i * 2.1)); s.visible = s.material.opacity > 0.01; });
    moonGlow.material.opacity = 0.75 * WT.quiet * skyFade.v; moonGlow.visible = WT.quiet > 0.01;
    const { snow, confetti, motes } = this.fall;
    snow.material.uniforms.uW.value = WT.xmas; snow.visible = WT.xmas > 0.01;
    confetti.material.uniforms.uW.value = WT.bday; confetti.visible = WT.bday > 0.01;
    motes.material.uniforms.uW.value = WT.quiet; motes.visible = WT.quiet > 0.01;
    core.stars.material.uniforms.uBoost.value = 1 + WT.quiet * 0.8 - WT.bday * 0.35;
    core.ground.material.uniforms.uPath.value = WT.quiet;
    core.treeLight.color.copy(COLS.light); core.rimLight.color.copy(COLS.rim);
    core.treeLight.position.y = 3.2 - WT.bday * 0.8 - WT.quiet * 0.4; core.treeLight.intensity = 26 - WT.quiet * 12;
    if (WT.quiet > 0.6 && S.interaction !== 'intro') {
      this.nextShooter -= dt;
      if (this.nextShooter <= 0) { shootingStar(false); this.nextShooter = 7 + Math.random() * 8; }
    }
    if (this.needRay) this.raycast();
    updateBaubles(dt, t);
    updateStrings(t);
    updateShooters(dt);
    updateSparks(dt);
    core.finalPass.uniforms.uTime.value = t;
    core.composer.render(dt);
    layoutLabels();
    this.adaptResolution(dt);
  };

  // Steps the render resolution down while the average frame rate stays low.
  // The intro compiles shaders and a long gap is a hidden tab, so neither counts.
  // The floor keeps high density phones sharp: 1x on a 3x screen smears the scene.
  private adaptResolution(dt: number) {
    if (S.interaction === 'intro' || dt > 0.25) return;
    const p = this.perf;
    p.frames++; p.time += dt;
    if (p.time < 2) return;
    const fps = p.frames / p.time;
    p.frames = 0; p.time = 0;
    const floor = Math.min(window.devicePixelRatio || 1, 1.5);
    if (fps < 40 && S.DPR > floor) { S.DPR = Math.max(floor, S.DPR - 0.25); this.resize(); }
  }
}
