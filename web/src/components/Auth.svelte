<script lang="ts">
  import { gsap } from 'gsap';
  import { onMount } from 'svelte';
  import { app } from '../lib/app.svelte';
  import { showModal } from '../lib/chrome';
  import { failureOf, i18n } from '../lib/i18n/index.svelte';
  import LangSwitch from './LangSwitch.svelte';

  let { screen }: { screen: 'login' | 'invalid' } = $props();
  let email = $state(''), password = $state(''), err = $state(''), busy = $state(false);
  let modal = $state<HTMLElement>(), card = $state<HTMLElement>(), emailEl = $state<HTMLInputElement>();
  const t = $derived(i18n.t.auth);

  onMount(() => { if (modal) showModal(modal); setTimeout(() => emailEl?.focus(), 250); });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    err = '';
    if (!email.trim() || !password) { err = t.fillBoth; return; }
    busy = true;
    try { await app.login(email.trim(), password); }
    catch (ex) {
      const f = failureOf(ex);
      err = f.status === 400 ? t.wrong : f.status === 0 ? i18n.t.error.offline : t.failed;
      if (card) gsap.fromTo(card, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' });
    } finally { busy = false; }
  }
</script>

<div class="modal" id="auth" bind:this={modal}>
  <div class="ob-card auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle" bind:this={card}>
    {#if screen === 'login'}
      <div id="authLogin">
        <p class="auth-kicker">{t.kicker}</p>
        <h2 id="authTitle">{t.title}</h2>
        <form class="ob-form" novalidate onsubmit={submit}>
          <div class="ob-field">
            <label for="authEmail">{t.email}</label>
            <input class="field" id="authEmail" type="email" autocomplete="username" inputmode="email" spellcheck="false" bind:value={email} bind:this={emailEl} />
          </div>
          <div class="ob-field">
            <label for="authPass">{t.password}</label>
            <input class="field" id="authPass" type="password" autocomplete="current-password" bind:value={password} />
          </div>
          {#if err}<p class="c-err" id="authErr" role="alert">{err}</p>{/if}
          <button class="btn-gold" id="authBtn" type="submit" disabled={busy}>{t.submit}</button>
        </form>
        <p class="auth-foot">{t.foot}</p>
      </div>
    {:else}
      <div id="authInvalid">
        <h2 id="authTitle">{t.invalidTitle}</h2>
        <p class="auth-lead">{t.invalidLead}</p>
        <button class="btn-ghost" type="button" onclick={() => { history.replaceState(null, '', '/'); app.modal = { kind: 'auth', screen: 'login' }; }}>{t.haveAccount}</button>
      </div>
    {/if}
    <div class="ob-lang"><LangSwitch /></div>
  </div>
</div>
