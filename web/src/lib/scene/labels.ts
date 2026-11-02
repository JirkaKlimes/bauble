import * as THREE from 'three';
import type { MemberId } from '../domain/types';
import { S } from './ctx';
import { baubles, reach, type Bauble } from './ornaments';
import { isMobile, lerp } from './util';

type Label = { el: HTMLElement; w: number; h: number; x: number | null; y: number; v: number };
const labels = new Map<MemberId, Label>();
const ro = new ResizeObserver(entries => {
  for (const e of entries) for (const l of labels.values()) if (l.el === e.target) { l.w = l.el.offsetWidth || l.w; l.h = l.el.offsetHeight || l.h; }
});

export function registerLabel(id: MemberId, el: HTMLElement) {
  labels.set(id, { el, w: el.offsetWidth || 120, h: el.offsetHeight || 44, x: null, y: 0, v: 0 });
  ro.observe(el);
  return () => { ro.unobserve(el); if (labels.get(id)?.el === el) labels.delete(id); };
}

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), up = new THREE.Vector3();
const project = (v: THREE.Vector3) => { tmp.copy(v).project(S.camera); return { x: (tmp.x * 0.5 + 0.5) * S.W, y: (-tmp.y * 0.5 + 0.5) * S.H, z: tmp.z }; };
type Rect = { x: number; y: number; w: number; h: number };
const area = (a: Rect, c: Rect) =>
  Math.max(0, Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x)) * Math.max(0, Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y));

let last = 0;

function hide(l: Label) { l.el.style.opacity = '0'; l.el.style.pointerEvents = 'none'; l.el.tabIndex = -1; l.x = null; }

/**
 * Puts every name label below, above, or beside its ornament, wherever it covers the least:
 * the UI, other labels, and other ornaments.
 */
export function layoutLabels() {
  const { W, H, ui } = S;
  const show = S.interaction === 'home', r = reach(S.WT.bday);
  const items: { b: Bauble; l: Label; below: ReturnType<typeof project>; above: ReturnType<typeof project>; ctr: ReturnType<typeof project>; pri: number }[] = [];
  for (const [id, l] of labels) {
    const b = baubles.get(id);
    if (!b) continue;
    if (!show || b.labelAlpha <= 0.01 || b.pop < 0.3) { hide(l); continue; }
    const s = b.sc * b.pop * b.modeS * b.dimS;
    const below = project(tmp2.copy(b.root.position).add(up.set(0, -r.down * s - 0.06, 0)));
    const above = project(tmp2.copy(b.root.position).add(up.set(0, r.up * s + (b.hat ? 0.95 : 0.12) * s, 0)));
    const ctr = project(b.root.position);
    const st = S.status, cel = st?.mode === 'bday' && st.occ.who === id;
    items.push({ b, l, below, above, ctr, pri: (cel ? 100 : 0) + (id === S.me ? 10 : 0) - ctr.z });
  }
  items.sort((a, c) => c.pri - a.pri);
  const mob = isMobile(), blocks: Rect[] = [];
  if (ui.hero?.height) blocks.push({ x: ui.hero.x - 6, y: ui.heroTop - 4, w: mob ? W : ui.hero.width + 12, h: H });
  blocks.push({ x: 0, y: 0, w: W, h: ui.top + 4 });
  if (!mob && ui.tm?.width) blocks.push({ x: ui.tm.x - 8, y: ui.tm.y - 8, w: ui.tm.width + 16, h: ui.tm.height + 16 });
  const discs = items.map(it => {
    const r = Math.abs(it.below.y - it.ctr.y), top = Math.min(it.above.y + 6, it.ctr.y - r);
    return { x: it.ctr.x - r * 0.92, y: top, w: r * 1.84, h: it.ctr.y + r * 0.92 - top };
  });
  const placed: Rect[] = [];
  const now = performance.now(), ldt = Math.min(0.25, (now - (last || now)) / 1000); last = now;
  items.forEach((it, ii) => {
    const { l } = it, w = l.w, h = l.h, r = Math.abs(it.below.y - it.ctr.y);
    const cands = [{ x: it.below.x - w / 2, y: it.below.y - 2 }, { x: it.above.x - w / 2, y: it.above.y - h + 4 },
      { x: it.ctr.x + r * 0.95, y: it.ctr.y - h / 2 + r * 0.3 }, { x: it.ctr.x - r * 0.95 - w, y: it.ctr.y - h / 2 + r * 0.3 }];
    let best = cands[0], bestScore = Infinity;
    cands.forEach((c, ci) => {
      const rr = { x: c.x + 8, y: c.y + 5, w: w - 16, h: h - 12 };
      let s = ci * 40;
      if (c.x < 4 || c.x + w > W - 4 || c.y < 0 || c.y + h > H) s += 1e6;
      for (const k of blocks) s += area(rr, k) * 4;
      for (const k of placed) s += area(rr, k) * 3;
      discs.forEach((d, di) => { if (di !== ii) s += area(rr, d) * 2; });
      if (s < bestScore) { bestScore = s; best = c; }
    });
    const vis = bestScore < 40 * 3 + w * h * 0.06 ? 1 : 0;
    placed.push({ x: best.x + 8, y: best.y + 5, w: w - 16, h: h - 12 });
    if (l.x == null || Math.hypot(l.x - best.x, l.y - best.y) > 220) { l.x = best.x; l.y = best.y; }
    const k = 1 - Math.exp(-ldt * 12);
    l.x = lerp(l.x, best.x, k); l.y = lerp(l.y, best.y, k); l.v = lerp(l.v, vis, 1 - Math.exp(-ldt * 9));
    l.el.style.transform = `translate3d(${Math.round(l.x)}px,${Math.round(l.y)}px,0)`;
    const a = it.b.labelAlpha * l.v;
    l.el.style.opacity = a.toFixed(3);
    l.el.style.pointerEvents = a > 0.5 ? 'auto' : 'none'; l.el.tabIndex = a > 0.5 ? 0 : -1;
    l.el.classList.toggle('hot', it.b.hover);
  });
}
