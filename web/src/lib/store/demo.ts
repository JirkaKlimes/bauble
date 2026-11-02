import { hostOf } from '../domain/links';
import type { Currency, Rates } from '../domain/money';
import { occsFor, today } from '../domain/occasions';
import {
  randomId, type Art, type Christmas, type Claim, type ClaimId, type Family, type Invite, type InviteId, type Locale, type Look,
  type Member, type MemberId, type Priority, type Wish, type WishId,
} from '../domain/types';
import type { Store } from './store';

type Home = 'CZK' | 'GBP';
/** The Czech demo family opens presents on Christmas Eve, the English one on Christmas morning. */
const HOME: Record<Locale, { christmas: Christmas; currency: Home }> = {
  cs: { christmas: 'eve', currency: 'CZK' },
  en: { christmas: 'day', currency: 'GBP' },
};

/** ECB reference rates of 30 October 2026, units for one euro. */
const RATES = {
  EUR: 1, USD: 1.1172, JPY: 175.68, CZK: 24.353, DKK: 7.4735, GBP: 0.8338, HUF: 366.33, PLN: 4.4038, RON: 5.3447, SEK: 10.978,
  CHF: 0.9194, ISK: 136, NOK: 10.312, TRY: 55.8015, AUD: 1.5904, BRL: 6.0692, CAD: 1.5606, CNY: 7.4326, HKD: 8.7652,
  IDR: 20275.17, ILS: 3.495, INR: 106.084, KRW: 1491.76, MXN: 21.1237, MYR: 4.5325, NZD: 1.9823, PHP: 71.143, SGD: 1.4282,
  THB: 37.683, ZAR: 18.6455,
} as Rates;

type SeedMember = { id: string; glass: string; bday: [number, number]; slot: number; tilt: number; look: Look };
const MEMBERS: SeedMember[] = [
  { id: 'dad', glass: '#2342a6', bday: [2, 7], slot: 1, tilt: -0.34,
    look: { skin: '#e9b994', hair: '#a7a29c', style: 'receding', beard: true, glasses: true, eyes: 'dots', mouth: 'smile', sweater: '#9a1f30', knit: '#f4e4c6' } },
  { id: 'mum', glass: '#a8173c', bday: [14, 3], slot: 3, tilt: 0.36,
    look: { skin: '#f1c5a2', hair: '#7a3b22', style: 'bob', eyes: 'happy', mouth: 'smile', sweater: '#1e4f8c', knit: '#f4e4c6' } },
  { id: 'me', glass: '#0d7050', bday: [20, 5], slot: 0, tilt: -0.3,
    look: { skin: '#f2c8a6', hair: '#3b2416', style: 'short', eyes: 'dots', mouth: 'open', sweater: '#245c42', knit: '#f4e4c6' } },
  { id: 'sis', glass: '#c48d1c', bday: [9, 10], slot: 2, tilt: 0.34,
    look: { skin: '#f3cdb0', hair: '#94592b', style: 'long', eyes: 'happy', mouth: 'open', sweater: '#6f2c63', knit: '#f6d9a6' } },
  { id: 'aunt', glass: '#8a3a7a', bday: [27, 1], slot: 4, tilt: -0.36,
    look: { skin: '#f0c4a3', hair: '#2e1b13', style: 'bun', eyes: 'dots', mouth: 'smile', sweater: '#b88a2e', knit: '#fbefd8' } },
];

type Names = { name: string; voc: string; ins: string; gen: string };
const NAMES: Record<Locale, Record<string, Names>> = {
  cs: {
    dad: { name: 'Táta', voc: 'tati', ins: 'Tátou', gen: 'Táty' },
    mum: { name: 'Máma', voc: 'mami', ins: 'Mámou', gen: 'Mámy' },
    me: { name: 'Brácha', voc: 'Brácho', ins: 'Bráchou', gen: 'Bráchy' },
    sis: { name: 'Ségra', voc: 'Ségro', ins: 'Ségrou', gen: 'Ségry' },
    aunt: { name: 'Teta', voc: 'Teto', ins: 'Tetou', gen: 'Tety' },
  },
  en: {
    dad: { name: 'Dad', voc: 'Dad', ins: 'Dad', gen: 'Dad' },
    mum: { name: 'Mum', voc: 'Mum', ins: 'Mum', gen: 'Mum' },
    me: { name: 'Sam', voc: 'Sam', ins: 'Sam', gen: 'Sam' },
    sis: { name: 'Sis', voc: 'Sis', ins: 'Sis', gen: 'Sis' },
    aunt: { name: 'Auntie', voc: 'Auntie', ins: 'Auntie', gen: 'Auntie' },
  },
};

