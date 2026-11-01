<script lang="ts">
  import { i18n, LOCALES } from '../lib/i18n/index.svelte';
  import { cs } from '../lib/i18n/cs';
  import { en } from '../lib/i18n/en';

  const names = { cs: cs.langName, en: en.langName };
</script>

<div class="lang" role="group" aria-label={i18n.t.langLabel}>
  {#each LOCALES as l (l)}
    <button type="button" lang={l} aria-pressed={i18n.locale === l} onclick={() => i18n.set(l)}>{names[l]}</button>
  {/each}
</div>
