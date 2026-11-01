<script lang="ts">
  import { gsap } from 'gsap';
  import { tick } from 'svelte';
  import { app, occLabel } from '../lib/app.svelte';
  import { activeClaim, type TagState } from '../lib/domain/claims';
  import { occOf, occsFor } from '../lib/domain/occasions';
  import type { Wish } from '../lib/domain/types';
  import { burstAt } from '../lib/fx2d';
  import { i18n } from '../lib/i18n/index.svelte';
  import { isMobile, reduced } from '../lib/scene/util';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import TagBody from './TagBody.svelte';

  let { w, i, kind }: { w: Wish; i: number; kind: TagState } = $props();
  const TILTS = [-0.7, 0.55, -0.35, 0.8, -0.55];

  let root = $state<HTMLElement>();
  const t = $derived(i18n.t);
  const claim = $derived(activeClaim(app.view, w.id));
  const occ = $derived(claim ? occOf(claim.occ, app.family.members) : null);
  const others = $derived(claim ? claim.by.filter(x => x !== app.me) : []);
  const canSwitch = $derived(occsFor(app.member(w.owner), app.simDay).length > 1);
  const names = (ids: typeof others, form: 'name' | 'ins') =>
    ids.map(x => { const m = app.member(x); return m ? (form === 'ins' ? t.ins(m) : m.name) : ''; });

  function play(anim: string | undefined) {
    const li = root?.closest('li');
    if (!li || reduced || !anim) return;
    if (anim === 'new') {
      li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      gsap.from(li, { y: -40, rotation: -10, opacity: 0, duration: 0.9, delay: 0.25, ease: 'back.out(1.7)', transformOrigin: '0% 50%', clearProps: 'transform,opacity' });
      setTimeout(() => { const r = li.getBoundingClientRect(); burstAt(r, 28, 0, 0.5); }, 650);
      return;
    }
    const q = (s: string) => li.querySelector(s);
    if (anim === 'wrap') {
      gsap.from(q('.rb-v'), { scaleY: 0, duration: 0.55, ease: 'power3.out' });
      gsap.from(q('.bow'), { scale: 0, rotation: -60, duration: 0.85, delay: 0.3, ease: 'back.out(2.6)' });
      gsap.from(q('.tag-foot'), { opacity: 0, y: 6, duration: 0.4, delay: 0.12 });
    } else if (anim === 'unwrap') gsap.from(q('.tag-foot'), { opacity: 0, y: 6, duration: 0.35 });
    else if (anim === 'join') gsap.from(li.querySelectorAll('.stack .avatar'), { scale: 0.3, opacity: 0, stagger: 0.08, duration: 0.55, ease: 'back.out(3)' });
    else if (anim === 'occ') gsap.from(q('.occ-chip'), { scale: 0.7, opacity: 0, duration: 0.45, ease: 'back.out(3)' });
    if (!isMobile()) (q('.tag-foot button') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  $effect(() => {
    void kind; void claim?.by.length; void claim?.occ;
    const anim = app.tagAnim.get(w.id);
    if (!anim) return;
    app.tagAnim.delete(w.id);
    void tick().then(() => play(anim));
  });

  const rect = (e: Event) => ((e.currentTarget as HTMLElement).closest('li')?.getBoundingClientRect() ?? null);
</script>

<svg class="tag-string" viewBox="0 0 48 26" aria-hidden="true"><path d="M2 13c10-9 22-9 40 0" /><path d="M2 13c10 8 22 8 40 0" opacity=".7" /><circle cx="3.5" cy="13" r="3.5" /></svg>
<article class="tag" style:--tilt="{TILTS[i % 5]}deg" bind:this={root}>
  <TagBody {w} stamp={kind === 'free' || kind === 'owner'} />
  <div class="tag-foot">
    {#if kind === 'owner'}
      <span class="pr-label">{t.tag.pr[w.pr]}</span>
      <span class="foot-acts">
        <button class="icon-btn" type="button" data-act="edit" aria-label={t.tag.editAria(w.title)} title={t.tag.edit} onclick={() => (app.editing = w.id)}><Icon name="pencil" /></button>
        <button class="icon-btn" type="button" data-act="got" aria-label={t.tag.gotAria(w.title)} title={t.tag.got} onclick={e => app.ownerOp(w.id, 'got', rect(e))}><Icon name="check" /></button>
        <button class="icon-btn" type="button" data-act="delete" aria-label={t.tag.delAria(w.title)} title={t.tag.del} onclick={e => app.ownerOp(w.id, 'delete', rect(e))}><Icon name="trash" /></button>
      </span>
    {:else if kind === 'gone'}
      {@const o = app.member(w.owner)}
      <span class="gone-note">{w.gone === 'got' ? t.tag.goneGot(o?.name ?? '') : t.tag.goneDeleted} {t.tag.letGo}</span>
      <button class="btn-text" type="button" data-act="release" onclick={() => app.release(w.id)}>{t.tag.dontBuy}</button>
    {:else if kind === 'free'}
      <button class="btn-claim" type="button" data-act="claim" onclick={e => app.claim(w.id, e.currentTarget)}><Icon name="gift" />{t.tag.claim}</button>
    {:else if claim && occ}
      {@const label = occLabel(occ.kind)}
      <span class="who">
        <span class="stack">{#each claim.by as b (b)}<Avatar id={b} size="xs" />{/each}</span>
        {#if kind === 'mine'}
          <strong>{others.length ? t.tag.buyingWith(names(others, 'ins')) : t.tag.buyingAlone}</strong>
        {:else}
          <span>{t.tag.buys(others.length)} <strong>{t.joinNames(names(others, 'name'))}</strong></span>
          <span class="occ-chip">{label}</span>
        {/if}
      </span>
      {#if kind === 'mine'}
        <span class="foot-acts">
          {#if canSwitch}
            <button class="occ-chip" type="button" data-act="occ" aria-label={t.tag.changeOcc(label)} onclick={() => app.switchOcc(w.id)}><Icon name="swap" />{label}</button>
          {:else}
            <span class="occ-chip">{label}</span>
          {/if}
          <button class="btn-text" type="button" data-act="release" onclick={() => app.release(w.id)}>{t.tag.notAfterAll}</button>
        </span>
      {:else}
        <button class="btn-join" type="button" data-act="join" onclick={e => app.joinClaim(w.id, e.currentTarget)}>{t.tag.joinIn}</button>
      {/if}
    {/if}
  </div>
  {#if kind === 'mine' || kind === 'others'}
    <div class="ribbon {kind}" aria-hidden="true"><i class="rb-v"></i><svg class="bow" viewBox="0 0 70 48"><use href="#bow" /></svg></div>
  {/if}
</article>
