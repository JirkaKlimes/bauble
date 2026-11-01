<script lang="ts">
  import { gsap } from 'gsap';
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { app, type OnboardFlow } from '../lib/app.svelte';
  import { hideModal, showModal } from '../lib/chrome';
  import { genitive, instrumental, vocative } from '../lib/domain/czech';
  import { burstAt } from '../lib/fx2d';
  import { errorText, failureOf, i18n, monthNames } from '../lib/i18n/index.svelte';
  import type { MemberId } from '../lib/domain/types';
  import { canvasBlob, coverCanvas, drawPortrait, photoPortrait, portraits, randomLook } from '../lib/portraits.svelte';
  import { reduced } from '../lib/scene/util';
  import { bell, jingle } from '../lib/sound';
  import Icon from './Icon.svelte';
  import LangSwitch from './LangSwitch.svelte';

  let { flow: flowProp }: { flow: OnboardFlow } = $props();
  // the parent keys this component on the flow, so the first value is the only one
  const flow = untrack(() => flowProp);

  type Step = 1 | 2 | 3 | 4;
  const steps: Step[] = flow.kind === 'join' ? [1, 2, 3, 4] : [1, 2, 3];
  const me = flow.kind === 'edit' ? app.meMember : undefined;
  const bdayLocked = !!me?.bday;
  const cs = () => i18n.locale === 'cs';

  let step = $state<Step>(1);
  const name0 = me?.name ?? (flow.kind === 'join' ? flow.invite.note : '');
  let name = $state(name0);
  let voc = $state(me ? me.voc : cs() && name0 ? vocative(name0) : '');
  let vocTouched = !!me;
  let nameErr = $state(false);
  let shot = $state<HTMLCanvasElement | null>(null);
  let shotUrl = $state('');
  let shotChanged = false;
  let stream = $state<MediaStream | null>(null);
  let counting = false;
  let camNote = $state('');
  let count = $state('');
  let shotErr = $state(false);
  let day = $state(me?.bday?.day ?? 1);
  let month = $state(me?.bday?.month ?? 1);
  let email = $state(''), password = $state(''), showPass = $state(false), accErr = $state(''), busy = $state(false);
  let errField = $state<'email' | 'password' | null>(null);

  let modal = $state<HTMLElement>(), card = $state<HTMLElement>(), video = $state<HTMLVideoElement>(), circle = $state<HTMLElement>();
  let countEl = $state<HTMLElement>(), flash = $state<HTMLElement>(), shotImg = $state<HTMLImageElement>(), stepEl = $state<HTMLElement>();
  let nameEl = $state<HTMLInputElement>(), dayEl = $state<HTMLSelectElement>(), emailEl = $state<HTMLInputElement>(), passEl = $state<HTMLInputElement>();

  const t = $derived(i18n.t.onboard);
  const mode = app.status.mode;
  const months = $derived(monthNames());

  if (me) { const c = portraits.canvas(me.id); if (c) { shot = c; shotUrl = c.toDataURL('image/jpeg', 0.9); } }

  onMount(() => {
    if (modal) showModal(modal);
    setTimeout(() => { if (!modal?.contains(document.activeElement)) nameEl?.focus(); }, 300);
  });
  onDestroy(stopCamera);

  async function goStep(n: Step) {
    if (n !== 2) stopCamera();
    const prev = stepEl;
    const show = async () => {
      step = n;
      await tick();
      if (!reduced && stepEl) gsap.fromTo(stepEl.children, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity' });
      if (n === 2 && !shot) void startCamera();
      if (n === 3) setTimeout(() => dayEl?.focus(), 100);
      if (n === 4) setTimeout(() => emailEl?.focus(), 100);
    };
    if (reduced || !prev) return show();
    gsap.to(prev.children, { opacity: 0, y: -10, duration: 0.22, stagger: 0.02, onComplete: () => { gsap.set(prev.children, { clearProps: 'all' }); void show(); } });
  }

  async function startCamera() {
    camNote = '';
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no media');
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      if (step !== 2) { s.getTracks().forEach(x => x.stop()); return; }
      stream = s;
      await tick();
      if (video) { video.srcObject = s; await video.play(); }
    } catch {
      stopCamera();
      camNote = t.camFailed;
    }
  }
  function stopCamera() {
    stream?.getTracks().forEach(x => x.stop());
    stream = null;
    if (video) video.srcObject = null;
  }

  async function setShot(c: HTMLCanvasElement) {
    shot = c; shotChanged = true; stopCamera(); shotUrl = c.toDataURL('image/jpeg', 0.9); shotErr = false; camNote = '';
    await tick();
    if (!reduced && shotImg) gsap.fromTo(shotImg, { scale: 1.15, filter: 'brightness(2.2)' }, { scale: 1, filter: 'brightness(1)', duration: 0.9, ease: 'power3.out', clearProps: 'filter' });
    setTimeout(() => document.getElementById('obNext2')?.focus(), 200);
  }

  function shoot() {
    if (counting || !stream || !video) return;
    counting = true;
    const v = video, tl = gsap.timeline({ onComplete: () => { counting = false; } });
    [3, 2, 1].forEach((n, i) => {
      tl.add(() => { count = String(n); bell(1760, 0, 0.05); }, i * 0.8)
        .fromTo(countEl ?? {}, { scale: 1.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, i * 0.8)
        .to(countEl ?? {}, { opacity: 0, duration: 0.25 }, i * 0.8 + 0.5);
    });
    tl.add(() => {
      const c = coverCanvas(v, true);
      count = ''; jingle(mode);
      if (flash) gsap.fromTo(flash, { opacity: 1 }, { opacity: 0, duration: 0.7, ease: 'power2.out' });
      if (circle) burstAt(circle.getBoundingClientRect(), 30);
      void setShot(c);
    }, 2.4);
  }

  function pickFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { camNote = t.notImage; return; }
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { void setShot(coverCanvas(img)); URL.revokeObjectURL(url); };
    img.onerror = () => { camNote = t.cantOpen; URL.revokeObjectURL(url); };
    img.src = url;
  }

  function demoShot() {
    if (flash) { flash.style.opacity = '1'; gsap.to(flash, { opacity: 0, duration: 0.7 }); }
    jingle(mode);
    void setShot(drawPortrait(randomLook(), '#c3cbe0'));
  }

  function next1() {
    const v = name.trim();
    if (!v) { nameErr = true; nameEl?.focus(); return; }
    if (cs() && !voc.trim()) voc = vocative(v);
    void goStep(2);
  }
  function next2() { if (!shot) { shotErr = true; return; } void goStep(3); }

  // Czech forms are stored for every member; viewers in other languages simply do not use them.
  const forms = (n: string) => ({ voc: (cs() && voc.trim()) || vocative(n), ins: instrumental(n), gen: genitive(n) });

  async function finish() {
    if (flow.kind === 'join') return goStep(4);
    if (flow.kind === 'edit') return saveProfile();
    const n = name.trim() || t.newMember;
    const m = app.addDemoMember(n, forms(n).voc, { day, month });
    hang(m.id, false);
  }

  async function saveProfile() {
    const m = app.meMember;
    if (!m) return;
    busy = true;
    const n = name.trim() || m.name;
    try {
      const f = cs() || n !== m.name ? forms(n) : { voc: m.voc, ins: m.ins, gen: m.gen };
      const photo = shotChanged && shot ? await canvasBlob(shot) : null;
      await app.saveProfile({ name: n, ...f, bday: bdayLocked ? null : { day, month }, photo }, shotChanged && shot ? photoPortrait(shot, m.glass) : null);
    } catch (err) { app.toastError(err); }
    finally { busy = false; }
  }

  async function join(e: SubmitEvent) {
    e.preventDefault();
    if (flow.kind !== 'join') return;
    accErr = ''; errField = null;
    const fail = (msg: string, field: 'email' | 'password' | null) => { accErr = msg; errField = field; (field === 'email' ? emailEl : field === 'password' ? passEl : null)?.focus(); };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return fail(i18n.t.error.email_invalid, 'email');
    if (password.length < 8) return fail(i18n.t.error.password_short, 'password');
    const n = name.trim();
    busy = true;
    try {
      await app.join({ token: flow.invite.token, name: n, ...forms(n), email: email.trim(), password, bday: { day, month } }, shot ? await canvasBlob(shot) : null);
      if (app.me) hang(app.me, true);
    } catch (err) {
      const f = failureOf(err);
      fail(f.code || f.status === 0 ? errorText(err) : t.joinFailed, f.code === 'email_invalid' || f.code === 'email_taken' ? 'email' : f.code === 'password_short' ? 'password' : null);
    } finally { busy = false; }
  }

  /** The photo flies out of the viewfinder onto its spot in the scene, then the ornament pops in. */
  function hang(id: MemberId, joined: boolean) {
    const m = app.member(id);
    if (!m || !shot) return;
    portraits.set(id, photoPortrait(shot, m.glass));
    const startR = circle?.getBoundingClientRect() ?? new DOMRect(innerWidth / 2 - 100, innerHeight / 2 - 100, 200, 200);
    const img = document.createElement('img');
    img.className = 'fly-photo'; img.src = shotUrl; img.alt = '';
    Object.assign(img.style, { left: startR.left + 'px', top: startR.top + 'px', width: startR.width + 'px', height: startR.height + 'px' });
    document.body.append(img);
    if (card) gsap.to(card, { opacity: 0, scale: 0.94, y: 20, duration: 0.4, ease: 'power2.in' });
    if (modal) gsap.to(modal, { opacity: 0, duration: 0.6, delay: 0.25 });
    stopCamera();
    const end = app.beginHang(id, joined) ?? { x: innerWidth / 2, y: innerHeight * 0.45, s: 70 };
    const from = { x: startR.left, y: startR.top, s: startR.width };
    const ctrl = { x: (from.x + end.x) / 2, y: Math.min(from.y, end.y - end.s) - 160 }, o = { p: 0 };
    gsap.to(o, { p: 1, duration: reduced ? 0.01 : 1.25, ease: 'power2.inOut', delay: 0.15,
      onUpdate: () => {
        const p = o.p, q = 1 - p, s = from.s + (end.s - from.s) * p;
        const x = q * q * (from.x + from.s / 2) + 2 * q * p * ctrl.x + p * p * end.x, y = q * q * (from.y + from.s / 2) + 2 * q * p * ctrl.y + p * p * end.y;
        Object.assign(img.style, { left: x - s / 2 + 'px', top: y - s / 2 + 'px', width: s + 'px', height: s + 'px' });
      },
      onComplete: () => {
        gsap.to(img, { opacity: 0, duration: 0.3, onComplete: () => img.remove() });
        app.modal = null;
        app.hung(joined);
      } });
  }

  function close() {
    stopCamera();
    if (modal) hideModal(modal, () => app.cancelOnboarding()); else app.cancelOnboarding();
  }

  const title1 = $derived(flow.kind === 'edit' ? t.profile : t.welcome);
  const lead1 = $derived(flow.kind === 'edit' ? t.leadEdit : flow.kind === 'join' ? t.leadJoin : t.leadDemo);
  const party = mode === 'bday';
