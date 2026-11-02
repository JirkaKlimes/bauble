<script lang="ts">
  import type { Currency } from '../lib/domain/money';
  import { currencyName, currencySymbol, i18n } from '../lib/i18n/index.svelte';

  let { value, options, onchange, short = false, id }: {
    value: Currency; options: readonly Currency[]; onchange: (c: Currency) => void;
    /** codes only, for a field suffix */
    short?: boolean; id?: string;
  } = $props();

  const list = $derived.by(() => {
    const all = options.includes(value) ? options : [...options, value];
    return all
      .map(c => ({ c, label: short ? c : `${currencyName(c)} (${currencySymbol(c)})` }))
      .sort((a, b) => a.label.localeCompare(b.label, i18n.locale));
  });
</script>

<select class="cur" class:short {id} aria-label={i18n.t.prefs.currency} {value} onchange={e => onchange(e.currentTarget.value as Currency)}>
  {#each list as o (o.c)}<option value={o.c}>{o.label}</option>{/each}
</select>
