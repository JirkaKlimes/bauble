<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { fulfilledFor } from '../lib/domain/claims';
  import { dateOf, occOf } from '../lib/domain/occasions';
  import { i18n } from '../lib/i18n/index.svelte';
  import Icon from './Icon.svelte';

  const done = $derived(app.me ? fulfilledFor(app.view, app.me).filter(c => c.revealed) : []);
  const t = $derived(i18n.t);
</script>

{#if done.length}
  <details class="archive">
    <summary><Icon name="chev" />{t.reveal.archive(done.length)}</summary>
    <ul>
      {#each done as c (c.id)}
        {@const w = app.family.wishes.find(x => x.id === c.wish)}
        {@const o = occOf(c.occ, app.family.members)}
        {#if w && o}
          <li>
            <span class="chk"><Icon name="check" /></span>
            <span class="t"><b>{w.title}</b><span>{t.reveal.archiveLine(t.joinNames(c.by.map(x => { const m = app.member(x); return m ? t.gen(m) : ''; })), o.kind, dateOf(o.day).getFullYear())}</span></span>
          </li>
        {/if}
      {/each}
    </ul>
  </details>
{/if}
