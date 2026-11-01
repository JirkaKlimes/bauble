import { gsap } from 'gsap';
import { SvelteSet } from 'svelte/reactivity';
import { hideChrome, measureUi, showChrome } from './chrome';
import { activeClaim, pendingReveals, sceneClaims, wishById, type View } from './domain/claims';
import { genitive, instrumental, vocative } from './domain/czech';
import { addDays, allOccs, occsFor, sceneOcc, statusOn, today, type Day, type Mode } from './domain/occasions';
import { glassFor, randomId, tiltFor, type ClaimId, type Family, type InviteInfo, type Member, type MemberId, type Wish, type WishId } from './domain/types';
import { burst2D, setFxMode } from './fx2d';
import { errorText, failureOf, i18n, shortDate } from './i18n/index.svelte';
import { portraits } from './portraits.svelte';
import type { Scene } from './scene';
import { reduced } from './scene/util';
import { bell, jingle, pluck } from './sound';
import { demoFamily, demoStore, DEMO_ME } from './store/demo';
import { pocketbaseStore } from './store/pocketbase';
import type { OwnerOp, ProfilePatch, RemoteEvent, Store, WishDraft, WishPatch } from './store/store';

export type Phase = 'intro' | 'auth' | 'onboarding' | 'home' | 'focus';
export type OnboardFlow = { kind: 'join'; invite: InviteInfo } | { kind: 'edit' } | { kind: 'demo' };
export type Modal = { kind: 'auth'; screen: 'login' | 'invalid' } | { kind: 'onboard'; flow: OnboardFlow } | { kind: 'invites' };
export type Toast = { id: number; msg: string; action?: { label: string; run: () => void }; expire?: () => void };
export type TagAnim = 'wrap' | 'unwrap' | 'join' | 'occ' | 'new';

const TEMP = 'tmp';
const isTemp = (id: WishId) => id.startsWith(TEMP);
export const TM_SPAN = 365;

class App {
  readonly demo = new URLSearchParams(location.search).has('demo');
  store: Store;
  scene: Scene | null = null;

  family = $state<Family>({ members: [], wishes: [], claims: [] });
  me = $state<MemberId | null>(null);
  realToday = $state<Day>(today());
  simDay = $state<Day>(today());
  phase = $state<Phase>('intro');
  focus = $state<MemberId | null>(null);
  modal = $state<Modal | null>(null);
  toast = $state<Toast | null>(null);
  tmOpen = $state(false);
  editing = $state<WishId | null>(null);
  scrollToReveal = $state(false);
  /** Wishes the owner removed; the request waits until the undo window closes. */
  hidden = new SvelteSet<WishId>();
  private pendingOps = new Map<WishId, { op: OwnerOp; wish: Wish }>();
  tagAnim = new Map<WishId, TagAnim>();
  /** A saved wish keeps the list key of its optimistic copy, so its tag is not redrawn. */
  private keys = new Map<WishId, WishId>();
  keyOf = (id: WishId) => this.keys.get(id) ?? id;
  private afterIntro: (() => void) | null = null;
  private toastSeq = 0;
  private toastTimer = 0;

  status = $derived(statusOn(this.simDay, this.family.members));
  view: View = $derived({ family: this.family, me: this.me, day: this.simDay, hidden: this.hidden });
  previewing = $derived(this.simDay !== this.realToday);
  meMember = $derived(this.family.members.find(m => m.id === this.me));
  isAdmin = $derived(this.demo || this.meMember?.role === 'admin');
  pending = $derived(pendingReveals(this.view));

