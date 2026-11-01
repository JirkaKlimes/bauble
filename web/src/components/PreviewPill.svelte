<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { i18n, longDate } from '../lib/i18n/index.svelte';
  import Icon from './Icon.svelte';
</script>

{#if !app.demo && app.previewing && app.me}
  <div class="preview-pill" id="previewPill" role="status">
    <Icon name="clock" /><span>{i18n.t.preview.text(longDate(app.simDay))}</span>
    <button type="button" onclick={() => app.setSimDay(app.realToday)}>{i18n.t.preview.back}</button>
  </div>
{/if}
