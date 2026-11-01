<script lang="ts">
  import { gsap } from 'gsap';
  import { tick } from 'svelte';
  import { app } from '../lib/app.svelte';
  import { guessArt, guessFromUrl, hostOf } from '../lib/domain/links';
  import { PRIORITIES, type Art, type Priority } from '../lib/domain/types';
  import { i18n } from '../lib/i18n/index.svelte';
  import { isMobile, reduced } from '../lib/scene/util';
  import Icon from './Icon.svelte';

  let { onfocusfield }: { onfocusfield: () => void } = $props();

  type Step = 'start' | 'loading' | 'fields';
  let step = $state<Step>('start');
  let url = $state('');
  let urlErr = $state('');
  let source = $state<{ url: string; host: string; imageUrl: string }>({ url: '', host: '', imageUrl: '' });
  let title = $state('');
  let titleErr = $state(false);
  let priceText = $state('');
  let note = $state('');
  let pr = $state<Priority>('high');
  let baseArt = $state<Art>('gift');
  let section = $state<HTMLElement>();
  let fields = $state<HTMLElement>();
  let titleEl = $state<HTMLInputElement>();
  let seq = 0;

  const t = $derived(i18n.t.composer);
  const editingWish = $derived(app.editing ? app.wish(app.editing) : undefined);
  const art = $derived.by((): Art => { const g = guessArt(title); return g === 'gift' ? baseArt : g; });
  const PR_ORDER: Priority[] = [...PRIORITIES].reverse();

  $effect(() => {
    const w = editingWish;
    if (!w) return;
    source = { url: w.url, host: w.store || hostOf(w.url), imageUrl: w.imageUrl };
    void openFields({ title: w.title, price: w.price, note: w.note, pr: w.pr, art: w.art });
    section?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  });

  async function openFields(v: { title: string; price: number | null; note?: string; pr?: Priority; art: Art }) {
    step = 'fields';
    title = v.title; priceText = v.price ? String(v.price) : ''; note = v.note ?? ''; pr = v.pr ?? 'high'; baseArt = v.art;
    titleErr = false;
    if (isMobile()) onfocusfield();
    await tick();
    if (fields && !reduced) gsap.from(fields.children, { opacity: 0, y: 10, stagger: 0.05, duration: 0.45, ease: 'power3.out', clearProps: 'transform,opacity' });
    setTimeout(() => { titleEl?.focus({ preventScroll: true }); if (title) titleEl?.select(); }, 60);
  }

  async function load() {
    const v = url.trim();
    if (!v) { urlErr = t.errEmpty; return; }
    const info = guessFromUrl(v);
    if (!info) { urlErr = t.errBad; return; }
    source = { url: info.url, host: info.host, imageUrl: '' };
    step = 'loading';
    const my = ++seq, t0 = performance.now();
    const pv = await app.store.preview(info.url).catch(() => null);
    await new Promise(r => setTimeout(r, Math.max(0, (reduced ? 120 : 650) - (performance.now() - t0))));
    if (my !== seq || step !== 'loading') return;
    const ttl = pv?.title || info.title;
    source.imageUrl = pv?.image ?? '';
    void openFields({ title: ttl, price: pv?.price ?? null, art: guessArt(ttl + ' ' + info.host) });
  }

  function reset() {
    seq++; app.editing = null; step = 'start'; url = ''; urlErr = ''; titleErr = false;
    source = { url: '', host: '', imageUrl: '' };
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    const tt = title.trim();
    if (!tt) { titleErr = true; titleEl?.focus(); return; }
    const price = parseInt(priceText.replace(/\D/g, ''), 10) || null;
    const n = note.trim();
    const w = editingWish;
    if (w) {
      void app.editWish(w.id, { title: tt, price, note: n, pr, art });
    } else {
      void app.addWish({ title: tt, price, note: n, pr, url: source.url, store: source.host, imageUrl: source.imageUrl, art: guessArt(tt + ' ' + source.host) === 'gift' ? baseArt : guessArt(tt + ' ' + source.host) });
    }
    reset();
  }
</script>

<section class="composer" id="composer" aria-label={t.aria} bind:this={section}>
  <form novalidate onsubmit={save}>
    {#if step === 'start'}
      <div>
        <label class="c-label" for="cUrl">{t.pasteLabel}</label>
        <div class="c-url">
          <input class="field" id="cUrl" type="url" inputmode="url" placeholder="https://www…" autocomplete="off" spellcheck="false"
            aria-invalid={urlErr ? 'true' : undefined} bind:value={url} onfocus={onfocusfield}
            oninput={() => (urlErr = '')} onpaste={() => setTimeout(load, 40)} onkeydown={e => { if (e.key === 'Enter') { e.preventDefault(); void load(); } }} />
          <button class="btn-gold sm" id="cLoad" type="button" onclick={load}>{t.load}</button>
        </div>
        {#if urlErr}<p class="c-err" id="cUrlErr">{urlErr}</p>{/if}
        <button class="link-btn c-alt" id="cNoLink" type="button" onclick={() => { source = { url: '', host: '', imageUrl: '' }; void openFields({ title: '', price: null, art: 'gift' }); }}>{t.noLink}</button>
      </div>
    {:else if step === 'loading'}
      <div class="c-loading" id="cLoading"><span class="c-shimmer"></span><span>{t.reading}</span></div>
    {:else}
      <div class="c-fields" id="cFields" bind:this={fields}>
        <div class="c-preview">
          <span class="tag-art" aria-hidden="true"><svg viewBox="0 0 48 48"><use href="#p-{art}" /></svg></span>
          <span id="cHost">{source.host ? t.from(source.host) : t.noLinkWish}</span>
        </div>
        <div>
          <label for="cTitle">{t.what}</label>
          <input class="field" id="cTitle" type="text" maxlength="120" autocomplete="off" bind:value={title} bind:this={titleEl}
            aria-invalid={titleErr ? 'true' : undefined} onfocus={onfocusfield} oninput={() => (titleErr = false)} />
          {#if titleErr}<p class="c-err" id="cTitleErr">{t.whatErr}</p>{/if}
        </div>
        <div>
          <label for="cPrice">{t.price}</label>
          <div class="c-price"><input class="field" id="cPrice" type="text" inputmode="numeric" placeholder={t.priceUnknown} autocomplete="off" bind:value={priceText} onfocus={onfocusfield} /><span>{t.currency}</span></div>
        </div>
        <div>
          <label for="cNote">{t.note}</label>
          <textarea class="field" id="cNote" rows="2" maxlength="200" placeholder={t.notePlaceholder} bind:value={note} onfocus={onfocusfield}></textarea>
        </div>
        <fieldset class="c-pr">
          <legend>{t.howMuch}</legend>
          <div class="chips">
            {#each PR_ORDER as p (p)}
              <label class="chip"><input type="radio" name="pr" value={p} bind:group={pr} /><span>{i18n.t.tag.pr[p]}</span></label>
            {/each}
          </div>
        </fieldset>
        <div class="c-actions">
          <button class="btn-ghost" id="cCancel" type="button" onclick={reset}>{t.cancel}</button>
          <button class="btn-gold" id="cSave" type="submit"><Icon name={editingWish ? 'check' : 'plus'} />{editingWish ? t.save : t.add}</button>
        </div>
      </div>
    {/if}
  </form>
</section>
