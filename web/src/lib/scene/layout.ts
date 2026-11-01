import { V3 } from './util';

export const H_TREE = 7.4, R_TREE = 3.0, Y0 = 0.3, TURNS = 7.25;
export const coneR = (t: number) => R_TREE * Math.pow(Math.max(0, 1 - t), 1.05);
export const BAUBLE_R = 0.58, CAP_THETA = 0.93;

// ornament spots on the tree in join order: the first few spread over the whole tree
export const SLOTS = [
  { a: 0.03, t: 0.46 }, { a: 0.64, t: 0.27 }, { a: -0.8, t: 0.575 }, { a: -0.62, t: 0.31 }, { a: 0.82, t: 0.6 },
  { a: -0.32, t: 0.72 }, { a: 0.42, t: 0.76 }, { a: -1.05, t: 0.4 }, { a: 1.1, t: 0.44 },
  { a: -0.05, t: 0.86 }, { a: -1.25, t: 0.2 }, { a: 1.28, t: 0.22 },
];
export const slotPos = (s: { a: number; t: number }) => {
  const r = coneR(s.t) + 0.45;
  return V3(Math.sin(s.a) * r, Y0 + s.t * H_TREE - 0.2, Math.cos(s.a) * r);
};

export const CAKE = {
  tiers: [{ r: 2.45, y0: 0.32, y1: 1.55 }, { r: 1.8, y0: 1.55, y1: 2.62 }, { r: 1.18, y0: 2.62, y1: 3.5 }],
  candleR: 0.62, nC: 7, flameY: 4.28,
};
export const MOON = { c: V3(0.7, 6.5, -4.6), R: 2.35 };
export const candlePos = (i: number) => {
  const a = i / CAKE.nC * Math.PI * 2 + 0.3;
  return V3(Math.cos(a) * CAKE.candleR, CAKE.flameY, Math.sin(a) * CAKE.candleR);
};

// render layers: lights and particles are bloomed; solid objects draw after the bloom so glow never fogs them
export const L_SOLID = 1, L_TOP = 2;
