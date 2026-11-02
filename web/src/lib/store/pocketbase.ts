import PocketBase, { type RecordModel } from 'pocketbase';
import { isCurrency, type Currency, type Money, type Rates } from '../domain/money';
import { isOccId } from '../domain/occasions';
import {
  glassFor, isArt, isChristmas, isLocale, PRIORITIES, tiltFor,
  type Christmas, type Claim, type ClaimId, type Invite, type InviteId, type Member, type MemberId, type Priority, type Wish, type WishId,
} from '../domain/types';
import { PRIORITY_DEFAULT, type RemoteEvent, type Store, type WishPatch } from './store';

const FAMILY = 'family000000000';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);
const money = (amount: unknown, currency: unknown): Money | null =>
  typeof amount === 'number' && amount > 0 && isCurrency(currency) ? { amount, currency } : null;
const christmasOf = (r: RecordModel): Christmas => (isChristmas(r.christmas) ? r.christmas : 'eve');
/** The server stores a price and its currency together, or neither. */
const priceFields = (m: Money | null) => ({ price: m?.amount ?? 0, currency: m?.currency ?? '' });
const pbDate = (v: unknown) => { const s = str(v); if (!s) return null; const d = new Date(s.replace(' ', 'T')); return Number.isNaN(+d) ? null : d; };

class HttpError extends Error {
  constructor(readonly status: number, readonly response: unknown) { super(`HTTP ${status}`); }
}

