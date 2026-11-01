<script lang="ts">
  import { gsap } from 'gsap';
  import { tick, untrack } from 'svelte';
  import { app } from '../lib/app.svelte';
  import { HERO_PARTS, revealHero } from '../lib/chrome';
  import { sceneClaims } from '../lib/domain/claims';
  import type { Status } from '../lib/domain/occasions';
  import type { MemberId } from '../lib/domain/types';
  import { i18n, shortDate } from '../lib/i18n/index.svelte';
  import { reduced } from '../lib/scene/util';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';

  type Act = { kind: 'mine' } | { kind: 'reveal' } | { kind: 'open'; id: MemberId };
  type Btn = { label: string; icon?: string; act: Act };
  type Model = { kicker: string; head: string; sub: string; subDesk: boolean; count: { n: number; text: string } | null; primary: Btn; secondary: Btn | null; upcoming: boolean; long: boolean };

  function model(st: Status, me: MemberId): Model {
    const t = i18n.t, h = t.hero, m = app.member(me);
    const voc = m ? t.voc(m) : '', hi = h.hello(voc), pend = app.pending.length;
    const mine: Btn = { label: t.myWishes, icon: 'gift', act: { kind: 'mine' } };
    const M: Model = { kicker: '', head: hi, sub: '', subDesk: false, count: null, primary: mine, secondary: null, upcoming: false, long: false };
    const unwrap = () => { M.primary = { label: h.unwrap, icon: 'gift', act: { kind: 'reveal' } }; M.secondary = { label: t.myWishes, act: { kind: 'mine' } }; };
    if (st.mode === 'xmas') {
      if (st.phase === 'countdown') { M.sub = h.pickOrnament; M.subDesk = true; M.count = { n: st.diff, text: h.countXmas(st.diff) }; }
      else if (st.phase === 'day') { M.kicker = hi; M.head = h.xmasEve; M.sub = h.xmasEveSub; }
      else if (pend) { M.kicker = h.merryXmasVoc(voc); M.head = h.santaCame; M.sub = h.unwrapSub(pend); unwrap(); }
      else { M.kicker = hi; M.head = h.merryXmas; M.sub = h.afterXmasSub; }
    } else if (st.mode === 'bday') {
      const c = app.member(st.occ.who), cname = c?.name ?? '', isMe = st.occ.who === me;
      M.kicker = hi;
      if (st.phase === 'after') {
        M.head = h.partyOver;
        const nx = st.upcoming.find(u => u.diff > 0);
        if (isMe && pend) { M.sub = h.unwrapSub(pend); unwrap(); }
        else if (nx) M.sub = h.nextParty(t.inDays(nx.diff), nx.occ.kind === 'xmas' ? t.xmas : app.member(nx.occ.who)?.name ?? '');
      } else if (isMe) {
        M.head = st.diff === 0 ? h.happyBirthday(voc) : st.diff === 1 ? h.yourPartyTomorrow : h.yourPartyIn(st.diff);
        if (st.diff === 0) M.kicker = '';
        M.sub = st.diff === 0 ? h.yourDay : h.fillList;
      } else {
        M.head = st.diff === 0 ? h.celebratesToday(cname) : h.celebratesIn(cname, t.inDays(st.diff));
        M.sub = st.diff === 0 ? h.dontForget : '';
        M.primary = { label: h.whatWants(cname), icon: 'cake', act: { kind: 'open', id: st.occ.who } };
        M.secondary = { label: t.myWishes, act: { kind: 'mine' } };
      }
      M.long = M.head.length > 18;
    } else {
      M.sub = st.next ? h.quietNext(t.inDays(st.next.diff)) : h.quiet;
      M.upcoming = true;
    }
    return M;
  }

  const live = $derived(app.me ? model(app.status, app.me) : null);
  const gifts = $derived.by(() => {
    const st = app.status;
    if (st.mode === 'quiet' || (st.mode === 'xmas' && st.phase === 'after') || (st.mode === 'bday' && st.phase === 'after')) return '';
    const n = sceneClaims(app.view, st).length;
    return st.mode === 'xmas' ? i18n.t.hero.giftsXmas(n) : i18n.t.hero.giftsBday(n);
  });
  const sig = (m: Model | null) => JSON.stringify(m && [m.kicker, m.head, m.sub, m.primary, m.secondary, m.upcoming]);

  let shown = $state<Model | null>(null);
  let shownSig = '';
  let upEl = $state<HTMLElement>();
  let overflow = $state(false);

  $effect(() => {
    const next = live, s = sig(next);
    if (s === shownSig) { shown = next; return; }
    shownSig = s;
    const hero = document.getElementById('hero');
    if (!untrack(() => shown) || reduced || !hero?.classList.contains('on')) { shown = next; return; }
    gsap.killTweensOf(HERO_PARTS);
    gsap.to(HERO_PARTS, { opacity: 0, y: -10, filter: 'blur(6px)', duration: 0.35, stagger: 0.03, ease: 'power2.in', onComplete: () => {
      shown = next;
      void tick().then(() => {
        gsap.set(HERO_PARTS, { opacity: 1, y: 0, filter: 'blur(0px)' });
        app.measure();
        revealHero(0.15);
      });
    } });
  });

  $effect(() => {
    void shown;
    tick().then(() => { app.measure(); overflow = !!upEl && upEl.scrollWidth > upEl.clientWidth + 4; });
  });

  function run(a: Act) {
    if (!app.me) return;
    if (a.kind === 'mine') app.openMember(app.me);
    else if (a.kind === 'reveal') app.openMember(app.me, { reveal: true });
    else app.openMember(a.id);
  }

  const upcoming = $derived(app.status.upcoming.slice(0, 3));
