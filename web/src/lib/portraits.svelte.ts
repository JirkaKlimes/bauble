import type { Look, Member, MemberId } from './domain/types';
import { canvas2d } from './scene/util';

function hexToRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mixHex(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
const shade = (h: string, k: number) => (k < 0 ? mixHex(h, '#000000', -k) : mixHex(h, '#ffffff', k));

function background(g: CanvasRenderingContext2D, glass: string) {
  const bg = g.createRadialGradient(256, 214, 20, 256, 256, 330);
  bg.addColorStop(0, '#ffe7b8'); bg.addColorStop(0.45, mixHex(glass, '#f6c97e', 0.42)); bg.addColorStop(1, shade(glass, -0.4));
  g.fillStyle = bg; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 14; i++) {
    const x = 40 + ((i * 97) % 440), y = 40 + ((i * 53) % 220), r = 10 + (i * 7) % 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,240,200,.12)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

/** A drawn cartoon face, used by the demo family. */
export function drawPortrait(L: Look, glass: string): HTMLCanvasElement {
  const [c, g] = canvas2d(512);
  const skin = L.skin, hair = L.hair;
  const ell = (x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient) => { g.fillStyle = fill; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); };
  background(g, glass);
  g.fillStyle = shade(hair, -0.08);
  if (L.style === 'long') {
    g.beginPath(); g.moveTo(150, 240); g.bezierCurveTo(140, 130, 210, 112, 256, 112); g.bezierCurveTo(302, 112, 372, 130, 362, 240);
    g.lineTo(380, 470); g.bezierCurveTo(330, 486, 182, 486, 132, 470); g.closePath(); g.fill();
  } else if (L.style === 'bob') {
    g.beginPath(); g.moveTo(146, 300); g.bezierCurveTo(128, 160, 200, 112, 256, 114); g.bezierCurveTo(312, 112, 384, 160, 366, 300);
    g.bezierCurveTo(360, 340, 330, 352, 300, 344); g.lineTo(212, 344); g.bezierCurveTo(182, 352, 152, 340, 146, 300); g.closePath(); g.fill();
  }
  const sweater = new Path2D('M58 512C68 412 150 372 256 372S444 412 454 512Z');
  g.fillStyle = L.sweater; g.fill(sweater);
  g.save(); g.clip(sweater);
  const sg = g.createLinearGradient(0, 372, 0, 512); sg.addColorStop(0, 'rgba(255,255,255,.12)'); sg.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = sg; g.fillRect(0, 360, 512, 160);
  g.strokeStyle = L.knit; g.lineWidth = 7; g.lineJoin = 'round'; g.beginPath();
  for (let x = 20, k = 0; x <= 500; x += 26, k++) { const y = 452 + (k % 2 ? -11 : 11); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
  g.stroke(); g.fillStyle = L.knit;
  for (let x = 33; x < 500; x += 26) { g.beginPath(); g.moveTo(x, 482); g.lineTo(x + 5, 488); g.lineTo(x, 494); g.lineTo(x - 5, 488); g.closePath(); g.fill(); }
  for (let x = 20; x < 500; x += 26) { g.beginPath(); g.arc(x, 424, 3, 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.fillStyle = shade(skin, -0.14); g.beginPath(); g.roundRect(220, 316, 72, 70, 22); g.fill();
  g.strokeStyle = shade(L.sweater, -0.2); g.lineWidth = 16; g.lineCap = 'round';
  g.beginPath(); g.ellipse(256, 380, 52, 14, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
  ell(166, 262, 16, 23, shade(skin, -0.06)); ell(346, 262, 16, 23, shade(skin, -0.06));
  const hg = g.createRadialGradient(232, 214, 20, 256, 250, 130); hg.addColorStop(0, shade(skin, 0.12)); hg.addColorStop(1, shade(skin, -0.08));
  ell(256, 250, 92, 104, hg);
  if (L.beard) {
    g.fillStyle = hair; g.beginPath();
    g.moveTo(166, 262); g.bezierCurveTo(166, 330, 204, 370, 256, 372); g.bezierCurveTo(308, 370, 346, 330, 346, 262);
    g.bezierCurveTo(334, 292, 318, 300, 300, 300); g.bezierCurveTo(286, 300, 274, 292, 256, 292); g.bezierCurveTo(238, 292, 226, 300, 212, 300);
    g.bezierCurveTo(194, 300, 178, 292, 166, 262); g.closePath(); g.fill();
  }
  g.fillStyle = hair;
  if (L.style === 'short') {
    g.beginPath(); g.moveTo(162, 262); g.bezierCurveTo(148, 176, 196, 124, 258, 122); g.bezierCurveTo(322, 120, 368, 168, 352, 262);
    g.bezierCurveTo(346, 222, 334, 200, 318, 190); g.bezierCurveTo(304, 208, 280, 208, 266, 192); g.bezierCurveTo(252, 212, 224, 214, 208, 196);
    g.bezierCurveTo(190, 210, 172, 230, 162, 262); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(232, 132); g.bezierCurveTo(244, 94, 292, 96, 304, 126); g.bezierCurveTo(286, 116, 262, 118, 248, 134); g.closePath(); g.fill();
  } else if (L.style === 'bob') {
    g.beginPath(); g.moveTo(158, 262); g.bezierCurveTo(152, 170, 206, 128, 262, 128); g.bezierCurveTo(320, 130, 360, 172, 354, 250);
    g.bezierCurveTo(330, 206, 292, 186, 250, 194); g.bezierCurveTo(222, 200, 196, 222, 182, 256); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(160, 236); g.lineTo(150, 330); g.quadraticCurveTo(172, 352, 196, 336); g.lineTo(184, 250); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(352, 236); g.lineTo(362, 330); g.quadraticCurveTo(340, 352, 316, 336); g.lineTo(330, 250); g.closePath(); g.fill();
  } else if (L.style === 'long') {
    g.beginPath(); g.moveTo(256, 130); g.bezierCurveTo(198, 126, 156, 172, 158, 262); g.lineTo(150, 448); g.bezierCurveTo(172, 462, 196, 452, 200, 430);
    g.lineTo(196, 300); g.bezierCurveTo(196, 238, 220, 186, 256, 150); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(256, 130); g.bezierCurveTo(314, 126, 356, 172, 354, 262); g.lineTo(362, 448); g.bezierCurveTo(340, 462, 316, 452, 312, 430);
    g.lineTo(316, 300); g.bezierCurveTo(316, 238, 292, 186, 256, 150); g.closePath(); g.fill();
  } else if (L.style === 'bun') {
    ell(256, 104, 40, 36, hair);
    g.strokeStyle = shade(hair, 0.25); g.lineWidth = 6; g.beginPath(); g.arc(256, 104, 26, Math.PI * 1.1, Math.PI * 1.6); g.stroke();
    g.fillStyle = hair; g.beginPath(); g.moveTo(160, 262); g.bezierCurveTo(150, 170, 200, 128, 256, 128); g.bezierCurveTo(312, 128, 362, 170, 352, 262);
    g.bezierCurveTo(342, 204, 300, 176, 258, 178); g.bezierCurveTo(214, 176, 172, 204, 160, 262); g.closePath(); g.fill();
    g.strokeStyle = hair; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(172, 230); g.quadraticCurveTo(162, 270, 176, 300); g.stroke();
    g.beginPath(); g.moveTo(340, 230); g.quadraticCurveTo(350, 270, 336, 300); g.stroke();
  } else if (L.style === 'receding') {
    g.beginPath(); g.moveTo(160, 268); g.bezierCurveTo(152, 220, 166, 190, 186, 180); g.bezierCurveTo(182, 206, 182, 236, 188, 262); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(352, 268); g.bezierCurveTo(360, 220, 346, 190, 326, 180); g.bezierCurveTo(330, 206, 330, 236, 324, 262); g.closePath(); g.fill();
    g.strokeStyle = hair; g.lineWidth = 4; g.lineCap = 'round';
    for (const dx of [-14, 0, 14]) { g.beginPath(); g.moveTo(256 + dx - 8, 150); g.quadraticCurveTo(256 + dx, 140, 256 + dx + 10, 148); g.stroke(); }
    ell(228, 176, 26, 14, 'rgba(255,255,255,.22)');
  }
  g.lineCap = 'round'; g.strokeStyle = shade(hair, -0.25); g.lineWidth = 6;
  g.beginPath(); g.arc(216, 248, 20, Math.PI * 1.2, Math.PI * 1.75); g.stroke();
  g.beginPath(); g.arc(296, 248, 20, Math.PI * 1.25, Math.PI * 1.8); g.stroke();
  if (L.eyes === 'happy') {
    g.strokeStyle = '#2b1d14'; g.lineWidth = 6.5;
    g.beginPath(); g.arc(216, 272, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.beginPath(); g.arc(296, 272, 12, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
  } else {
    ell(216, 266, 9, 11, '#2b1d14'); ell(296, 266, 9, 11, '#2b1d14');
    ell(219.5, 262, 3.2, 3.2, '#fff'); ell(299.5, 262, 3.2, 3.2, '#fff');
  }
  for (const x of [196, 316]) {
    const cg = g.createRadialGradient(x, 304, 0, x, 304, 30); cg.addColorStop(0, 'rgba(236,104,118,.5)'); cg.addColorStop(1, 'rgba(236,104,118,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(x, 304, 30, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = shade(skin, -0.28); g.lineWidth = 4.5;
  g.beginPath(); g.moveTo(250, 290); g.quadraticCurveTo(256, 298, 263, 290); g.stroke();
  if (L.beard) {
    g.fillStyle = shade(hair, -0.06); g.beginPath();
    g.moveTo(256, 304); g.bezierCurveTo(240, 296, 214, 300, 210, 316); g.bezierCurveTo(230, 312, 244, 316, 256, 312);
    g.bezierCurveTo(268, 316, 282, 312, 302, 316); g.bezierCurveTo(298, 300, 272, 296, 256, 304); g.closePath(); g.fill();
  }
  if (L.mouth === 'open') {
    g.fillStyle = '#6b2220'; g.beginPath(); g.moveTo(226, 318); g.quadraticCurveTo(256, 362, 286, 318); g.closePath(); g.fill();
    g.save(); g.clip(); ell(256, 346, 16, 10, '#d9686a'); g.fillStyle = '#fff'; g.fillRect(222, 314, 70, 8); g.restore();
  } else {
    g.strokeStyle = '#7a2e2a'; g.lineWidth = 6; g.beginPath();
    g.moveTo(230, L.beard ? 324 : 320); g.quadraticCurveTo(256, L.beard ? 344 : 342, 282, L.beard ? 324 : 320); g.stroke();
  }
  if (L.glasses) {
    g.strokeStyle = '#3a2a1c'; g.lineWidth = 6;
    g.beginPath(); g.arc(214, 266, 28, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(298, 266, 28, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(242, 262); g.quadraticCurveTo(256, 254, 270, 262); g.stroke();
    g.beginPath(); g.moveTo(186, 260); g.lineTo(168, 254); g.moveTo(326, 260); g.lineTo(344, 254); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(204, 256, 9, 5, -0.5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(288, 256, 9, 5, -0.5, 0, Math.PI * 2); g.fill();
  }
  return c;
}

export function randomLook(): Look {
  const styles = ['short', 'long', 'bun', 'bob'] as const;
  return {
    skin: '#efc4a2', hair: ['#4a2c1a', '#c58a4a', '#2a1a12', '#8c4a2a'][(Math.random() * 4) | 0], style: styles[(Math.random() * 4) | 0],
    eyes: Math.random() < 0.5 ? 'happy' : 'dots', mouth: 'open', sweater: '#2b5f8f', knit: '#f6e7c9', glasses: Math.random() < 0.3,
  };
}

type Src = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;
const dims = (s: Src) => (s instanceof HTMLVideoElement ? [s.videoWidth, s.videoHeight] : s instanceof HTMLImageElement ? [s.naturalWidth, s.naturalHeight] : [s.width, s.height]);

/** Square centre crop, optionally mirrored like a selfie preview. */
export function coverCanvas(src: Src, mirror = false) {
  const [c, g] = canvas2d(512), [w, h] = dims(src), s = Math.min(w, h);
  if (mirror) { g.translate(512, 0); g.scale(-1, 1); }
  g.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 512, 512);
  return c;
}

export function photoPortrait(src: Src, glass: string) {
  const [c, g] = canvas2d(512);
  background(g, glass);
  const [w, h] = dims(src), s = Math.min(w, h);
  g.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, 512, 512);
  const warm = g.createRadialGradient(256, 230, 120, 256, 256, 360);
  warm.addColorStop(0, 'rgba(255,214,150,0)'); warm.addColorStop(1, 'rgba(40,20,10,.45)');
  g.fillStyle = warm; g.fillRect(0, 0, 512, 512);
  return c;
}

/** No photo yet: the first letter of the name on the member's glass colour. */
function monogram(m: Member) {
  const [c, g] = canvas2d(512);
  background(g, m.glass);
  const letter = m.name.trim().charAt(0).toUpperCase() || '?';
  g.fillStyle = shade(m.glass, -0.45); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '500 300px "Fraunces Variable", Georgia, serif';
  g.fillText(letter, 256, 282);
  return c;
}

const basePortrait = (m: Member) => (m.look ? drawPortrait(m.look, m.glass) : monogram(m));

type Entry = { canvas: HTMLCanvasElement; photo: boolean };
const canvases = new Map<MemberId, Entry>();
const urls = $state<Record<string, string>>({});
const listeners = new Set<(id: MemberId, c: HTMLCanvasElement) => void>();

export const portraits = {
  url: (id: MemberId) => urls[id] ?? '',
  canvas: (id: MemberId) => canvases.get(id)?.canvas,
  onChange(f: (id: MemberId, c: HTMLCanvasElement) => void) { listeners.add(f); return () => listeners.delete(f); },
  set(id: MemberId, canvas: HTMLCanvasElement, photo = true) {
    const [small, g] = canvas2d(192);
    g.drawImage(canvas, 0, 0, 192, 192);
    canvases.set(id, { canvas, photo });
    urls[id] = small.toDataURL('image/jpeg', 0.88);
    listeners.forEach(f => f(id, canvas));
  },
  /** A placeholder now, then the real photo once it loads. */
  ensure(m: Member) {
    if (!canvases.has(m.id)) this.set(m.id, basePortrait(m), false);
    if (m.photo) void this.load(m);
  },
  redrawBase(m: Member) { if (!canvases.get(m.id)?.photo) this.set(m.id, basePortrait(m), false); },
  async load(m: Member) {
    if (!m.photo) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = m.photo;
    try { await img.decode(); this.set(m.id, photoPortrait(img, m.glass)); }
    catch { console.warn('bauble: photo failed to load'); }
  },
  clear() { canvases.clear(); for (const k of Object.keys(urls)) delete urls[k]; },
};

export const canvasBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', 0.9));
