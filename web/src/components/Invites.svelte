<script lang="ts">
  import { gsap } from 'gsap';
  import { onMount, tick } from 'svelte';
  import { app } from '../lib/app.svelte';
  import { hideModal, showModal } from '../lib/chrome';
  import type { Invite, Role } from '../lib/domain/types';
  import { dayMonth, i18n } from '../lib/i18n/index.svelte';
  import { reduced } from '../lib/scene/util';
  import { jingle } from '../lib/sound';
  import Icon from './Icon.svelte';

  let note = $state(''), role = $state<Role>('member'), busy = $state(false);
  let link = $state(''), list = $state<Invite[] | null>(null), loadFailed = $state(false);
  let modal = $state<HTMLElement>(), noteEl = $state<HTMLInputElement>(), linkEl = $state<HTMLInputElement>(), result = $state<HTMLElement>();
  const t = $derived(i18n.t.invites);
  const canShare = typeof navigator.share === 'function';
  const inviteLink = (token: string) => `${location.origin}/i/${token}`;

  async function refresh() {
    try { list = await app.store.listInvites(); loadFailed = false; }
    catch { loadFailed = true; }
  }
  onMount(() => { if (modal) showModal(modal); void refresh(); setTimeout(() => noteEl?.focus(), 250); });

  async function create(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    try {
      const inv = await app.store.createInvite(note.trim(), role);
      link = inviteLink(inv.token);
      await tick();
      if (!reduced && result) gsap.fromTo(result, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
      jingle(app.status.mode);
      void refresh();
    } catch (err) { app.toastError(err); }
    finally { busy = false; }
  }

  async function copy(text: string, input?: HTMLInputElement) {
    try { await navigator.clipboard.writeText(text); app.showToast(i18n.t.toast.copied); }
    catch { input?.focus(); input?.select(); app.showToast(i18n.t.toast.selectToCopy); }
  }

  async function revoke(inv: Invite) {
    try { await app.store.revokeInvite(inv.id); app.showToast(i18n.t.toast.inviteRevoked); void refresh(); }
    catch (err) { app.toastError(err); }
  }

  function close() { if (modal) hideModal(modal, () => (app.modal = null)); }
  const now = Date.now();
</script>

<svelte:window onkeydown={e => { if (e.key === 'Escape') close(); }} />

<div class="modal" id="invites" bind:this={modal}>
  <div class="ob-card inv-card" role="dialog" aria-modal="true" aria-labelledby="invTitle">
    <button class="icon-btn ob-close" id="invClose" type="button" aria-label={i18n.t.onboard.close} onclick={close}><Icon name="close" /></button>
    <h2 id="invTitle">{t.title}</h2>
    <p class="auth-lead">{t.lead}</p>
    <form class="ob-form" novalidate onsubmit={create}>
      <div class="ob-field">
        <label for="invNote">{t.forWhom}</label>
        <input class="field" id="invNote" type="text" maxlength="40" autocomplete="off" placeholder={t.forWhomPlaceholder} bind:value={note} bind:this={noteEl} />
      </div>
      <fieldset class="c-pr inv-role"><legend>{t.canInvite}</legend><div class="chips">
        <label class="chip"><input type="radio" name="invRole" value="member" bind:group={role} /><span>{t.member}</span></label>
        <label class="chip"><input type="radio" name="invRole" value="admin" bind:group={role} /><span>{t.admin}</span></label>
      </div></fieldset>
      <button class="btn-gold" id="invCreate" type="submit" disabled={busy}><Icon name="link" />{t.create}</button>
    </form>
    {#if link}
      <div class="inv-result" id="invResult" bind:this={result}>
        <label for="invLink">{t.linkLabel}</label>
        <input class="field" id="invLink" type="text" readonly value={link} bind:this={linkEl} />
        <div class="ob-actions">
          <button class="btn-ghost" id="invCopy" type="button" onclick={() => copy(link, linkEl)}>{t.copy}</button>
          {#if canShare}
            <button class="btn-ghost" id="invShare" type="button" onclick={() => navigator.share({ title: t.shareTitle, text: t.shareText, url: link }).catch(() => {})}>{t.share}</button>
          {/if}
        </div>
      </div>
    {/if}
    <h3 class="inv-h">{t.recent}</h3>
    <ul class="inv-list" id="invList">
      {#if loadFailed}
        <li class="inv-empty">{t.loadFailed}</li>
      {:else if list && !list.length}
        <li class="inv-empty">{t.none}</li>
      {:else if list}
        {#each list.slice(0, 12) as inv (inv.id)}
          {@const exp = !!inv.expires && inv.expires.getTime() < now}
          {@const who = inv.usedBy ? app.member(inv.usedBy) : null}
          <li class={inv.usedBy ? 'used' : exp ? 'expired' : 'open'}>
            <span class="inv-dot" aria-hidden="true"></span>
            <span class="inv-t">
              <b>{inv.note || t.noName}{#if inv.role === 'admin'} <em>{t.adminTag}</em>{/if}</b>
              <span>{inv.usedBy ? t.used(who?.name ?? t.someone) : exp ? t.expired : t.waiting(inv.expires ? dayMonth(inv.expires) : '')}</span>
            </span>
            {#if !inv.usedBy && !exp}
              <button class="btn-text light" type="button" onclick={() => copy(inviteLink(inv.token))}>{t.copyShort}</button>
              <button class="btn-text light" type="button" aria-label={t.revokeAria(inv.note)} onclick={() => revoke(inv)}>{t.revoke}</button>
            {/if}
          </li>
        {/each}
      {/if}
    </ul>
  </div>
</div>
