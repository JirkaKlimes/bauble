<script lang="ts">
  import { gsap } from 'gsap';
  import { tick } from 'svelte';
  import { app } from '../lib/app.svelte';
  import Icon from './Icon.svelte';

  let el = $state<HTMLElement>();
  let shown = $state<typeof app.toast>(null);

  $effect(() => {
    const t = app.toast;
    if (t) {
      shown = t;
      void tick().then(() => { if (el) { gsap.killTweensOf(el); gsap.fromTo(el, { xPercent: -50, x: 0, opacity: 0, y: 14 }, { xPercent: -50, opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }); } });
    } else if (el) {
      gsap.to(el, { xPercent: -50, opacity: 0, y: 10, duration: 0.3, onComplete: () => { if (!app.toast) shown = null; } });
    }
  });
</script>

{#if shown}
  <div class="toast" class:with-panel={app.phase === 'focus'} id="toast" role="status" aria-live="polite" bind:this={el}>
    <Icon name="sparkle" /><span>{shown.msg}</span>
    {#if shown.action}<button type="button" onclick={() => app.dismissToast(true)}>{shown.action.label}</button>{/if}
  </div>
{/if}
