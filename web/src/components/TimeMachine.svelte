<script lang="ts">
  import { gsap } from 'gsap';
  import { tick } from 'svelte';
  import { app, TM_SPAN } from '../lib/app.svelte';
  import { addDays, allOccs, dateOf, statusOn, type Day, type Mode, type Status } from '../lib/domain/occasions';
  import { fullDate, i18n, longDate, monthShort } from '../lib/i18n/index.svelte';
  import { isMobile, reduced } from '../lib/scene/util';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';

  let el = $state<HTMLElement>(), range = $state<HTMLInputElement>();
  let visible = $state(false);
  let timer = 0;
  const t = $derived(i18n.t.tm);
  const today = $derived(app.realToday);

  const track = $derived.by(() => {
    const ms = app.family.members, bands: { mode: Mode; a: number; b: number }[] = [], months: [number, string][] = [];
    let run: { mode: Mode; a: number; b: number } | null = null;
    for (let i = 0; i <= TM_SPAN; i++) {
      const mode = statusOn(addDays(today, i), ms).mode;
      if (!run || run.mode !== mode) { if (run) bands.push(run); run = { mode, a: i, b: i }; } else run.b = i;
      const d = addDays(today, i);
      if (dateOf(d).getDate() === 1) months.push([i, monthShort(d)]);
    }
    if (run) bands.push(run);
    return { bands, months: months.filter((_, i) => i % (innerWidth < 420 ? 2 : 1) === 0), marks: allOccs(ms, today, addDays(today, TM_SPAN)) };
  });
  const pct = (i: number) => (i / TM_SPAN * 100).toFixed(3) + '%';

  let shownDay = $state<Day>(app.simDay);
  $effect(() => { shownDay = app.simDay; });
  const v = $derived(shownDay - today);
  const st = $derived(statusOn(shownDay, app.family.members));

  function badge(s: Status): { icon: string; text: string } {
    if (s.mode === 'xmas') return { icon: 'star', text: s.phase === 'countdown' ? t.xmasIn(i18n.t.inDays(s.diff)) : s.phase === 'day' ? t.xmasEve : t.afterXmas };
    if (s.mode === 'bday') { const n = app.member(s.occ.who)?.name ?? ''; return { icon: 'cake', text: s.phase === 'after' ? t.afterParty(n) : t.celebrates(n, i18n.t.inDays(s.diff)) }; }
    return { icon: 'moon', text: t.quiet };
  }
  const b = $derived(badge(st));

  $effect(() => {
    const open = app.tmOpen;
    if (open && !visible) {
      if (app.phase === 'focus') app.closePanel();
      app.finishIntro();
      visible = true;
      if (isMobile()) gsap.to('#hero', { opacity: 0, duration: 0.25 });
      void tick().then(() => {
        if (!reduced && el) gsap.fromTo(el, { opacity: 0, y: 14, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' });
        setTimeout(() => range?.focus({ preventScroll: true }), 60);
      });
    } else if (!open && visible && el) {
      const e = el;
      gsap.to(e, { opacity: 0, y: 10, scale: 0.98, duration: 0.22, ease: 'power2.in', onComplete: () => { visible = false; gsap.set(e, { clearProps: 'all' }); } });
      if (isMobile() && app.phase === 'home') gsap.to('#hero', { opacity: 1, duration: 0.35 });
    }
  });

  function input(e: Event) {
    shownDay = addDays(today, +(e.currentTarget as HTMLInputElement).value);
    clearTimeout(timer);
    timer = window.setTimeout(() => app.setSimDay(shownDay), 320);
  }
  function now(n: number) { clearTimeout(timer); app.setSimDay(n); }

  function demoAct(k: 'intro' | 'join' | 'reset') {
    app.tmOpen = false;
    if (k === 'intro') app.playIntro();
    else if (k === 'join') { if (app.demo) app.startOnboarding({ kind: 'demo' }); else app.modal = { kind: 'invites' }; }
    else app.resetDemo();
  }
  function outside(e: PointerEvent) {
    if (app.tmOpen && !(e.target as Element).closest('#tmWrap, .icon-btn.mob')) app.tmOpen = false;
  }
</script>

<svelte:document onpointerdown={outside} />
<svelte:window onkeydown={e => { if (e.key === 'Escape' && app.tmOpen) app.tmOpen = false; }} />

<div class="tm-wrap" id="tmWrap" hidden={!app.isAdmin || !app.me}>
  {#if visible}
    <div class="tm" id="tm" role="dialog" aria-labelledby="tmTitle" bind:this={el}>
      <div class="tm-head">
        <div><h2 id="tmTitle">{t.title}</h2><p>{t.lead}</p></div>
        <button class="icon-btn" id="tmClose" type="button" aria-label={t.close} onclick={() => (app.tmOpen = false)}><Icon name="close" /></button>
      </div>
      <div class="tm-now"><b id="tmDate">{v === 0 ? t.today(longDate(shownDay)) : fullDate(shownDay)}</b><span class="tm-badge" id="tmBadge"><Icon name={b.icon} />{b.text}</span></div>
      <div class="tm-track">
        <div class="tm-marks">
          {#each track.marks as o (o.id)}
            <span class="tm-mark" style:left={pct(o.day - today)}>{#if o.kind === 'xmas'}<span class="xi"><Icon name="star" /></span>{:else}<Avatar id={o.who} />{/if}<i></i></span>
          {/each}
        </div>
        <div class="tm-bands">{#each track.bands as bd (bd.a)}<span class="b-{bd.mode}" style:left={pct(bd.a)} style:width={pct(bd.b - bd.a + 1)}></span>{/each}</div>
        <input class="tm-range" id="tmRange" type="range" min="0" max={TM_SPAN} step="1" value={v} aria-label={t.date} aria-valuetext={fullDate(shownDay)} bind:this={range} oninput={input} />
        <div class="tm-thumb" aria-hidden="true" style:left="{(v / TM_SPAN) * 100}%"><Icon name="clock" /></div>
        <div class="tm-months">{#each track.months as [i, s] (i)}<span style:left={pct(i)}>{s}</span>{/each}</div>
      </div>
      <div class="tm-jumps">
        <button type="button" id="tmPrev" aria-label={t.prevAria} onclick={() => { clearTimeout(timer); app.jumpOcc(-1); }}><Icon name="chev-l" />{t.prev}</button>
        <button type="button" id="tmToday" onclick={() => now(today)}>{t.todayBtn}</button>
        <button type="button" id="tmNext" aria-label={t.nextAria} onclick={() => { clearTimeout(timer); app.jumpOcc(1); }}>{t.next}<Icon name="chev" /></button>
      </div>
      <div class="tm-acts">
        <button type="button" data-demo="intro" onclick={() => demoAct('intro')}><Icon name="play" />{t.intro}</button>
        <button type="button" data-demo="join" onclick={() => demoAct('join')}><Icon name="user-plus" /><span>{app.demo ? t.join : t.invite}</span></button>
        {#if app.demo}
          <button type="button" data-demo="reset" onclick={() => demoAct('reset')}><Icon name="reset" />{t.reset}<small>{t.resetNote}</small></button>
        {/if}
      </div>
    </div>
  {/if}
  <button class="tm-btn" id="tmBtn" type="button" aria-expanded={app.tmOpen} aria-controls="tm" onclick={() => (app.tmOpen = !app.tmOpen)}><Icon name="clock" />{t.title}</button>
</div>