export function pocketbaseStore(): Store {
  const pb = new PocketBase(location.origin);
  pb.autoCancellation(false);
  let fileToken = '';
  let subscribed = false;

  const photoUrl = (r: RecordModel) => (r.avatar ? pb.files.getURL(r, str(r.avatar), { thumb: '512x512', token: fileToken }) : null);
  const refreshToken = async () => { fileToken = await pb.files.getToken().catch(() => fileToken); };
  // file tokens last a day (see the hardening migration); new image URLs must not carry an expired one
  setInterval(() => { if (pb.authStore.isValid) void refreshToken(); }, 60 * 60 * 1000);

  function member(r: RecordModel): Member {
    const slot = int(r.slot), name = str(r.name) || '?';
    const d = int(r.bday_day), m = int(r.bday_month);
    return {
      id: r.id as MemberId, name, voc: str(r.voc), ins: str(r.ins), gen: str(r.gen),
      lang: isLocale(r.lang) ? r.lang : null, currency: str(r.currency) as Currency,
      bday: d >= 1 && d <= 31 && m >= 1 && m <= 12 ? { day: d, month: m } : null,
      slot, role: r.role === 'admin' ? 'admin' : 'member', glass: glassFor(slot), tilt: tiltFor(slot),
      avatar: str(r.avatar), photo: photoUrl(r),
    };
  }
  function wish(r: RecordModel): Wish {
    const pr = PRIORITIES.includes(r.pr as Priority) ? (r.pr as Priority) : PRIORITY_DEFAULT;
    const art = str(r.art);
    return {
      id: r.id as WishId, owner: str(r.owner) as MemberId, title: str(r.title), url: str(r.url), store: str(r.store),
      price: money(r.price, r.currency), note: str(r.note), pr, art: isArt(art) ? art : 'gift', imageUrl: str(r.image_url),
      img: r.image ? pb.files.getURL(r, str(r.image), { thumb: '160x160', token: fileToken }) : '',
      gone: r.gone === 'deleted' || r.gone === 'got' ? r.gone : null,
    };
  }
  function claim(r: RecordModel): Claim | null {
    const occ = str(r.occ);
    if (!isOccId(occ)) return null;
    return { id: r.id as ClaimId, wish: str(r.wish) as WishId, by: Array.isArray(r.by) ? r.by.map(x => str(x) as MemberId) : [], occ, revealed: !!r.revealed };
  }
  const claimOrThrow = (r: RecordModel) => { const c = claim(r); if (!c) throw new HttpError(500, null); return c; };
  function invite(r: RecordModel): Invite {
    return { id: r.id as InviteId, token: str(r.token), note: str(r.note), role: r.role === 'admin' ? 'admin' : 'member', usedBy: (str(r.used_by) || null) as MemberId | null, expires: pbDate(r.expires) };
  }

  const api = <T = RecordModel>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, string> } = {}) =>
    pb.send<T>(path, { method: opts.method ?? 'GET', body: opts.body, query: opts.query });

  return {
    kind: 'pb',
    async restore() {
      if (!pb.authStore.isValid) return null;
      try {
        await pb.collection('users').authRefresh();
        const rec = pb.authStore.record;
        return rec ? { me: rec.id as MemberId } : null;
      } catch (err) {
        if ((err as { status?: number }).status !== 0) pb.authStore.clear();
        throw err;
      }
    },
    async login(email, password) {
      const r = await pb.collection('users').authWithPassword(email, password);
      return r.record.id as MemberId;
    },
    logout() {
      pb.realtime.unsubscribe().catch(() => {});
      pb.authStore.clear();
      location.replace('/');
    },
    async checkInvite(token) {
      try {
        const r = await api<{ ok?: boolean; note?: unknown; role?: unknown }>(`/api/bauble/invite/${encodeURIComponent(token)}`);
        return r.ok ? { token, note: str(r.note), role: r.role === 'admin' ? 'admin' : 'member' } : null;
      } catch (err) {
        if ((err as { status?: number }).status === 404) return null;
        throw err;
      }
    },
    async joinFamily(d, photo) {
      const res = await api<{ token: string; record: RecordModel }>('/api/bauble/join', {
        method: 'POST',
        body: {
          token: d.token, name: d.name, voc: d.voc, ins: d.ins, gen: d.gen, email: d.email, password: d.password,
          bday_day: d.bday.day, bday_month: d.bday.month, lang: d.lang, currency: d.currency,
        },
      });
      pb.authStore.save(res.token, res.record);
      let photoFailed = false;
      if (photo) {
        const fd = new FormData();
        fd.append('avatar', photo, 'avatar.jpg');
        await pb.collection('users').update(res.record.id, fd).catch(() => { photoFailed = true; });
      }
      return { me: res.record.id as MemberId, photoFailed };
    },
    async loadAll() {
      await refreshToken();
      const [family, users, wishes, claims] = await Promise.all([
        pb.collection('family').getOne(FAMILY),
        pb.collection('users').getFullList({ sort: 'slot,created' }),
        pb.collection('wishes').getFullList({ sort: 'created' }),
        pb.collection('claims').getFullList(),
      ]);
      return { christmas: christmasOf(family), members: users.map(member), wishes: wishes.map(wish), claims: claims.flatMap(r => claim(r) ?? []) };
    },
    christmas: async () => christmasOf(await pb.collection('family').getOne(FAMILY)),
    setChristmas: async christmas => { await api('/api/bauble/family', { method: 'POST', body: { christmas } }); },
    async rates() {
      const r = await api<{ rates?: unknown }>('/api/bauble/rates');
      const out: Partial<Record<Currency, number>> = {};
      for (const [c, v] of Object.entries(r.rates ?? {})) if (isCurrency(c) && typeof v === 'number' && v > 0) out[c] = v;
      return out as Rates;
    },
    async updateProfile(me, p) {
      const fd = new FormData();
      fd.append('name', p.name); fd.append('voc', p.voc); fd.append('ins', p.ins); fd.append('gen', p.gen);
      if (p.bday) { fd.append('bday_day', String(p.bday.day)); fd.append('bday_month', String(p.bday.month)); }
      if (p.photo) fd.append('avatar', p.photo, 'avatar.jpg');
      const r = await pb.collection('users').update(me, fd);
      await refreshToken();
      return member(r);
    },
    savePrefs: async (me, p) => member(await pb.collection('users').update(me, p)),

    claim: async (wishId, occ, id) => claimOrThrow(await api('/api/bauble/claims', { method: 'POST', body: { wish: wishId, occ, id } })),
    joinClaim: async id => claimOrThrow(await api(`/api/bauble/claims/${id}/join`, { method: 'POST' })),
    async leaveClaim(id) {
      const r = await api<{ claim: RecordModel | null; wishDeleted?: boolean }>(`/api/bauble/claims/${id}/leave`, { method: 'POST' });
      return { claim: r.claim ? claim(r.claim) : null, wishDeleted: !!r.wishDeleted };
    },
    setOcc: async (id, occ) => claimOrThrow(await api(`/api/bauble/claims/${id}/occ`, { method: 'POST', body: { occ } })),
    reveal: async () => { await api('/api/bauble/reveal', { method: 'POST' }); },

    addWish: async (owner, d) => wish(await pb.collection('wishes').create({
      owner, title: d.title, url: d.url, store: d.store, ...priceFields(d.price), note: d.note, pr: d.pr, art: d.art, image_url: d.imageUrl,
    })),
    updateWish: async (id, { price, ...rest }: WishPatch) =>
      wish(await pb.collection('wishes').update(id, { ...rest, ...(price !== undefined && priceFields(price)) })),
    async commitOwnerOp(id, op) {
      // keepalive lets the request finish while the page unloads
      const res = await fetch(`/api/collections/wishes/records/${encodeURIComponent(id)}`, {
        method: op === 'delete' ? 'DELETE' : 'PATCH',
        headers: { Authorization: pb.authStore.token, ...(op === 'got' ? { 'Content-Type': 'application/json' } : {}) },
        body: op === 'got' ? JSON.stringify({ gone: 'got' }) : undefined,
        keepalive: true,
      });
      if (!res.ok) throw new HttpError(res.status, await res.json().catch(() => null));
    },
    async preview(url) {
      const r = await api<{ ok?: boolean; title?: unknown; image?: unknown; price?: unknown; currency?: unknown }>('/api/bauble/preview', { query: { url } }).catch(() => null);
      if (!r?.ok) return null;
      const amount = typeof r.price === 'number' && r.price > 0 ? r.price : null;
      return { title: str(r.title), image: str(r.image), price: amount ? { amount, currency: isCurrency(r.currency) ? r.currency : null } : null };
    },

    listInvites: async () => (await pb.collection('invites').getFullList({ sort: '-created' })).map(invite),
    createInvite: async (note, role) => invite(await pb.collection('invites').create({ note, role })),
    revokeInvite: async id => { await pb.collection('invites').delete(id); },

    subscribe(onEvent: (e: RemoteEvent) => void, onReconnect) {
      if (subscribed) return;
      subscribed = true;
      const del = (a: string) => a === 'delete';
      pb.collection('users').subscribe('*', e => {
        if (del(e.action)) return onEvent({ coll: 'users', action: 'delete', id: e.record.id as MemberId });
        // a new avatar needs a fresh file token before the photo URL works
        (e.record.avatar ? refreshToken() : Promise.resolve()).then(() => onEvent({ coll: 'users', action: 'upsert', member: member(e.record) }));
      }).catch(() => {});
      pb.collection('wishes').subscribe('*', e =>
        onEvent(del(e.action) ? { coll: 'wishes', action: 'delete', id: e.record.id as WishId } : { coll: 'wishes', action: 'upsert', wish: wish(e.record) })).catch(() => {});
      pb.collection('claims').subscribe('*', e => {
        if (del(e.action)) return onEvent({ coll: 'claims', action: 'delete', id: e.record.id as ClaimId });
        const c = claim(e.record);
        if (c) onEvent({ coll: 'claims', action: 'upsert', claim: c });
      }).catch(() => {});
      pb.collection('family').subscribe(FAMILY, e => onEvent({ coll: 'family', christmas: christmasOf(e.record) })).catch(() => {});
      let connects = 0;
      pb.realtime.subscribe('PB_CONNECT', () => { if (connects++ > 0) onReconnect(); }).catch(() => {});
    },
  };
}