</script>

<svelte:window onkeydown={e => { if (e.key === 'Escape' && flow.kind !== 'join') close(); }} />

<div class="modal" id="onboard" bind:this={modal}>
  <div class="ob-card" id="obCard" role="dialog" aria-modal="true" aria-labelledby="obTitle{step}" bind:this={card}>
    {#if flow.kind !== 'join'}
      <button class="icon-btn ob-close" id="obClose" type="button" aria-label={t.close} onclick={close}><Icon name="close" /></button>
    {/if}
    <ol class="ob-dots" aria-hidden="true">{#each steps as s (s)}<li class:on={s === step}></li>{/each}</ol>

    {#if step === 1}
      <section class="ob-step" bind:this={stepEl}>
        <h2 id="obTitle1">{title1}</h2>
        <p>{lead1}</p>
        <div class="ob-field">
          <label for="obName">{t.nameLabel}</label>
          <input class="field" id="obName" type="text" autocomplete="given-name" placeholder={t.namePlaceholder} maxlength="40" bind:value={name} bind:this={nameEl}
            aria-invalid={nameErr ? 'true' : undefined}
            oninput={() => { nameErr = false; if (!vocTouched && cs()) voc = vocative(name.trim()); }}
            onkeydown={e => { if (e.key === 'Enter') next1(); }} />
          {#if nameErr}<p class="c-err" id="obNameErr">{t.nameErr}</p>{/if}
        </div>
        {#if i18n.locale === 'cs'}
          <div class="ob-field">
            <label for="obVoc">{t.vocLabel}</label>
            <div class="voc-field"><span aria-hidden="true">{t.vocPrefix}</span><input class="field" id="obVoc" type="text" autocomplete="off" placeholder={t.vocPlaceholder} maxlength="40" bind:value={voc}
              oninput={() => (vocTouched = true)} onkeydown={e => { if (e.key === 'Enter') next1(); }} /></div>
          </div>
        {/if}
        <button class="btn-gold" id="obNext1" type="button" onclick={next1}>{t.next}</button>
        {#if flow.kind === 'edit'}<button class="link-btn" id="obLogout" type="button" onclick={() => app.logout()}>{t.logout}</button>{/if}
        <div class="ob-lang"><LangSwitch /></div>
      </section>
    {:else if step === 2}
      <section class="ob-step" bind:this={stepEl}>
        <h2 id="obTitle2">{t.smile}</h2>
        <p>{mode === 'quiet' ? t.leadPhotoQuiet : t.leadPhoto}</p>
        <div class="viewfinder">
          <div class="vf-circle" bind:this={circle}>
            {#if !shot && !stream}<div class="vf-empty"><Icon name="camera" /><span>{t.hereYouAppear}</span></div>{/if}
            <video bind:this={video} playsinline muted hidden={!stream || !!shot}></video>
            {#if shot}<img src={shotUrl} alt={t.yourPhoto} bind:this={shotImg} />{/if}
            <div class="vf-count" aria-live="assertive" bind:this={countEl}>{count}</div>
            <div class="vf-flash" bind:this={flash}></div>
          </div>
          {#if mode !== 'quiet'}
            <svg class="vf-hat" class:party viewBox={party ? '0 0 60 80' : '0 0 120 92'} aria-hidden="true"><use href={party ? '#party2d' : '#hat2d'} /></svg>
          {/if}
        </div>
        {#if camNote}<p class="ob-note" id="camNote">{camNote}</p>{/if}
        {#if !shot}
          <div class="ob-actions">
            {#if stream}<button class="btn-gold" id="obShoot" type="button" onclick={shoot}><Icon name="camera" />{t.shoot}</button>{/if}
            <input class="sr-only" id="obFile" type="file" accept="image/*" capture="user" onchange={pickFile} />
            <label class="btn-ghost" for="obFile"><Icon name="image" />{t.choose}</label>
          </div>
          {#if shotErr}<p class="c-err" id="obShotErr">{t.needPhoto}</p>{/if}
          {#if app.demo}<button class="link-btn" id="obDemo" type="button" onclick={demoShot}>{t.demoPortrait}</button>{/if}
        {:else}
          <div class="ob-actions">
            <button class="btn-ghost" id="obRetake" type="button" onclick={() => { shot = null; shotUrl = ''; void startCamera(); }}>{t.retake}</button>
            <button class="btn-gold" id="obNext2" type="button" onclick={next2}>{t.next}</button>
          </div>
        {/if}
      </section>
    {:else if step === 3}
      <section class="ob-step" bind:this={stepEl}>
        <h2 id="obTitle3">{t.bdayTitle}</h2>
        <p>{bdayLocked ? t.bdayLocked : t.bdayLead}</p>
        <div class="bday">
          <label>{t.day}<select class="field" id="bdDay" bind:value={day} bind:this={dayEl} disabled={bdayLocked}>{#each Array.from({ length: 31 }, (_, i) => i + 1) as d (d)}<option value={d}>{d}.</option>{/each}</select></label>
          <label>{t.month}<select class="field" id="bdMonth" bind:value={month} disabled={bdayLocked}>{#each months as mn, i (i)}<option value={i + 1}>{mn}</option>{/each}</select></label>
        </div>
        <button class="btn-gold" id="obFinish" type="button" disabled={busy} onclick={finish}>
          {#if flow.kind === 'join'}{t.next}{:else if flow.kind === 'edit'}<Icon name="check" />{t.save}{:else}<Icon name="sparkle" />{t.hang}{/if}
        </button>
      </section>
    {:else}
      <section class="ob-step" bind:this={stepEl}>
        <h2 id="obTitle4">{t.lastStep}</h2>
        <p>{t.lastLead}</p>
        <form class="ob-form" novalidate onsubmit={join}>
          <div class="ob-field">
            <label for="obEmail">{t.email}</label>
            <input class="field" id="obEmail" type="email" autocomplete="email" inputmode="email" spellcheck="false" placeholder={t.emailPlaceholder} bind:value={email} bind:this={emailEl} aria-invalid={errField === 'email' ? 'true' : undefined} />
          </div>
          <div class="ob-field">
            <label for="obPass">{t.password}</label>
            <div class="pw-field">
              <input class="field" id="obPass" type={showPass ? 'text' : 'password'} autocomplete="new-password" minlength="8" placeholder={t.passwordPlaceholder} bind:value={password} bind:this={passEl} aria-invalid={errField === 'password' ? 'true' : undefined} />
              <button class="btn-text light" type="button" aria-pressed={showPass} aria-controls="obPass" onclick={() => (showPass = !showPass)}>{showPass ? t.hide : t.show}</button>
            </div>
          </div>
          {#if accErr}<p class="c-err" id="obAccErr" role="alert">{accErr}</p>{/if}
          <button class="btn-gold" id="obJoin" type="submit" disabled={busy}><Icon name="sparkle" />{busy ? t.hanging : t.hang}</button>
        </form>
      </section>
    {/if}
  </div>
</div>
