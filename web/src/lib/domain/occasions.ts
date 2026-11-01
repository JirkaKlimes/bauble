import type { BdayOccId, Member, MemberId, OccId, XmasOccId } from './types';

declare const dayBrand: unique symbol;
/** Days since the Unix epoch in local calendar terms. */
export type Day = number & { readonly [dayBrand]: 'day' };

const MS = 86400000;
export const dayOf = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS) as Day;
export const dateOf = (n: Day) => { const u = new Date(n * MS); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); };
export const addDays = (d: Day, n: number) => (d + n) as Day;
export const today = () => dayOf(new Date());
const ymd = (y: number, m: number, d: number) => dayOf(new Date(y, m - 1, d));

export type XmasOcc = { kind: 'xmas'; id: XmasOccId; year: number; day: Day };
export type BdayOcc = { kind: 'bday'; id: BdayOccId; year: number; who: MemberId; day: Day };
export type Occasion = XmasOcc | BdayOcc;

export const xmasOcc = (year: number): XmasOcc => ({ kind: 'xmas', id: `xmas-${year}`, year, day: ymd(year, 12, 24) });
export function bdayOcc(m: Member, year: number): BdayOcc | null {
  if (!m.bday) return null;
  return { kind: 'bday', id: `bday-${m.id}-${year}`, year, who: m.id, day: ymd(year, m.bday.month, m.bday.day) };
}

const OCC_RE = /^(?:xmas-(\d{4})|bday-([a-z0-9]+)-(\d{4}))$/;
export const isOccId = (s: string): s is OccId => OCC_RE.test(s);

/** Resolves an occasion id; a birthday of an unknown member, or one without a date, never happens. */
export function occOf(id: OccId, members: readonly Member[]): Occasion | null {
  const m = OCC_RE.exec(id);
  if (!m) return null;
  if (m[1]) return xmasOcc(+m[1]);
  const who = members.find(x => x.id === m[2]);
  return who ? bdayOcc(who, +m[3]) : null;
}
export const occDay = (id: OccId, members: readonly Member[]) => occOf(id, members)?.day ?? Infinity;

/** The member's next two kinds of occasion, from `from` on, nearest first. */
export function occsFor(member: Member | undefined, from: Day): Occasion[] {
  const y = dateOf(from).getFullYear(), out: Occasion[] = [];
  for (const yy of [y, y + 1]) {
    out.push(xmasOcc(yy));
    const b = member && bdayOcc(member, yy);
    if (b) out.push(b);
  }
  return out.filter(o => o.day >= from).sort((a, b) => a.day - b.day);
}

export function allOccs(members: readonly Member[], from: Day, to: Day): Occasion[] {
  const y = dateOf(from).getFullYear(), out: Occasion[] = [];
  for (const yy of [y - 1, y, y + 1, y + 2]) {
    out.push(xmasOcc(yy));
    for (const m of members) { const b = bdayOcc(m, yy); if (b) out.push(b); }
  }
  return out.filter(o => o.day >= from && o.day <= to).sort((a, b) => a.day - b.day);
}

export type Phase = 'countdown' | 'day' | 'after';
export type Upcoming = { occ: Occasion; diff: number };
export type Mode = 'xmas' | 'bday' | 'quiet';
export type Status =
  | { mode: 'xmas'; occ: XmasOcc; diff: number; phase: Phase; upcoming: Upcoming[]; key: string }
  | { mode: 'bday'; occ: BdayOcc; diff: number; phase: Phase; upcoming: Upcoming[]; key: string }
  | { mode: 'quiet'; next: Upcoming | undefined; diff: number; upcoming: Upcoming[]; key: 'quiet' };

const phaseOf = (d: number): Phase => (d > 0 ? 'countdown' : d === 0 ? 'day' : 'after');

/*
 * Christmas season runs 15 October to 26 December. A birthday takes over 21 days before
 * (7 inside the Christmas season), on the day and the day after. The nearer birthday wins.
 */
export function statusOn(day: Day, members: readonly Member[]): Status {
  const y = dateOf(day).getFullYear();
  const xs = ymd(y, 10, 15), xd = ymd(y, 12, 24), xe = ymd(y, 12, 26);
  const inX = day >= xs && day <= xe;
  const win = inX ? 7 : 21;
  const cands: { occ: BdayOcc; diff: number }[] = [];
  for (const m of members) for (const yy of [y - 1, y, y + 1]) {
    const o = bdayOcc(m, yy);
    if (!o) continue;
    const diff = o.day - day;
    if (diff >= -1 && diff <= win) cands.push({ occ: o, diff });
  }
  cands.sort((a, b) => Number(a.diff < 0) - Number(b.diff < 0) || Math.abs(a.diff) - Math.abs(b.diff));
  const upcoming = allOccs(members, day, addDays(day, 400)).map(o => ({ occ: o, diff: o.day - day }));
  const c = cands[0];
  if (c) return { mode: 'bday', occ: c.occ, diff: c.diff, phase: phaseOf(c.diff), upcoming, key: c.occ.id };
  if (inX) return { mode: 'xmas', occ: xmasOcc(y), diff: xd - day, phase: phaseOf(xd - day), upcoming, key: `xmas-${y}` };
  return { mode: 'quiet', next: upcoming[0], diff: upcoming[0]?.diff ?? 0, upcoming, key: 'quiet' };
}

export const sceneOcc = (st: Status): Occasion | null => (st.mode === 'quiet' ? null : st.occ);
