<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { inXmasSeason } from '../lib/domain/occasions';
  import type { Christmas } from '../lib/domain/types';
  import { dayMonth, i18n } from '../lib/i18n/index.svelte';
  import CurrencySelect from './CurrencySelect.svelte';
  import LangSwitch from './LangSwitch.svelte';

  const t = $derived(i18n.t);
  const locked = $derived(inXmasSeason(app.realToday));
  const DAYS: [Christmas, number][] = [['eve', 24], ['day', 25]];
</script>

<div class="prefs">
  <LangSwitch />
  <CurrencySelect value={app.currency} options={app.currencies} onchange={c => app.setCurrency(c)} />
  {#if app.isAdmin}
    <div class="pref-xmas">
      <span id="prefXmas">{t.prefs.christmas}</span>
      <div class="seg" role="group" aria-labelledby="prefXmas">
        {#each DAYS as [c, d] (c)}
          <button type="button" aria-pressed={app.family.christmas === c} disabled={locked} title={t.christmas[c].dayName}
            onclick={() => app.setChristmas(c)}>{dayMonth(new Date(2000, 11, d))}</button>
        {/each}
      </div>
      {#if locked}<p class="pref-note">{t.prefs.christmasLocked}</p>{/if}
    </div>
  {/if}
</div>
