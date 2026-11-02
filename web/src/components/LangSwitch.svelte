<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { LOCALES } from '../lib/domain/types';
  import { i18n, langName } from '../lib/i18n/index.svelte';
</script>

<div class="seg lang" role="group" aria-label={i18n.t.prefs.language}>
  {#each LOCALES as l (l)}
    <button type="button" lang={l} aria-pressed={i18n.locale === l} onclick={() => app.setLocale(l)}>{langName(l)}</button>
  {/each}
</div>
