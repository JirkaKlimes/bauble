import { occDay, type Day, type Status } from './occasions';
import { PRIORITY_ORDER, type Claim, type Family, type MemberId, type Wish, type WishId } from './types';

/** What one viewer sees on one day. `hidden` are wishes the owner removed locally but not yet sent. */
export type View = { family: Family; me: MemberId | null; day: Day; hidden: ReadonlySet<WishId> };

export type TagState = 'owner' | 'gone' | 'free' | 'mine' | 'others';

export const isFulfilled = (v: View, c: Claim) => occDay(c.occ, v.family) < v.day;
export const wishById = (v: View, id: WishId) => v.family.wishes.find(w => w.id === id);
export const activeClaim = (v: View, wid: WishId) => v.family.claims.find(c => c.wish === wid && !isFulfilled(v, c));
const wishDone = (v: View, wid: WishId) => v.family.claims.some(c => c.wish === wid && isFulfilled(v, c));

export const openWishesOf = (v: View, owner: MemberId) =>
  v.family.wishes
    .filter(w => w.owner === owner && !w.gone && !v.hidden.has(w.id) && !wishDone(v, w.id))
    .sort((a, b) => PRIORITY_ORDER[a.pr] - PRIORITY_ORDER[b.pr]);

/** The open wishes, plus withdrawn ones the viewer is still buying. */
export function listFor(v: View, owner: MemberId): Wish[] {
  const open = openWishesOf(v, owner);
  if (owner === v.me) return open;
  const gone = v.family.wishes.filter(w => w.owner === owner && w.gone && v.me && activeClaim(v, w.id)?.by.includes(v.me));
  return [...gone, ...open];
}

export function tagState(v: View, w: Wish): TagState {
  if (w.owner === v.me) return 'owner';
  if (w.gone) return 'gone';
  const c = activeClaim(v, w.id);
  return !c ? 'free' : v.me && c.by.includes(v.me) ? 'mine' : 'others';
}

export const fulfilledFor = (v: View, owner: MemberId) =>
  v.family.claims
    .filter(c => isFulfilled(v, c) && wishById(v, c.wish)?.owner === owner)
    .sort((a, b) => occDay(b.occ, v.family) - occDay(a.occ, v.family));

export const pendingReveals = (v: View) => (v.me ? fulfilledFor(v, v.me).filter(c => !c.revealed) : []);

export function sceneClaims(v: View, st: Status): Claim[] {
  if (st.mode === 'quiet') return [];
  return v.family.claims.filter(c => {
    if (c.occ !== st.occ.id) return false;
    const w = wishById(v, c.wish);
    return !!w && !w.gone && !v.hidden.has(w.id);
  });
}
