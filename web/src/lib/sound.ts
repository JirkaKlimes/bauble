import type { Mode } from './domain/occasions';

const KEY = 'bauble-sound';
let actx: AudioContext | null = null;
let master: GainNode | null = null;
let interacted = false;
let on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked */ }

for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { interacted = true; }, { capture: true });

export const soundOn = () => on;
export function setSound(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* storage blocked */ }
  if (v) bell(1046.5, 0, 0.15);
}

function ready(): [AudioContext, GainNode] | null {
  if (!on || !interacted) return null;
  if (!actx) {
    actx = new AudioContext();
    master = actx.createGain(); master.gain.value = 0.55;
    const comp = actx.createDynamicsCompressor();
    master.connect(comp); comp.connect(actx.destination);
  }
  if (actx.state === 'suspended') void actx.resume();
  return master ? [actx, master] : null;
}

export function bell(f: number, delay = 0, g = 0.2) {
  const a = ready(); if (!a) return;
  const [ac, out] = a, t = ac.currentTime + 0.02 + delay;
  for (const [r, amp, d] of [[1, 1, 1.8], [2.0, 0.42, 1.1], [2.76, 0.3, 0.8], [5.4, 0.14, 0.45], [8.93, 0.06, 0.25]]) {
    if (f * r > 16000) continue;
    const o = ac.createOscillator(), gn = ac.createGain(); o.type = 'sine'; o.frequency.value = f * r;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g * amp, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(gn); gn.connect(out); o.start(t); o.stop(t + d + 0.05);
  }
}

export function pluck(f: number, delay = 0, g = 0.16) {
  const a = ready(); if (!a) return;
  const [ac, out] = a, t = ac.currentTime + 0.02 + delay;
  const o = ac.createOscillator(), gn = ac.createGain(), fl = ac.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = f; fl.type = 'lowpass';
  fl.frequency.setValueAtTime(f * 6, t); fl.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.4);
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(g, t + 0.006); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(fl); fl.connect(gn); gn.connect(out); o.start(t); o.stop(t + 0.75);
}

export function whoosh() {
  const a = ready(); if (!a) return;
  const [ac, out] = a, t = ac.currentTime + 0.01, len = 0.6;
  const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(), fl = ac.createBiquadFilter(), gn = ac.createGain();
  src.buffer = buf; fl.type = 'bandpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(300, t + len); fl.Q.value = 0.7;
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.35, t + 0.05); gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(fl); fl.connect(gn); gn.connect(out); src.start(t);
}

export function bellGliss() {
  const a = ready(); if (!a) return;
  const [ac, out] = a, t = ac.currentTime + 0.01, o = ac.createOscillator(), gn = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.9);
  gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(0.07, t + 0.05); gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
  o.connect(gn); gn.connect(out); o.start(t); o.stop(t + 1.2);
  bell(1975.5, 0.5, 0.05);
}

export function jingle(mode: Mode) {
  if (mode === 'bday') { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(f, i * 0.07)); bell(2093, 0.3, 0.06); return; }
  if (mode === 'quiet') { bell(1318.5, 0, 0.1); bell(1975.5, 0.12, 0.08); return; }
  bell(1318.5, 0, 0.16); bell(1661.2, 0.09, 0.15); bell(1975.5, 0.18, 0.16); bell(2637, 0.3, 0.08);
}

export function modeSound(mode: Mode) {
  if (mode === 'xmas') { bell(783.99, 0.1, 0.12); bell(1174.7, 0.5, 0.1); bell(1568, 0.9, 0.08); }
  else if (mode === 'bday') [392, 493.88, 587.33, 783.99, 987.77].forEach((f, i) => pluck(f, 0.1 + i * 0.09, 0.13));
  else { bell(659.25, 0.1, 0.09); bell(987.77, 0.7, 0.06); }
}