  constructor() {
    this.store = this.demo ? demoStore(() => this.family) : pocketbaseStore();
    addEventListener('pagehide', () => this.flushOps());
    // the system back gesture closes an open list instead of leaving the app
    if (history.state?.panel) history.replaceState(null, '');
    addEventListener('popstate', () => { if (this.phase === 'focus') this.closePanel(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.flushOps(); });
    setInterval(() => this.tickDay(), 60000);
    if (this.demo) i18n.onChange(() => this.resetDemo());
  }

  member = (id: MemberId) => this.family.members.find(m => m.id === id);
  wish = (id: WishId) => wishById(this.view, id);

  attachScene(s: Scene | null) {
    this.scene = s;
    if (!s) return;
    portraits.onChange((id, c) => s.setPortrait(id, c));
  }

  /** Keeps the scene in step with the derived status and claims. */
  syncScene(instant = false) {
    const s = this.scene, st = this.status;
    setFxMode(st.mode);
    document.documentElement.dataset.occ = st.mode;
    if (!s) return;
    const want = new Set(sceneClaims(this.view, st).map(c => c.wish));
    s.applyStatus(st, want, instant);
  }
  syncGifts() {
    const want = new Set(sceneClaims(this.view, this.status).map(c => c.wish));
    this.scene?.setGifts(want, this.phase === 'focus');
  }
  syncMembers(how: 'instant' | 'drop' | 'pop' = 'drop', delay = 0) {
    this.family.members.forEach(m => portraits.ensure(m));
    this.scene?.setMe(this.me);
    this.scene?.setMembers(this.sceneMembers(), how, delay);
  }
  private sceneMembers() { return this.family.members.map(m => ({ id: m.id, slot: m.slot, glass: m.glass, tilt: m.tilt })); }

  measure() { this.scene?.setUi(measureUi()); }

  showToast(msg: string, action?: Toast['action'], expire?: () => void) {
    const prev = this.toast;
    clearTimeout(this.toastTimer);
    this.toast = { id: ++this.toastSeq, msg, action, expire };
    prev?.expire?.();
    this.toastTimer = window.setTimeout(() => this.dismissToast(), action ? 6000 : 3200);
  }
  dismissToast(runAction = false) {
    const t = this.toast;
    if (!t) return;
    clearTimeout(this.toastTimer);
    this.toast = null;
    if (runAction) t.action?.run(); else t.expire?.();
  }
  toastError(err: unknown) { this.showToast(errorText(err)); }

  private guardWrite() {
    if (this.demo || !this.previewing) return true;
    this.showToast(i18n.t.toast.previewNoSave, { label: i18n.t.toast.backToToday, run: () => this.setSimDay(this.realToday) });
    return false;
  }

  async boot() {
    this.syncScene(true);
    hideChrome(true);
    if (this.demo) {
      this.me = DEMO_ME;
      this.family = demoFamily(i18n.locale);
      this.syncMembers('instant');
      this.syncScene(true);
      return this.playIntro();
    }
    const token = inviteToken();
    let session = null;
    try { session = await this.store.restore(); }
    catch {
      this.afterIntro = () => this.showToast(i18n.t.toast.serverDown);
      return this.playIntro();
    }
    if (token && !session) {
      const inv = await this.store.checkInvite(token).catch(() => null);
      this.afterIntro = inv ? () => this.startOnboarding({ kind: 'join', invite: inv }) : () => this.showAuth('invalid');
      return this.playIntro();
    }
    if (token) history.replaceState(null, '', '/');
    if (session) {
      try {
        this.me = session.me;
        await this.loadFamily();
        this.syncMembers('instant');
        this.syncScene(true);
        this.subscribe();
        return this.playIntro();
      } catch {
        this.me = null;
        this.afterIntro = () => this.showToast(i18n.t.toast.serverDown);
        return this.playIntro();
      }
    }
    this.afterIntro = () => this.showAuth('login');
    this.playIntro();
  }

  playIntro() {
    this.closePanel(true);
    this.phase = 'intro';
    hideChrome(true);
    this.measure();
    const done = () => {
      if (!this.me) { if (this.phase === 'intro') this.phase = 'auth'; }
      else { this.phase = 'home'; this.scene?.setInteraction('home'); }
      const f = this.afterIntro; this.afterIntro = null; f?.();
    };
    if (!this.scene) { if (this.me) showChrome(); return done(); }
    this.scene.playIntro(() => { if (this.me) { showChrome(); this.measure(); } }, done);
  }
  finishIntro() { this.scene?.finishIntro(); }

  private async loadFamily() {
    const f = await this.store.loadAll();
    this.family = f;
  }

  private subscribe() {
    this.store.subscribe(e => this.onRemote(e), () => void this.reconcile());
  }

  /** Re-fetches everything after a connection gap. */
  async reconcile() {
    if (this.demo || !this.me) return;
    try {
      await this.loadFamily();
      this.family.wishes = this.family.wishes.filter(w => !this.hidden.has(w.id) || this.pendingOps.has(w.id));
      this.syncMembers('drop');
      this.family.members.forEach(m => void portraits.load(m));
      this.syncScene();
      if (this.focus && !this.member(this.focus)) this.closePanel();
    } catch { /* the next reconnect tries again */ }
  }

  private onRemote(e: RemoteEvent) {
    const f = this.family;
    if (e.coll === 'users') {
      if (e.action === 'delete') {
        f.members = f.members.filter(m => m.id !== e.id);
        if (this.focus === e.id) this.closePanel();
      } else {
        const old = this.member(e.member.id);
        if (!old) {
          f.members.push(e.member);
          this.showToast(i18n.t.toast.joinedFamily(e.member.name)); bell(1318.5, 0, 0.1);
        } else {
          const avatarChanged = old.avatar !== e.member.avatar;
          Object.assign(old, e.member);
          if (avatarChanged && old.id !== this.me) void portraits.load(old);
          else portraits.redrawBase(old);
        }
      }
      this.syncMembers('drop');
      this.syncScene();
      return;
    }
    if (e.coll === 'wishes') {
      if (e.action === 'delete') f.wishes = f.wishes.filter(w => w.id !== e.id);
      else if (!this.pendingOps.has(e.wish.id)) this.upsertWish(e.wish);
    } else if (e.action === 'delete') f.claims = f.claims.filter(c => c.id !== e.id);
    else {
      const i = f.claims.findIndex(c => c.id === e.claim.id || c.wish === e.claim.wish);
      if (i >= 0) f.claims[i] = e.claim; else f.claims.push(e.claim);
    }
    this.syncGifts();
  }

  private upsertWish(w: Wish) {
    const ws = this.family.wishes;
    const i = ws.findIndex(x => x.id === w.id);
    if (i >= 0) { ws[i] = w; return; }
    // our own create echoed before the response: adopt the optimistic copy
    const t = ws.findIndex(x => isTemp(x.id) && x.owner === w.owner && x.title === w.title && x.url === w.url);
    if (t >= 0) { this.keys.set(w.id, ws[t].id); ws[t] = w; } else ws.push(w);
  }

  private tickDay() {
    const t = today();
    if (t === this.realToday) return;
    const wasToday = !this.previewing;
    this.realToday = t;
    if (wasToday) this.simDay = t;
    if (this.demo) this.syncScene(); else void this.reconcile();
  }

  setSimDay(n: number) {
    this.simDay = Math.max(this.realToday, Math.min(this.realToday + TM_SPAN, n)) as Day;
    this.syncScene();
  }

  showAuth(screen: 'login' | 'invalid') { this.phase = 'auth'; this.modal = { kind: 'auth', screen }; }

  async login(email: string, password: string) {
    this.me = await this.store.login(email, password);
    try {
      await this.loadFamily();
    } catch (err) { this.me = null; throw err; }
    this.modal = null;
    this.syncScene();
    this.syncMembers('drop', 0.35);
    this.family.members.forEach(m => void portraits.load(m));
    this.subscribe();
    this.phase = 'home'; this.scene?.setInteraction('home');
    setTimeout(() => { showChrome(); this.measure(); }, 500);
    bell(1318.5, 0.3, 0.1);
  }

  logout() { this.store.logout(); }

  openMember(id: MemberId, opts: { reveal?: boolean } = {}) {
    if (!this.member(id)) return;
    this.finishIntro(); this.tmOpen = false;
    const was = this.phase;
    if (was !== 'focus') history.pushState({ panel: true }, '');
    this.phase = 'focus'; this.focus = id; this.editing = null;
    this.scrollToReveal = !!opts.reveal;
    this.scene?.focus(id, was === 'focus');
    hideChrome();
    bell(id === this.me ? 1318.5 : 1174.7, 0, 0.07);
  }

  closePanel(instant = false) {
    if (this.phase !== 'focus') return;
    this.phase = 'home'; this.focus = null; this.editing = null;
    if (history.state?.panel) history.back();
    if (instant) { this.scene?.setInteraction('home'); return; }
    this.scene?.home();
    showChrome();
    this.measure();
  }

  async claim(wid: WishId, btn: HTMLElement) {
    if (!this.guardWrite() || !this.me) return;
    const v = this.view, w = this.wish(wid);
    if (!w || activeClaim(v, wid)) return;
    const occ = occsFor(this.member(w.owner), this.simDay)[0];
    const c = { id: randomId() as ClaimId, wish: wid, by: [this.me], occ: occ.id, revealed: false };
    const st = this.status, inScene = sceneOcc(st)?.id === occ.id;
    this.tagAnim.set(wid, 'wrap');
    this.family.claims.push(c);
    this.syncGifts();
    celebrate(btn, inScene ? '.gift-chip svg' : null, st.mode);
    this.showToast(i18n.t.toast.claimed(occLabel(occ.kind)));
    try {
      const saved = await this.store.claim(wid, occ.id, c.id);
      this.replaceClaim(c.id, saved);
    } catch (err) {
      this.family.claims = this.family.claims.filter(x => x.id !== c.id);
      const theirs = (err as { response?: { claim?: unknown } }).response?.claim;
      if (failureOf(err).code === 'claim_taken' && theirs) {
        await this.reconcile();
        this.showToast(i18n.t.toast.claimTaken);
      } else this.toastError(err);
      this.syncGifts();
    }
  }

  private replaceClaim(id: ClaimId, saved: Family['claims'][number]) {
    const cs = this.family.claims, i = cs.findIndex(x => x.id === id || x.id === saved.id);
    if (i >= 0) cs[i] = saved; else cs.push(saved);
  }

  async joinClaim(wid: WishId, btn: HTMLElement) {
    if (!this.guardWrite() || !this.me) return;
    const c = activeClaim(this.view, wid);
    if (!c || c.by.includes(this.me)) return;
    const prev = [...c.by];
    this.tagAnim.set(wid, 'join');
    c.by.push(this.me);
    celebrate(btn, null, this.status.mode);
    this.showToast(i18n.t.toast.together);
    try { this.replaceClaim(c.id, await this.store.joinClaim(c.id)); }
    catch (err) { c.by = prev; this.toastError(err); }
  }

  async release(wid: WishId) {
    if (!this.guardWrite() || !this.me) return;
    const me = this.me, c = activeClaim(this.view, wid), w = this.wish(wid);
    if (!c || !w) return;
    const prev = [...c.by], claims = this.family.claims, wishes = this.family.wishes;
    c.by = c.by.filter(x => x !== me);
    const emptied = !c.by.length;
    this.tagAnim.set(wid, 'unwrap');
    if (emptied) this.family.claims = claims.filter(x => x.id !== c.id);
    if (w.gone && emptied) { this.family.wishes = wishes.filter(x => x.id !== wid); this.showToast(i18n.t.toast.releasedGone); }
    else this.showToast(i18n.t.toast.released);
    this.syncGifts();
    bell(783.99, 0, 0.08);
    try {
      const r = await this.store.leaveClaim(c.id);
      if (r.wishDeleted) this.family.wishes = this.family.wishes.filter(x => x.id !== wid);
      if (r.claim) this.replaceClaim(r.claim.id, r.claim);
    } catch (err) {
      c.by = prev;
      this.family.claims = claims; this.family.wishes = wishes;
      this.syncGifts(); this.toastError(err);
    }
  }

  async switchOcc(wid: WishId) {
    if (!this.guardWrite()) return;
    const c = activeClaim(this.view, wid), w = this.wish(wid);
    if (!c || !w) return;
    const opts = occsFor(this.member(w.owner), this.simDay).slice(0, 2);
    const nx = opts[(opts.findIndex(o => o.id === c.occ) + 1) % opts.length];
    const prevOcc = c.occ;
    this.tagAnim.set(wid, 'occ');
    c.occ = nx.id;
    this.syncGifts();
    pluck(880, 0, 0.08);
    this.showToast(i18n.t.toast.moved(occLabel(nx.kind), shortDate(nx.day)));
    try { this.replaceClaim(c.id, await this.store.setOcc(c.id, nx.id)); }
    catch (err) { c.occ = prevOcc; this.syncGifts(); this.toastError(err); }
  }

  async addWish(d: WishDraft) {
    if (!this.guardWrite() || !this.me) return;
    const tmp: Wish = { ...d, id: (TEMP + randomId()) as WishId, owner: this.me, img: '', gone: null };
    this.tagAnim.set(tmp.id, 'new');
    this.family.wishes.push(tmp);
    this.showToast(i18n.t.toast.added); jingle(this.status.mode);
    try {
      const saved = await this.store.addWish(this.me, d);
      const ws = this.family.wishes;
      const i = ws.findIndex(x => x.id === tmp.id);
      this.keys.set(saved.id, tmp.id);
      if (ws.some(x => x.id === saved.id)) { if (i >= 0) ws.splice(i, 1); }
      else if (i >= 0) ws[i] = saved; else ws.push(saved);
    } catch (err) {
      this.family.wishes = this.family.wishes.filter(x => x.id !== tmp.id);
      this.toastError(err);
    }
  }

  async editWish(id: WishId, p: WishPatch) {
    if (!this.guardWrite()) return;
    const w = this.wish(id);
    if (!w) return;
    const prev = { ...w };
    Object.assign(w, p);
    this.showToast(i18n.t.toast.saved);
    try { Object.assign(w, await this.store.updateWish(id, p)); }
    catch (err) { Object.assign(w, prev); this.toastError(err); }
  }

  /** Delete and "I have it" go out late so the owner learns nothing from how the server answers. */
  ownerOp(id: WishId, op: OwnerOp, at: DOMRect | null) {
    if (!this.guardWrite()) return;
    const w = this.wish(id);
    if (!w || isTemp(id)) return;
    this.hidden.add(id);
    this.pendingOps.set(id, { op, wish: w });
    if (op === 'got') { if (at) burst2D(at.left + at.width / 2, at.top + at.height / 2, 22); pluck(1046.5, 0, 0.1); }
    this.syncGifts();
    this.showToast(op === 'delete' ? i18n.t.toast.deleted : i18n.t.toast.gotIt,
      { label: i18n.t.toast.undo, run: () => this.undoOp(id) },
      () => void this.commitOp(id));
  }

  private undoOp(id: WishId) {
    if (!this.pendingOps.delete(id)) return;
    this.tagAnim.set(id, 'new');
    this.hidden.delete(id);
    this.syncGifts();
  }

  private async commitOp(id: WishId) {
    const p = this.pendingOps.get(id);
    if (!p) return;
    this.pendingOps.delete(id);
    try {
      await this.store.commitOwnerOp(id, p.op);
      this.family.wishes = this.family.wishes.filter(w => w.id !== id);
      this.hidden.delete(id);
    } catch (err) {
      this.hidden.delete(id);
      this.toastError(err);
    }
  }

  private flushOps() {
    if (!this.pendingOps.size) return;
    if (this.toast?.expire) { const t = this.toast; this.toast = null; clearTimeout(this.toastTimer); t.expire?.(); }
    for (const id of [...this.pendingOps.keys()]) void this.commitOp(id);
  }

  revealDone() {
    if (!this.me) return;
    for (const c of pendingReveals(this.view)) c.revealed = true;
    if (!this.previewing) this.store.reveal().catch(() => {});
  }

  startOnboarding(flow: OnboardFlow) {
    this.finishIntro(); this.tmOpen = false;
    if (flow.kind !== 'edit') {
      this.closePanel(true);
      if (this.me) this.scene?.homeSoon(0.8);
      hideChrome(false, true);
      this.phase = 'onboarding';
      this.scene?.setInteraction('onboarding');
    }
    this.modal = { kind: 'onboard', flow };
  }

  cancelOnboarding() {
    const m = this.modal;
    this.modal = null;
    if (m?.kind === 'onboard' && m.flow.kind === 'edit') return;
    this.phase = 'home'; this.scene?.setInteraction('home');
    showChrome(); this.measure();
  }

  async saveProfile(p: ProfilePatch, shot: HTMLCanvasElement | null) {
    const me = this.meMember;
    if (!me) return;
    const upd = await this.store.updateProfile(me.id, p);
    const avatarChanged = upd.avatar !== me.avatar;
    Object.assign(me, { ...upd, look: me.look, glass: me.glass, tilt: me.tilt, photo: upd.photo ?? me.photo });
    if (shot) portraits.set(me.id, shot);
    else if (avatarChanged) void portraits.load(me);
    else portraits.redrawBase(me);
    this.modal = null;
    this.showToast(i18n.t.toast.profileSaved);
    this.syncScene();
  }

  async join(d: Parameters<Store['joinFamily']>[0], photo: Blob | null) {
    const r = await this.store.joinFamily(d, photo);
    this.me = r.me;
    history.replaceState(null, '', '/');
    await this.loadFamily();
    if (r.photoFailed) this.showToast(i18n.t.toast.photoFailed);
  }

  /** The demo's sign-up: a new member that exists only in this tab. */
  addDemoMember(name: string, voc: string, bday: { day: number; month: number }) {
    const used = new Set(this.family.members.map(x => x.slot));
    let slot = 0;
    while (used.has(slot) && slot < 11) slot++;
    const id = ('m' + Date.now().toString(36)) as MemberId;
    const m: Member = { id, name, voc: voc || vocative(name), ins: instrumental(name), gen: genitive(name), bday, slot, role: 'member', glass: glassFor(slot), tilt: tiltFor(slot), avatar: '', photo: null };
    this.family.members.push(m);
    this.me = id;
    return m;
  }

  /** Lays out the scene with the new member's spot still empty; returns that spot on screen. */
  beginHang(id: MemberId, joined: boolean) {
    this.phase = 'home';
    this.syncScene();
    this.scene?.setMe(this.me);
    this.family.members.forEach(m => { if (m.id !== id) portraits.ensure(m); });
    this.scene?.setMembers(this.sceneMembers(), joined ? 'drop' : 'instant', 0.2, id);
    return this.scene?.homeSpot(id) ?? null;
  }

  /** The photo landed: the ornament pops in and home takes over. */
  hung(joined: boolean) {
    this.syncMembers('pop');
    this.syncScene();
    jingle(this.status.mode);
    this.scene?.setInteraction('home');
    showChrome(); this.measure();
    this.showToast(i18n.t.toast.hung);
    if (joined) this.subscribe();
  }

  resetDemo() {
    if (!this.demo) return;
    this.modal = null;
    this.closePanel(true);
    portraits.clear();
    this.family = demoFamily(i18n.locale);
    this.me = DEMO_ME;
    this.simDay = this.realToday;
    this.hidden.clear();
    this.scene?.setMembers([], 'instant');
    this.syncMembers('instant');
    this.syncScene(true);
    this.playIntro();
  }

  jumpOcc(dir: 1 | -1) {
    const occs = allOccsAround(this);
    const cur = this.simDay;
    const t = dir > 0 ? occs.find(d => d > cur + 1) : [...occs].reverse().find(d => d < cur - 1);
    this.setSimDay(t ?? (dir < 0 ? this.realToday : cur));
  }

  sceneTap(kind: Mode) {
    const t = i18n.t.scene;
    this.showToast(kind === 'xmas' ? t.bell : kind === 'bday' ? t.candles : t.shootingStar);
  }
}

function allOccsAround(a: App) {
  return allOccs(a.family.members, a.realToday, addDays(a.realToday, TM_SPAN + 30))
    .map(o => o.day - 5).filter(d => d >= a.realToday && d <= a.realToday + TM_SPAN);
}

export const occLabel = (k: 'xmas' | 'bday') => (k === 'xmas' ? i18n.t.tag.forXmas : i18n.t.tag.forBday);

function inviteToken() {
  const m = location.pathname.match(/^\/i\/([a-z0-9]{24})\/?$/);
  return m ? m[1] : null;
}

/** Confetti from the button and, for a new gift, a little parcel flying to the counter. */
function celebrate(btn: HTMLElement, targetSel: string | null, mode: Mode) {
  const r = btn.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  burst2D(cx, cy, 40); jingle(mode);
  const target = targetSel ? document.querySelector(targetSel) : null;
  if (!target) return;
  const t = target.getBoundingClientRect();
  const g = document.createElement('div'); g.className = 'fly-gift';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'i');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#i-gift');
  svg.append(use); g.append(svg);
  document.body.append(g);
  const from = { x: cx - 15, y: cy - 15 }, to = { x: t.left + t.width / 2 - 15, y: t.top + t.height / 2 - 15 };
  const ctrl = { x: (from.x + to.x) / 2 + 60, y: Math.min(from.y, to.y) - 120 }, o = { p: 0 };
  gsap.to(o, { p: 1, duration: reduced ? 0.01 : 0.95, ease: 'power2.inOut',
    onUpdate: () => { const p = o.p, q = 1 - p; g.style.transform = `translate(${q * q * from.x + 2 * q * p * ctrl.x + p * p * to.x}px,${q * q * from.y + 2 * q * p * ctrl.y + p * p * to.y}px) scale(${1 - p * 0.35}) rotate(${p * 30}deg)`; },
    onComplete: () => { g.remove(); const b = document.getElementById('pGifts'); if (b) gsap.fromTo(b, { scale: 1.8 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' }); bell(2093, 0, 0.08); } });
}

export const app = new App();
