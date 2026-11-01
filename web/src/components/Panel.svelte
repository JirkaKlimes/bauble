<script lang="ts">
  import { gsap } from 'gsap';
  import { tick } from 'svelte';
  import { app } from '../lib/app.svelte';
  import { listFor, openWishesOf, sceneClaims, tagState } from '../lib/domain/claims';
  import { occsFor } from '../lib/domain/occasions';
  import type { MemberId } from '../lib/domain/types';
  import { i18n, longDate } from '../lib/i18n/index.svelte';
  import { SHEET_MED } from '../lib/scene/camera';
  import { clamp, isMobile, reduced } from '../lib/scene/util';
  import Archive from './Archive.svelte';
  import Avatar from './Avatar.svelte';
  import Composer from './Composer.svelte';
  import Icon from './Icon.svelte';
  import LangSwitch from './LangSwitch.svelte';
  import Reveal from './Reveal.svelte';
  import WishTag from './WishTag.svelte';

  type Detent = 'large' | 'medium' | 'closed';
  let panel = $state<HTMLElement>();
  let scroller = $state<HTMLElement>();
  let closeBtn = $state<HTMLButtonElement>();
  let shownId = $state<MemberId | null>(null);
  let open = $state(false);
  let detent = $state<Detent>('medium');
  let scrolled = $state(false);
  let tools = $state(false);

  const dim = () => document.getElementById('dim');
  const H = () => innerHeight;
  const geo = () => { const h = panel?.offsetHeight || H(); return { large: 0, medium: Math.max(0, h - Math.round(H() * SHEET_MED)), closed: h + 30 }; };
  const sheetY = () => (panel ? Number(gsap.getProperty(panel, 'y')) || 0 : 0);
  function setDim(y: number) {
    const g = geo(), t = clamp(1 - (y - g.large) / Math.max(1, g.closed - g.large), 0, 1), d = dim();
    if (d) d.style.opacity = (Math.min(1, t * 1.15) * 0.85).toFixed(3);
  }
  export function setDetent(d: Exclude<Detent, 'closed'>) {
    if (!panel) return;
    const target = geo()[d], from = sheetY();
    detent = d;
    gsap.killTweensOf(panel);
    gsap.to(panel, { y: target, duration: clamp(Math.abs(target - from) / 1700 + 0.28, 0.32, 0.62), ease: 'power3.out', onUpdate: () => setDim(sheetY()) });
  }

  async function show(animate: boolean) {
    open = true;
    await tick();
    if (!panel) return;
    gsap.killTweensOf(panel);
    if (isMobile()) {
      const g = geo();
      if (animate) { detent = 'medium'; gsap.fromTo(panel, { x: 0, y: g.closed }, { y: g.medium, duration: reduced ? 0.01 : 0.7, ease: 'expo.out', delay: 0.08, onUpdate: () => setDim(sheetY()) }); }
    } else {
      detent = 'large';
      dim()?.classList.add('on');
      if (animate && !reduced) gsap.fromTo(panel, { x: panel.offsetWidth + 48, y: 0 }, { x: 0, duration: 0.85, ease: 'expo.out', delay: 0.12 });
      else gsap.set(panel, { x: 0, y: 0 });
      setTimeout(() => closeBtn?.focus({ preventScroll: true }), animate ? 500 : 50);
    }
    stagger(animate ? 0.3 : 0.02);
    if (app.scrollToReveal) {
      app.scrollToReveal = false;
      setTimeout(() => { if (isMobile()) setDetent('large'); document.getElementById('reveal')?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }); }, 700);
    }
  }

  function stagger(delay: number) {
    if (reduced || !panel) return;
    gsap.from(panel.querySelectorAll('#tagList > li'), { y: 28, rotation: -5, opacity: 0, duration: 0.75, ease: 'back.out(1.6)', stagger: 0.07, delay, transformOrigin: '0% 50%', clearProps: 'transform,opacity' });
    gsap.from(panel.querySelectorAll('#composer, #reveal'), { y: 16, opacity: 0, duration: 0.6, ease: 'power3.out', delay: Math.max(0, delay - 0.08), clearProps: 'transform,opacity' });
    gsap.from(panel.querySelectorAll('.ph-who, .ph-sub'), { y: 10, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.05, delay: Math.max(0, delay - 0.15), clearProps: 'transform,opacity' });
  }

  function hide(instant: boolean, returnTo: MemberId | null) {
    const d = dim();
    d?.classList.remove('on');
    if (!panel || instant) { open = false; if (d) d.style.opacity = ''; if (panel) gsap.set(panel, { clearProps: 'transform' }); return; }
    gsap.killTweensOf(panel);
    const mob = isMobile(), p = panel;
    const done = () => { open = false; gsap.set(p, { clearProps: 'transform' }); if (d) d.style.opacity = ''; };
    if (mob) gsap.to(p, { y: geo().closed, duration: 0.42, ease: 'power3.in', onUpdate: () => setDim(sheetY()), onComplete: done });
    else {
      gsap.to(p, { x: p.offsetWidth + 48, duration: 0.45, ease: 'power3.in', onComplete: done });
      if (returnTo) setTimeout(() => (document.querySelector(`.blabel[data-member="${returnTo}"]`) as HTMLElement | null)?.focus({ preventScroll: true }), 50);
    }
  }

  let prev: MemberId | null = null;
  $effect(() => {
    const f = app.focus;
    if (f === prev) return;
    const was = prev;
    prev = f;
    if (f) { shownId = f; scrolled = false; tools = false; void show(!was); }
    else hide(app.phase !== 'home', was);
  });

  function onResize() {
    if (!open || !panel) return;
    if (isMobile()) gsap.set(panel, { x: 0, y: geo()[detent] ?? 0 }); else gsap.set(panel, { x: 0, y: 0 });
  }

  const rubber = (x: number, d = 0.55) => (1 - 1 / (x * d / 400 + 1)) * 400;
  type Drag = { y0: number; x0: number; start: number; mode: null | 'none' | 'scroll' | 'drag'; samples: [number, number][]; inScroll: boolean; field: boolean };
  let drag: Drag | null = null;

  function touchstart(e: TouchEvent) {
    if (!isMobile() || app.phase !== 'focus') return;
    const t = e.touches[0], el = e.target as Element;
    drag = { y0: t.clientY, x0: t.clientX, start: sheetY(), mode: null, samples: [[performance.now(), t.clientY]], inScroll: !!el.closest('.p-scroll'), field: !!el.closest('input,textarea,select') };
  }
  function touchmove(e: TouchEvent) {
    const d = drag;
    if (!d || !panel) return;
    const t = e.touches[0], dy = t.clientY - d.y0, dx = t.clientX - d.x0;
    if (!d.mode) {
      if (Math.abs(dy) < 7 && Math.abs(dx) < 7) return;
      if (Math.abs(dx) > Math.abs(dy)) { d.mode = 'none'; return; }
      if (detent === 'large' && d.inScroll && scroller && (scroller.scrollTop > 1 || dy < 0)) { d.mode = 'scroll'; return; }
      if (d.field && detent === 'large') { d.mode = 'scroll'; return; }
      d.mode = 'drag'; d.y0 = t.clientY; d.start = sheetY(); gsap.killTweensOf(panel);
    }
    if (d.mode !== 'drag') return;
    e.preventDefault();
    const g = geo();
    let y = d.start + (t.clientY - d.y0);
    if (y < g.large) y = g.large - rubber(g.large - y);
    gsap.set(panel, { y }); setDim(y);
    d.samples.push([performance.now(), t.clientY]); if (d.samples.length > 6) d.samples.shift();
  }
  function touchend() {
    const d = drag; drag = null;
    if (!d || d.mode !== 'drag') return;
    const s = d.samples, dtm = Math.max(1, s[s.length - 1][0] - s[0][0]), v = (s[s.length - 1][1] - s[0][1]) / dtm;
    const y = sheetY(), g = geo(), proj = y + v * 240;
    let target: Detent;
    if (proj > g.medium + (g.closed - g.medium) * 0.35 || (v > 1.1 && detent === 'medium')) target = detent === 'large' && v < 1.8 && proj < g.closed * 0.85 ? 'medium' : 'closed';
    else target = proj < (g.large + g.medium) / 2 ? 'large' : 'medium';
    if (target === 'closed') app.closePanel(); else setDetent(target);
  }
  function grabPointer(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || !isMobile() || !panel) return;
    const y0 = e.clientY, start = sheetY(), p = panel;
    let moved = false;
    const mv = (ev: PointerEvent) => { const dy = ev.clientY - y0; if (Math.abs(dy) > 4) moved = true; let y = start + dy; if (y < 0) y = -rubber(-y); gsap.set(p, { y }); setDim(y); };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (!moved) return;
      const y = sheetY(), g = geo();
      if (y > g.medium + (g.closed - g.medium) * 0.35) app.closePanel(); else setDetent(y < g.medium / 2 ? 'large' : 'medium');
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  const m = $derived(shownId ? app.member(shownId) : undefined);
  const mine = $derived(!!shownId && shownId === app.me);
  const list = $derived(shownId ? listFor(app.view, shownId) : []);
  const st = $derived(app.status);
  const cel = $derived(st.mode === 'bday' && st.occ.who === shownId);
  const nb = $derived(m ? occsFor(m, app.simDay).find(o => o.kind === 'bday') : undefined);
  const giftCount = $derived(sceneClaims(app.view, st).length);
  const count = $derived(shownId ? openWishesOf(app.view, shownId).length : 0);
  const t = $derived(i18n.t);

  function wishOut(node: HTMLElement) {
    if (reduced) return { duration: 0 };
    const h = node.offsetHeight;
    return {
      duration: 600,
      tick: (u: number) => {
        const k = 1 - u;
        const a = Math.min(1, k / 0.58), b = Math.max(0, (k - 0.58) / 0.42);
        node.style.transformOrigin = '0% 50%';
        node.style.transform = `translateX(${-50 * a}px) rotate(${-14 * a}deg)`;
        node.style.opacity = String(1 - a);
        node.style.height = b > 0 ? `${h * (1 - b)}px` : '';
        node.style.marginTop = b > 0 ? `${-20 * b}px` : '';
      },
    };
  }

  function detentAttr(d: Detent) { return isMobile() ? d : 'large'; }
