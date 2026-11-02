import type { Currency, Rates } from '../domain/money';
import type {
  Birthday, Christmas, Claim, ClaimId, Family, Invite, InviteId, InviteInfo, Locale, Member, MemberId, OccId, Preview, Priority, Role, Wish, WishId,
} from '../domain/types';

export type WishDraft = Pick<Wish, 'title' | 'url' | 'store' | 'price' | 'note' | 'pr' | 'art' | 'imageUrl'>;
export type WishPatch = Partial<Pick<Wish, 'title' | 'price' | 'note' | 'pr' | 'art'>>;

/** `bday` is null once a birthday is set: only an admin can move it, or the owner could move their own reveal. */
export type ProfilePatch = { name: string; voc: string; ins: string; gen: string; bday: Birthday | null; photo: Blob | null };
/** The server prefers the inviter's currency over `currency`, the browser's guess. */
export type JoinData = {
  token: string; name: string; voc: string; ins: string; gen: string; email: string; password: string; bday: Birthday;
  lang: Locale; currency: Currency;
};
export type Prefs = { lang: Locale; currency: Currency };

export type LeaveResult = { claim: Claim | null; wishDeleted: boolean };

/** What the owner decided about a wish; sent late so nobody learns from the timing who is buying it. */
export type OwnerOp = 'delete' | 'got';

export type RemoteEvent =
  | { coll: 'users'; action: 'upsert'; member: Member }
  | { coll: 'users'; action: 'delete'; id: MemberId }
  | { coll: 'wishes'; action: 'upsert'; wish: Wish }
  | { coll: 'wishes'; action: 'delete'; id: WishId }
  | { coll: 'claims'; action: 'upsert'; claim: Claim }
  | { coll: 'claims'; action: 'delete'; id: ClaimId }
  | { coll: 'family'; christmas: Christmas };

export type Session = { me: MemberId } | null;

export interface Store {
  readonly kind: 'pb' | 'demo';
  restore(): Promise<Session>;
  login(email: string, password: string): Promise<MemberId>;
  logout(): void;
  checkInvite(token: string): Promise<InviteInfo | null>;
  joinFamily(d: JoinData, photo: Blob | null): Promise<{ me: MemberId; photoFailed: boolean }>;
  loadAll(): Promise<Family>;
  /** Readable without an account: the login screen dresses up for Christmas too. */
  christmas(): Promise<Christmas>;
  setChristmas(c: Christmas): Promise<void>;
  /** Reference rates; empty when the server has none. */
  rates(): Promise<Rates>;
  updateProfile(me: MemberId, p: ProfilePatch): Promise<Member>;
  savePrefs(me: MemberId, p: Partial<Prefs>): Promise<Member>;

  claim(wish: WishId, occ: OccId, id: ClaimId): Promise<Claim>;
  joinClaim(id: ClaimId): Promise<Claim>;
  leaveClaim(id: ClaimId): Promise<LeaveResult>;
  setOcc(id: ClaimId, occ: OccId): Promise<Claim>;
  reveal(): Promise<void>;

  addWish(owner: MemberId, d: WishDraft): Promise<Wish>;
  updateWish(id: WishId, p: WishPatch): Promise<Wish>;
  commitOwnerOp(id: WishId, op: OwnerOp): Promise<void>;
  preview(url: string): Promise<Preview | null>;

  listInvites(): Promise<Invite[]>;
  createInvite(note: string, role: Role): Promise<Invite>;
  revokeInvite(id: InviteId): Promise<void>;

  subscribe(onEvent: (e: RemoteEvent) => void, onReconnect: () => void): void;
}

export const PRIORITY_DEFAULT: Priority = 'high';
