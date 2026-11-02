import type { Currency, Money } from './money';

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type MemberId = Brand<string, 'member'>;
export type WishId = Brand<string, 'wish'>;
export type ClaimId = Brand<string, 'claim'>;
export type InviteId = Brand<string, 'invite'>;

export type Role = 'admin' | 'member';

export const LOCALES = ['cs', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const isLocale = (s: unknown): s is Locale => (LOCALES as readonly unknown[]).includes(s);

/** When the family opens Christmas presents: the evening of 24 December, or the morning of 25 December. */
export type Christmas = 'eve' | 'day';
export const isChristmas = (s: unknown): s is Christmas => s === 'eve' || s === 'day';
export type Priority = 'top' | 'high' | 'nice';
export const PRIORITIES: readonly Priority[] = ['top', 'high', 'nice'];
export const PRIORITY_ORDER: Record<Priority, number> = { top: 0, high: 1, nice: 2 };

export type Gone = 'deleted' | 'got';

export const ARTS = [
  'gift', 'mug', 'book', 'socks', 'voucher', 'headphones', 'headlamp', 'train', 'planner', 'candle',
  'pottery', 'flowers', 'blanket', 'tickets', 'keyboard', 'thermos', 'beanie',
] as const;
export type Art = (typeof ARTS)[number];
export const isArt = (s: string): s is Art => (ARTS as readonly string[]).includes(s);

export type Birthday = { day: number; month: number };

export type Look = {
  skin: string; hair: string; style: 'short' | 'long' | 'bun' | 'bob' | 'receding';
  eyes: 'dots' | 'happy'; mouth: 'smile' | 'open'; sweater: string; knit: string;
  beard?: boolean; glasses?: boolean;
};

export type Member = {
  id: MemberId;
  name: string;
  voc: string;
  ins: string;
  gen: string;
  /** null: not chosen, the device language applies */
  lang: Locale | null;
  currency: Currency;
  bday: Birthday | null;
  slot: number;
  role: Role;
  glass: string;
  tilt: number;
  avatar: string;
  photo: string | null;
  look?: Look;
};

export type Wish = {
  id: WishId;
  owner: MemberId;
  title: string;
  url: string;
  store: string;
  price: Money | null;
  note: string;
  pr: Priority;
  art: Art;
  imageUrl: string;
  img: string;
  gone: Gone | null;
};

export type XmasOccId = `xmas-${number}`;
export type BdayOccId = `bday-${string}-${number}`;
export type OccId = XmasOccId | BdayOccId;

export type Claim = {
  id: ClaimId;
  wish: WishId;
  by: MemberId[];
  occ: OccId;
  revealed: boolean;
};

export type Family = { christmas: Christmas; members: Member[]; wishes: Wish[]; claims: Claim[] };

export type Invite = {
  id: InviteId;
  token: string;
  note: string;
  role: Role;
  usedBy: MemberId | null;
  expires: Date | null;
};

export type InviteInfo = { token: string; note: string; role: Role };

/** A price from a shop page; the page may not say which currency. */
export type Preview = { title: string; image: string; price: { amount: number; currency: Currency | null } | null };

export const GLASS = ['#2342a6', '#a8173c', '#0d7050', '#c48d1c', '#8a3a7a', '#1f7a8c', '#b4561e', '#4b3fa6', '#6a7d1f', '#9b2d5f', '#2f6f4f', '#7a5a1f'];
export const glassFor = (slot: number) => GLASS[slot % GLASS.length];
export const tiltFor = (slot: number) => (slot % 2 ? 0.34 : -0.34);

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(15)), b => ID_CHARS[b % 36]).join('');
