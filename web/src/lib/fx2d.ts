import type { Mode } from './domain/occasions';
import { reduced } from './scene/util';

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; rot: number; vr: number; col: string; star: boolean; mode: Mode };
const COLS: Record<Mode, string[]> = {
  xmas: ['#ffe3a3', '#f2c46d', '#fff6e0', '#e8445e'],
  bday: ['#ff7aa6', '#5fe0d8', '#ffd45c', '#b394ff', '#ffffff'],
  quiet: ['#e6eeff', '#b7c8ea', '#ffffff', '#9fc0ff'],
};
const parts: P[] = [];
let el: HTMLCanvasElement | null = null, g: CanvasRenderingContext2D | null = null;
let running = false, last = 0, mode: Mode = 'xmas';

export function attachFx(c: HTMLCanvasElement) {
  el = c; g = c.getContext('2d');
  const size = () => { c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; g?.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  size(); addEventListener('resize', size);
}
export const setFxMode = (m: Mode) => { mode = m; };

/** Confetti or sparkles flying out of a screen point. */
export function burst2D(x: number, y: number, n = 36) {
  if (!g) return;
  if (reduced) n = 10;
  const cols = COLS[mode];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 280;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160, life: 0, max: 0.7 + Math.random() * 0.7,
      r: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, col: cols[(Math.random() * cols.length) | 0],
      star: mode === 'bday' ? Math.random() < 0.3 : Math.random() < 0.65, mode });
  }
  if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
}
export const burstAt = (r: DOMRect, n?: number, fx = 0.5, fy = 0.5) => burst2D(r.left + r.width * fx, r.top + r.height * fy, n);

function loop(now: number) {
  if (!g || !el) return;
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  g.clearRect(0, 0, innerWidth, innerHeight);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life += dt;
    if (p.life > p.max) { parts.splice(i, 1); continue; }
    p.vy += 520 * dt; p.vx *= Math.exp(-1.5 * dt); p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const f = 1 - p.life / p.max;
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = f; g.fillStyle = p.col; g.shadowColor = p.col; g.shadowBlur = 10;
    if (p.star) {
      const r = p.r * 1.4; g.beginPath();
      for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * 0.28 : r, aa = k * Math.PI / 4; if (k) g.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); else g.moveTo(rr, 0); }
      g.closePath(); g.fill();
    } else if (p.mode === 'bday') {
      g.shadowBlur = 0; const c = Math.abs(Math.cos(p.rot * 2));
      g.fillRect(-p.r * 0.8, -p.r * 0.35 * c - 0.5, p.r * 1.6, p.r * 0.7 * c + 1);
    } else { g.beginPath(); g.arc(0, 0, p.r * 0.55, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  if (parts.length) requestAnimationFrame(loop);
  else { running = false; g.clearRect(0, 0, innerWidth, innerHeight); }
}
