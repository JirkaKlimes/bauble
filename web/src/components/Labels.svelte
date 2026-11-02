<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { openWishesOf } from '../lib/domain/claims';
  import { nextBday } from '../lib/domain/occasions';
  import type { Member, MemberId } from '../lib/domain/types';
  import { i18n, shortDate } from '../lib/i18n/index.svelte';
  import { registerLabel } from '../lib/scene';

  function sub(m: Member) {
    const t = i18n.t.label, st = app.status, me = m.id === app.me;
    if (st.mode === 'bday' && st.occ.who === m.id) {
      if (st.diff < 0) return t.wasYesterday;
      if (me) return st.diff === 0 ? t.celebratingYouToday : t.celebratingYou(i18n.t.inDays(st.diff));
      return st.diff === 0 ? t.celebratingToday : t.celebrating(i18n.t.inDays(st.diff));
    }
    if (me) return t.thatsYou;
    if (st.mode === 'quiet') {
      const o = nextBday(m, app.simDay);
      if (o) return t.birthdayOn(shortDate(o.day));
    }
    return t.wishes(openWishesOf(app.view, m.id).length);
  }

  function label(el: HTMLElement, id: MemberId) {
    return { destroy: registerLabel(id, el) };
  }
</script>

<div class="labels" id="labels">
  {#each app.family.members as m (m.id)}
    {@const s = sub(m)}
    <button
      type="button"
      class="blabel"
      class:me={m.id === app.me}
      class:cel={app.status.mode === 'bday' && app.status.occ.who === m.id}
      data-member={m.id}
      aria-label={i18n.t.label.aria(m.name, s)}
      onclick={() => app.openMember(m.id)}
      onpointerenter={() => app.scene?.setHover(m.id)}
      onpointerleave={() => app.scene?.setHover(null)}
      use:label={m.id}
    ><b>{m.name}</b><span>{s}</span></button>
  {/each}
</div>