</script>

<section class="hero" id="hero" aria-live="polite">
  <p class="hero-count" id="heroCount">{#if shown?.count}<b>{shown.count.n}</b><span>{shown.count.text}</span>{/if}</p>
  <p class="hero-kicker" id="heroKicker" hidden={!shown?.kicker}>{shown?.kicker ?? ''}</p>
  <h1 class="hello foil" class:long={shown?.long} id="hello">{shown?.head ?? ''}</h1>
  <p class="hero-sub" class:desk={shown?.subDesk} id="heroSub">{shown?.sub ?? ''}</p>
  <div class="upcoming" class:overflow id="upcoming" hidden={!shown?.upcoming} bind:this={upEl}>
    {#if shown?.upcoming}
      {#each upcoming as u (u.occ.id)}
        {@const when = `${shortDate(u.occ.day)}, ${i18n.t.inDays(u.diff)}`}
        {#if u.occ.kind === 'xmas'}
          <span class="up-chip"><span class="xi"><Icon name="star" /></span><span><b>{i18n.t.xmas}</b><span>{when}</span></span></span>
        {:else}
          {@const who = u.occ.who}
          <button class="up-chip" type="button" onclick={() => app.openMember(who)}>
            <Avatar id={who} /><span><b>{app.member(who)?.name ?? ''}{who === app.me ? ` ${i18n.t.you}` : ''}</b><span>{when}</span></span>
          </button>
        {/if}
      {/each}
    {/if}
  </div>
  <div class="hero-row" id="heroRow">
    {#if shown}
      {@const p = shown.primary}
      <button class="btn-gold" type="button" onclick={() => run(p.act)}>{#if p.icon}<Icon name={p.icon} />{/if}{p.label}</button>
      {#if shown.secondary}
        {@const s = shown.secondary}
        <button class="btn-ghost" type="button" onclick={() => run(s.act)}>{s.label}</button>
      {/if}
      <span class="gifts-line" id="giftsLine">{#if gifts}<Icon name="gift" /><span>{gifts}</span>{/if}</span>
    {/if}
  </div>
</section>
