import * as THREE from 'three';
import type { Mode, Status } from '../domain/occasions';
import type { MemberId } from '../domain/types';

export type SceneMember = { id: MemberId; slot: number; glass: string; tilt: number };
export type Interaction = 'intro' | 'auth' | 'onboarding' | 'home' | 'focus';

type Palette = { top: string; mid: string; hor: string; glow: string; gLo: string; gHi: string; pool: string; light: string; halo: string; rim: string };
export const PAL: Record<Mode, Palette> = {
  xmas: { top: '#020309', mid: '#0a1131', hor: '#1c2a63', glow: '#2a1406', gLo: '#010205', gHi: '#0a0c1e', pool: '#ff8c38', light: '#ffb15c', halo: '#ffb46a', rim: '#86a0ff' },
  bday: { top: '#05020a', mid: '#1c0a28', hor: '#55204a', glow: '#3a120c', gLo: '#030105', gHi: '#170814', pool: '#ff7aa2', light: '#ffb7a6', halo: '#ff9fbf', rim: '#c99bff' },
  quiet: { top: '#010307', mid: '#05121f', hor: '#0e2c40', glow: '#04101a', gLo: '#010306', gHi: '#06121c', pool: '#8fb8ff', light: '#a9c8ff', halo: '#b9d4ff', rim: '#7fb0ff' },
};
export type ColKey = keyof Palette;

/** The one scene on the page. Filled by `initCore`; every scene module reads it. */
export const S = {
  renderer: null as unknown as THREE.WebGLRenderer,
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.1, 500),
  W: innerWidth,
  H: innerHeight,
  DPR: Math.min(window.devicePixelRatio || 1, 1.75),
  U: { time: { value: 0 }, scale: { value: 60 }, fade: { value: 0 } },
  /** mode weights, tweened during transitions */
  WT: { xmas: 1, bday: 0, quiet: 0 } as Record<Mode, number>,
  morphU: { uMorph: { value: 1 }, uReveal: { value: 0 }, uCandles: { value: 1 }, uSwirl: { value: 1 } },
  tubeReveal: { v: 0 },
  skyFade: { v: 0 },
  topperS: { v: 1 },
  COLS: Object.fromEntries(Object.entries(PAL.xmas).map(([k, v]) => [k, new THREE.Color(v)])) as Record<ColKey, THREE.Color>,
  status: null as Status | null,
  members: [] as SceneMember[],
  me: null as MemberId | null,
  interaction: 'intro' as Interaction,
  focus: null as MemberId | null,
  ui: { top: 80, heroTop: 9999, hero: null as DOMRect | null, tm: null as DOMRect | null },
  fast: false,
  /** test hook: stops drawing so other headless pages get the CPU */
  paused: false,
};

export const curMode = (): Mode => S.status?.mode ?? 'xmas';
