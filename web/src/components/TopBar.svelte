<script lang="ts">
  import { app } from '../lib/app.svelte';
  import { i18n } from '../lib/i18n/index.svelte';
  import { setSound, soundOn } from '../lib/sound';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';

  let sound = $state(soundOn());

  const count = $derived.by((): { num: string | number; lines: [string, string] } | null => {
    const st = app.status, t = i18n.t;
    if (st.mode === 'quiet') return { num: st.diff, lines: t.countQuiet(st.diff) };
    if (st.phase === 'countdown') return { num: st.diff, lines: st.mode === 'xmas' ? t.countXmas(st.diff) : t.countBday(st.diff) };
    if (st.phase === 'day') return { num: t.countToday, lines: st.mode === 'xmas' ? t.countTodayXmas : t.countTodayBday };
    return null;
  });
</script>

<header class="top" id="top">
  <p class="brand">
    <span class="brand-ico" aria-hidden="true"
      ><svg class="i bi-xmas"><use href="#i-star" /></svg><svg class="i bi-bday"><use href="#i-cakef" /></svg><svg class="i bi-quiet"><use href="#i-moon" /></svg></span
    >bauble
  </p>
  <div class="top-right">
    {#if app.me && count}
      <p class="count" id="count"><b>{count.num}</b><span>{count.lines[0]}<br />{count.lines[1]}</span></p>
    {/if}
    {#if app.isAdmin && app.me}
      <button class="icon-btn mob" type="button" aria-label={i18n.t.timeMachine} aria-expanded={app.tmOpen} aria-controls="tm" onclick={() => (app.tmOpen = !app.tmOpen)}>
        <Icon name="clock" />
      </button>
    {/if}
    <button class="icon-btn" type="button" aria-pressed={sound} aria-label={i18n.t.sound} onclick={() => { sound = !sound; setSound(sound); }}>
      <Icon name={sound ? 'bell' : 'bell-off'} />
    </button>
    {#if app.me}
      <button class="me-btn" id="meBtn" type="button" aria-label={i18n.t.myWishes} onclick={() => app.me && app.openMember(app.me)}>
        <Avatar id={app.me} size="md" />
      </button>
    {/if}
  </div>
</header>
