<script lang="ts">
  import { gsap } from 'gsap';
  import { onMount } from 'svelte';
  import { app } from '../lib/app.svelte';
  import { attachFx } from '../lib/fx2d';
  import { i18n } from '../lib/i18n/index.svelte';
  import { Scene } from '../lib/scene';
  import Auth from './Auth.svelte';
  import Hero from './Hero.svelte';
  import Invites from './Invites.svelte';
  import Labels from './Labels.svelte';
  import Onboarding from './Onboarding.svelte';
  import Panel from './Panel.svelte';
  import PreviewPill from './PreviewPill.svelte';
  import TimeMachine from './TimeMachine.svelte';
  import Toast from './Toast.svelte';
  import TopBar from './TopBar.svelte';

  let canvas = $state<HTMLCanvasElement>(), fx = $state<HTMLCanvasElement>();
  let noGl = $state(false);

  onMount(() => {
    if (!canvas || !fx) return;
    attachFx(fx);
    const scene = Scene.create(canvas, {
      pick: id => app.openMember(id),
      background: () => app.closePanel(),
      tap: kind => app.sceneTap(kind),
    });
    noGl = !scene;
    document.documentElement.classList.toggle('no-gl', noGl);
    app.attachScene(scene);
    gsap.set(['#top', '#tmWrap'], { opacity: 0 });
    document.fonts?.ready.then(() => app.measure());
    void app.boot();
    // test hook: headless browsers render slowly, `fast` keeps GSAP from stretching time to match
    Object.assign(window, { bauble: {
      fast: (v: boolean) => scene?.setFast(v),
      pause: (v: boolean) => scene?.setPaused(v),
      debug: () => ({ phase: app.phase, me: app.me, intro: !!scene?.introRunning, members: app.family.members.length, locale: i18n.locale }),
      setDay: (n: number) => app.setSimDay(app.realToday + n),
      openMember: (id: string) => app.openMember(id as never),
      closePanel: () => app.closePanel(),
    } });
  });

  function keydown(e: KeyboardEvent) {
    if (app.scene?.introRunning && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { app.scene.skipIntro(); return; }
    if (e.key === 'Escape' && !app.tmOpen && !app.modal && app.phase === 'focus') app.closePanel();
  }
</script>

<svelte:window onkeydown={keydown} onresize={() => app.measure()} />

<canvas id="scene" aria-label={i18n.t.sceneLabel} bind:this={canvas}></canvas>
<div class="dim" id="dim"></div>
<Labels />
<TopBar />
<Hero />
<Panel />
{#if app.modal?.kind === 'onboard'}
  {#key app.modal}<Onboarding flow={app.modal.flow} />{/key}
{:else if app.modal?.kind === 'auth'}
  <Auth screen={app.modal.screen} />
{:else if app.modal?.kind === 'invites'}
  <Invites />
{/if}
<PreviewPill />
<TimeMachine />
<Toast />
<canvas id="fx" aria-hidden="true" bind:this={fx}></canvas>
{#if noGl}<p class="nogl-note">{i18n.t.noGl}</p>{/if}
