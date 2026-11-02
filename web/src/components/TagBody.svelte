<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { hostOf, safeHref } from '../lib/domain/links';
  import type { Wish } from '../lib/domain/types';
  import { i18n, priceText } from '../lib/i18n/index.svelte';
  import Icon from './Icon.svelte';

  let { w, stamp }: { w: Wish; stamp: boolean } = $props();
  let imgFailed = $state(false);
  const t = $derived(i18n.t);
  const href = $derived(safeHref(w.url));
  const showImg = $derived(!!w.img && !imgFailed);
  const price = $derived(w.price && priceText(w.price, app.currency, app.rates));
</script>

<div class="tag-body">
  <div class="tag-art" class:has-img={showImg} aria-hidden="true">
    {#if showImg}
      <img class="tag-img" src={w.img} alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror={() => (imgFailed = true)} />
    {:else}
      <svg viewBox="0 0 48 48"><use href="#p-{w.art}" /></svg>
    {/if}
  </div>
  <div class="tag-text">
    <h3 class="tag-title">{#if href}<a {href} target="_blank" rel="noopener noreferrer">{w.title}</a>{:else}{w.title}{/if}</h3>
    <p class="tag-meta">
      {#if href}
        <a class="tag-store" {href} target="_blank" rel="noopener noreferrer"><Icon name="link" />{w.store || hostOf(w.url)}</a>
      {:else}
        <span class="tag-store">{t.tag.noLink}</span>
      {/if}
      {#if price}
        <span class="tag-price">{price.text}{#if price.original}<span class="tag-orig">{price.original}</span>{/if}</span>
      {/if}
    </p>
  </div>
  {#if stamp && w.pr !== 'nice'}
    <span class="stamp" class:mid={w.pr === 'high'}>{t.tag.stamp[w.pr]}</span>
  {:else}
    <span></span>
  {/if}
</div>
{#if w.note}<p class="tag-note">„{w.note}“</p>{/if}