</script>

<svelte:window onresize={onResize} />

<div
  class="panel"
  id="panel"
  role="dialog"
  aria-modal="false"
  aria-labelledby="pTitle"
  tabindex="-1"
  hidden={!open}
  bind:this={panel}
  data-detent={detentAttr(detent)}
  ontouchstart={touchstart}
  ontouchmove={touchmove}
  ontouchend={touchend}
  ontouchcancel={touchend}
>
  {#if m && shownId}
    <button class="grab" type="button" aria-label={t.panel.resize} onpointerdown={grabPointer}
      onclick={() => { if (isMobile()) setDetent(detent === 'large' ? 'medium' : 'large'); }}></button>
    <header class="ph" class:mine class:scrolled id="pHead">
      <div class="ph-row">
        <button class="icon-btn" id="pClose" type="button" aria-label={t.panel.close} bind:this={closeBtn} onclick={() => app.closePanel()}><Icon name="close" /></button>
        {#if app.family.members.length > 1}
          <nav class="strip" aria-label={t.panel.family}>
            {#each app.family.members as x (x.id)}
              <button type="button" data-member={x.id} aria-label="{x.name}{x.id === app.me ? ` ${t.you}` : ''}" aria-current={x.id === shownId}
                onclick={() => { if (x.id !== app.focus) app.openMember(x.id); }}><Avatar id={x.id} size="sm" /></button>
            {/each}
          </nav>
        {/if}
        {#if mine}
          <button class="icon-btn ph-tools-btn" type="button" aria-label={t.panel.tools} aria-expanded={tools} aria-controls="pTools" onclick={() => (tools = !tools)}><Icon name="more" /></button>
        {/if}
      </div>
      <div class="ph-who">
        <Avatar id={shownId} size="lg" />
        <h2 class="ph-title" id="pTitle"><span class="ph-kicker">{mine ? t.panel.yourWishes : t.panel.wishesFor}</span> <span class="ph-name" id="pName">{m.name}</span></h2>
      </div>
      <p class="ph-sub">
        {#if cel}
          <span class="cel-badge"><Icon name="cake" />{st.diff === 0 ? t.panel.celebratesToday : st.diff < 0 ? t.panel.wasYesterday : t.panel.celebrates(t.inDays(st.diff))}</span>
        {:else if nb}
          <span class="ph-bday"><Icon name="cake" />{t.panel.birthday(longDate(nb.day))}</span>
        {/if}
        <span id="pCount">{t.panel.count(count)}</span>
        {#if st.mode !== 'quiet'}
          <span class="gift-chip"><Icon name="gift" /><b id="pGifts">{giftCount}</b>&nbsp;{st.mode === 'xmas' ? t.panel.underTree : t.panel.forParty}</span>
        {/if}
      </p>
      {#if mine}
        <div class="ph-actions" id="pTools" class:open={tools}>
          <button class="pill-btn" type="button" data-pa="profile" onclick={() => app.startOnboarding({ kind: 'edit' })}><Icon name="pencil" />{t.panel.editProfile}</button>
          {#if app.isAdmin}
            <button class="pill-btn" type="button" data-pa="invite" onclick={() => (app.modal = { kind: 'invites' })}><Icon name="user-plus" />{t.panel.invite}</button>
          {/if}
          <LangSwitch />
        </div>
      {/if}
    </header>
    <div class="p-scroll" id="pScroll" bind:this={scroller} onscroll={() => (scrolled = (scroller?.scrollTop ?? 0) > 4)}>
      {#if mine}
        <Reveal />
        <Composer onfocusfield={() => { if (isMobile() && detent !== 'large') setDetent('large'); }} />
        <h3 class="sec-title">{t.panel.onList}</h3>
        <p class="ph-secret"><Icon name="sparkle" /><span>{st.mode === 'xmas' && st.phase !== 'after' ? t.panel.secretXmas : t.panel.secretParty}</span></p>
      {/if}
      <ul class="tags" id="tagList">
        {#each list as w, i (app.keyOf(w.id))}
          {@const ts = tagState(app.view, w)}
          <li class="tag-wrap" data-wish={w.id} data-state={ts} out:wishOut><WishTag {w} {i} kind={ts} /></li>
        {:else}
          <li class="empty">{mine ? t.panel.emptyMine : t.panel.emptyOther}</li>
        {/each}
      </ul>
      {#if mine}<Archive />{/if}
    </div>
  {/if}
</div>