/** Prices in each demo family's currency; the keyboard comes from a US shop in both. */
type SeedPrice = Record<Home, number> | { USD: number };
type SeedWish = { id: string; owner: string; url: string; price: SeedPrice | null; pr: Priority; art: Art; cs: [string, string]; en: [string, string] };
const WISHES: SeedWish[] = [
  { id: 'w1', owner: 'mum', url: 'https://www.example.com/mug', price: { CZK: 459, GBP: 15 }, pr: 'high', art: 'mug', cs: ['Hrnek s cibulákem', 'Ten velký, na ranní kafe.'], en: ['Onion pattern mug', 'The big one, for morning coffee.'] },
  { id: 'w2', owner: 'mum', url: '', price: { CZK: 1200, GBP: 45 }, pr: 'top', art: 'voucher', cs: ['Poukaz na masáž', 'Cokoliv kousek od domu.'], en: ['Massage voucher', 'Anywhere close to home.'] },
  { id: 'w3', owner: 'mum', url: 'https://www.example.com/socks', price: { CZK: 299, GBP: 12 }, pr: 'nice', art: 'socks', cs: ['Vlněné ponožky na spaní', 'Velikost 38 až 40, ideálně šedé.'], en: ['Wool bed socks', 'Size 5 to 7, grey if possible.'] },
  { id: 'w4', owner: 'mum', url: 'https://www.example.com/garden-book', price: { CZK: 399, GBP: 14 }, pr: 'nice', art: 'book', cs: ['Kniha o zahradě na balkoně', ''], en: ['A book about balcony gardens', ''] },
  { id: 'w5', owner: 'dad', url: 'https://www.example.com/earbuds', price: { CZK: 1990, GBP: 69 }, pr: 'top', art: 'headphones', cs: ['Bezdrátová sluchátka do uší', 'Ať slyším rádio i při sekání trávy.'], en: ['Wireless earbuds', 'So I can hear the radio while mowing.'] },
  { id: 'w6', owner: 'dad', url: 'https://www.example.com/headlamp', price: { CZK: 449, GBP: 18 }, pr: 'high', art: 'headlamp', cs: ['Čelovka do dílny', ''], en: ['Headlamp for the workshop', ''] },
  { id: 'w7', owner: 'dad', url: 'https://www.example.com/railways', price: { CZK: 549, GBP: 20 }, pr: 'nice', art: 'train', cs: ['Kniha o historii železnice', 'Tu s parní lokomotivou na obálce.'], en: ['A history of the railways', 'The one with the steam engine on the cover.'] },
  { id: 'w8', owner: 'sis', url: 'https://www.example.com/planner', price: { CZK: 329, GBP: 12 }, pr: 'high', art: 'planner', cs: ['Diář na příští rok', 'Týden na dvou stranách!'], en: ["Next year's planner", 'A week on two pages!'] },
  { id: 'w9', owner: 'sis', url: 'https://www.example.com/candle', price: { CZK: 390, GBP: 15 }, pr: 'nice', art: 'candle', cs: ['Svíčka s vůní jedle', ''], en: ['Fir scented candle', ''] },
  { id: 'w10', owner: 'sis', url: '', price: { CZK: 1800, GBP: 65 }, pr: 'top', art: 'pottery', cs: ['Kurz keramiky pro dva', 'S kýmkoliv z vás.'], en: ['Pottery class for two', 'With any of you.'] },
  { id: 'w11', owner: 'aunt', url: 'https://www.example.com/flowers', price: { CZK: 520, GBP: 20 }, pr: 'high', art: 'flowers', cs: ['Sušené květiny do vázy', 'Nějaké v teplých barvách.'], en: ['Dried flowers for a vase', 'Something in warm colours.'] },
  { id: 'w12', owner: 'aunt', url: 'https://www.example.com/blanket', price: { CZK: 799, GBP: 30 }, pr: 'nice', art: 'blanket', cs: ['Velká měkká deka', ''], en: ['A big soft blanket', ''] },
  { id: 'w13', owner: 'aunt', url: '', price: null, pr: 'top', art: 'tickets', cs: ['Lístky do divadla', 'Na cokoliv, hlavně spolu.'], en: ['Theatre tickets', 'Anything, as long as we go together.'] },
  { id: 'w14', owner: 'me', url: 'https://www.example.us/keyboard', price: { USD: 119 }, pr: 'top', art: 'keyboard', cs: ['Mechanická klávesnice', 'Tiché spínače, prosím.'], en: ['Mechanical keyboard', 'Quiet switches, please.'] },
  { id: 'w15', owner: 'me', url: 'https://www.example.com/thermos', price: { CZK: 599, GBP: 22 }, pr: 'high', art: 'thermos', cs: ['Termoska na kafe', 'Ať udrží kafe teplé celý den.'], en: ['Coffee thermos', 'One that keeps coffee hot all day.'] },
  { id: 'w16', owner: 'me', url: 'https://www.example.com/beanie', price: { CZK: 449, GBP: 16 }, pr: 'nice', art: 'beanie', cs: ['Vlněná čepice', 'Tmavě zelená.'], en: ['Wool beanie', 'Dark green.'] },
];

