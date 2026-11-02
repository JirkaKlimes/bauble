<script lang="ts">
  import { gsap } from 'gsap';
  import { app } from '../lib/app.svelte';
  import { occOf } from '../lib/domain/occasions';
  import type { Claim, WishId } from '../lib/domain/types';
  import { burstAt } from '../lib/fx2d';
  import { i18n } from '../lib/i18n/index.svelte';
  import { reduced } from '../lib/scene/util';
  import { bell } from '../lib/sound';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import TagBody from './TagBody.svelte';

  let phase = $state<'wrapped' | 'opening' | 'done'>('wrapped');
  let snap = $state<Claim[]>([]);
  let opened = $state<Set<WishId>>(new Set());
  let section = $state<HTMLElement>();
  let btn = $state<HTMLButtonElement>();

  $effect(() => { const p = app.pending; if (phase === 'wrapped') snap = p; });

  const t = $derived(i18n.t);
  const first = $derived(snap[0] ? occOf(snap[0].occ, app.family) : null);
  const givers = (c: Claim) => i18n.t.joinNames(c.by.map(x => { const m = app.member(x); return m ? i18n.t.gen(m) : ''; }));

  function run() {
    if (!section) return;
    phase = 'opening';
    const items = [...section.querySelectorAll<HTMLElement>('[data-rev]')];
    const tl = gsap.timeline({ onComplete: () => {
      phase = 'done';
      if (btn) gsap.to(btn, { opacity: 0, height: 0, marginTop: 0, duration: 0.4 });
      app.revealDone();
    } });
    items.forEach((li, i) => {
      const at = i * 0.75, wid = li.dataset.rev as WishId;
      const q = (s: string) => li.querySelector(s);
      tl.add(() => li.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }), at)
        .to(q('.bow'), { scale: 1.5, rotation: 40, opacity: 0, y: -30, duration: 0.45, ease: 'power2.in' }, at + 0.1)
        .to(q('.rb-h'), { scaleX: 0, transformOrigin: '100% 50%', duration: 0.4, ease: 'power3.in' }, at + 0.3)
        .to(q('.rb-v'), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.4, ease: 'power3.in' }, at + 0.38)
        .to(li, { y: -6, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' }, at + 0.5)
        .add(() => {
          opened = new Set([...opened, wid]);
          requestAnimationFrame(() => { const g = q('.giver'); if (g) gsap.from(g, { opacity: 0, y: 8, duration: 0.45 }); });
          burstAt(li.getBoundingClientRect(), 34, 0.6, 0.4);
          bell(1318.5 + i * 140, 0, 0.12); bell(1975.5 + i * 140, 0.1, 0.08);
        }, at + 0.55);
    });
    if (reduced) tl.progress(1);
  }
</script>

{#if snap.length && first}
  <section class="reveal" id="reveal" aria-labelledby="revealTitle" bind:this={section}>
    <div class="reveal-head"><p>{first.kind === 'xmas' ? t.christmas[app.family.christmas].revealKicker : t.reveal.kickParty}</p><h3 id="revealTitle">{phase === 'done' ? t.reveal.done : t.reveal.title(snap.length)}</h3></div>
    <ul class="tags">
      {#each snap as c, i (c.id)}
        {@const w = app.family.wishes.find(x => x.id === c.wish)}
        {#if w}
          <li class="tag-wrap" data-rev={c.wish} data-state="wrapped">
            <article class="tag" style:--tilt="{[-0.7, 0.55, -0.35, 0.8, -0.55][i % 5]}deg">
              <TagBody {w} stamp={false} />
              <div class="tag-foot">
                {#if opened.has(c.wish)}
                  <span class="giver"><span class="stack">{#each c.by as b (b)}<Avatar id={b} size="xs" />{/each}</span><span>{t.reveal.from} <strong>{givers(c)}</strong></span></span>
                {:else}
                  <span class="mystery">{t.reveal.mystery}</span>
                {/if}
              </div>
              <div class="ribbon gold big" aria-hidden="true"><i class="rb-h"></i><i class="rb-v"></i><svg class="bow" viewBox="0 0 70 48"><use href="#bow" /></svg></div>
            </article>
          </li>
        {/if}
      {/each}
    </ul>
    {#if phase !== 'done' || btn}
      <button class="btn-gold" type="button" id="revealBtn" disabled={phase !== 'wrapped'} bind:this={btn} onclick={run}><Icon name="gift" />{t.reveal.unwrap}</button>
    {/if}
  </section>
{/if}
