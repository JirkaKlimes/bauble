import * as THREE from 'three';

export const V3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const C3 = (r: number, g: number, b: number, k = 1) => new THREE.Color(r * k, g * k, b * k);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobile = () => innerWidth <= 760;

export function canvas2d(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2d context');
  return [c, g];
}

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function radialTex(stops: [number, string][], size = 256) {
  const [c, g] = canvas2d(size);
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, cc]) => gr.addColorStop(o, cc));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return tex(c);
}

export function raysTex() {
  const s = 512, [c, g] = canvas2d(s);
  g.translate(s / 2, s / 2); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 18; i++) {
    const len = (i % 2 ? 0.32 : 0.48) * s * (0.8 + 0.4 * ((i * 37) % 10) / 10);
    const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(255,220,150,.75)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -3); g.lineTo(len, 0); g.lineTo(0, 3); g.closePath(); g.fill();
    g.rotate(Math.PI * 2 / 18);
  }
  return tex(c);
}

export function stripeTex(a: string, b: string, gold: boolean) {
  const [c, g] = canvas2d(256);
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  g.save(); g.translate(128, 128); g.rotate(-0.55); g.fillStyle = b;
  for (let x = -400; x < 400; x += 46) g.fillRect(x, -400, 18, 800);
  g.restore();
  g.fillStyle = gold ? '#fff3c4' : 'rgba(255,255,255,.85)';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc((i * 61) % 256, (i * 37) % 256, 3.2, 0, Math.PI * 2); g.fill(); }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 1);
  return t;
}