const CLAIMS: { wish: string; by: string[]; occ: 'xmas' | 'bday' }[] = [
  { wish: 'w2', by: ['dad'], occ: 'xmas' }, { wish: 'w5', by: ['sis', 'aunt'], occ: 'xmas' }, { wish: 'w9', by: ['mum'], occ: 'xmas' },
  { wish: 'w14', by: ['aunt'], occ: 'xmas' }, { wish: 'w12', by: ['me'], occ: 'xmas' }, { wish: 'w11', by: ['mum'], occ: 'bday' },
  { wish: 'w3', by: ['sis'], occ: 'bday' }, { wish: 'w15', by: ['dad'], occ: 'bday' },
];

export const DEMO_ME = 'me' as MemberId;

const seedPrice = (p: SeedPrice | null, home: Home) =>
  !p ? null : 'USD' in p ? { amount: p.USD, currency: 'USD' as Currency } : { amount: p[home], currency: home as Currency };

export function demoFamily(locale: Locale): Family {
  const { christmas, currency } = HOME[locale];
  const members: Member[] = MEMBERS.map(m => ({
    id: m.id as MemberId, ...NAMES[locale][m.id], lang: null, currency: currency as Currency, bday: { day: m.bday[0], month: m.bday[1] }, slot: m.slot,
    role: m.id === 'me' ? 'admin' : 'member', glass: m.glass, tilt: m.tilt, avatar: '', photo: null, look: m.look,
  }));
  const wishes: Wish[] = WISHES.map(w => ({
    id: w.id as WishId, owner: w.owner as MemberId, title: w[locale][0], note: w[locale][1], url: w.url,
    store: hostOf(w.url), price: seedPrice(w.price, currency),
    pr: w.pr, art: w.art, imageUrl: '', img: '', gone: null,
  }));
  const now = today();
  const claims: Claim[] = CLAIMS.flatMap((c, i) => {
    const owner = members.find(m => m.id === WISHES.find(w => w.id === c.wish)?.owner);
    const occ = occsFor(owner, now, christmas).find(o => o.kind === c.occ);
    return occ ? [{ id: ('democlaim' + String(i).padStart(6, '0')) as ClaimId, wish: c.wish as WishId, by: c.by as MemberId[], occ: occ.id, revealed: false }] : [];
  });
  return { christmas, members, wishes, claims };
}

/** No server: every call answers with what the optimistic UI already shows. */
export function demoStore(current: () => Family): Store {
  const invites: Invite[] = [];
  const unsupported = () => Promise.reject(new Error('not in demo'));
  const claimById = (id: ClaimId) => {
    const c = current().claims.find(x => x.id === id);
    return c ? Promise.resolve({ ...c, by: [...c.by] }) : Promise.reject({ status: 404, response: { code: 'claim_not_found' } });
  };
  return {
    kind: 'demo',
    restore: async () => ({ me: DEMO_ME }),
    login: unsupported,
    logout: () => location.reload(),
    checkInvite: async () => null,
    joinFamily: unsupported,
    loadAll: async () => current(),
    christmas: async () => current().christmas,
    setChristmas: async () => {},
    rates: async () => RATES,
    async updateProfile(me, p) {
      const m = current().members.find(x => x.id === me);
      if (!m) throw new Error('no member');
      return { ...m, name: p.name, voc: p.voc, ins: p.ins, gen: p.gen, bday: p.bday ?? m.bday };
    },
    async savePrefs(me, p) {
      const m = current().members.find(x => x.id === me);
      if (!m) throw new Error('no member');
      return { ...m, ...p };
    },
    claim: async (wish, occ, id) => ({ id, wish, by: [DEMO_ME], occ, revealed: false }),
    joinClaim: claimById,
    leaveClaim: async () => ({ claim: null, wishDeleted: false }),
    setOcc: async (id, occ) => ({ ...(await claimById(id)), occ }),
    reveal: async () => {},
    addWish: async (owner, d) => ({ ...d, id: randomId() as WishId, owner, img: '', gone: null }),
    async updateWish(id, p) {
      const w = current().wishes.find(x => x.id === id);
      if (!w) throw { status: 404, response: { code: 'wish_not_found' } };
      return { ...w, ...p };
    },
    commitOwnerOp: async () => {},
    preview: async () => null,
    listInvites: async () => invites,
    async createInvite(note, role) {
      const r: Invite = { id: randomId() as InviteId, token: (randomId() + randomId()).slice(0, 24), note, role, usedBy: null, expires: new Date(Date.now() + 30 * 86400000) };
      invites.unshift(r);
      return r;
    },
    async revokeInvite(id) { const i = invites.findIndex(x => x.id === id); if (i >= 0) invites.splice(i, 1); },
    subscribe: () => {},
  };
}
