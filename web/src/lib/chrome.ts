import { gsap } from 'gsap';
import { reduced, isMobile } from './scene/util';

// The always-on chrome around the scene: top bar, hero text, time machine button.
const el = (id: string) => document.getElementById(id);

export function showChrome() {
  const hero = el('hero');
  if (!hero) return;
  hero.classList.add('on');
  gsap.killTweensOf([hero, '#top', '#tmWrap']);
  gsap.to(['#top', '#tmWrap'], { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' });
  gsap.to(hero, { opacity: 1, duration: 0.3 });
  revealHero();
}

export function hideChrome(instant = false, top = isMobile()) {
  const hero = el('hero');
  if (!hero) return;
  hero.classList.remove('on');
  gsap.killTweensOf([hero, '#top', '#tmWrap']);
  if (instant) { gsap.set(hero, { opacity: 0 }); gsap.set(['#top', '#tmWrap'], { opacity: 0, y: -6 }); return; }
  gsap.to(hero, { opacity: 0, duration: 0.35 });
  gsap.to('#tmWrap', { opacity: 0, duration: 0.3 });
  if (top) gsap.to('#top', { opacity: 0, duration: 0.3 });
}

export const HERO_PARTS = ['#heroCount', '#heroKicker', '#hello', '#heroSub', '#upcoming', '#heroRow'];

export function revealHero(delay = 0) {
  if (!el('hello')) return;
  if (reduced) { gsap.set('#hello', { '--rv': 1, opacity: 1 }); return; }
  gsap.fromTo('#hello', { '--rv': 0, filter: 'blur(14px)', opacity: 0, letterSpacing: '0.04em' },
    { '--rv': 1, filter: 'blur(0px)', opacity: 1, letterSpacing: '-0.02em', duration: 1.6, ease: 'power3.out', delay, clearProps: 'filter,letterSpacing' });
  gsap.fromTo(HERO_PARTS.filter(s => s !== '#hello'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: delay + 0.3, clearProps: 'transform' });
}

/** Screen space the scene must keep clear when it frames the ornaments. */
export function measureUi() {
  const top = el('top'), hero = el('hero'), tm = el('tmBtn');
  let bottom = 0;
  if (top) for (const c of top.children) { const r = c.getBoundingClientRect(); if (r.height) bottom = Math.max(bottom, r.bottom); }
  const hr = hero?.getBoundingClientRect() ?? null;
  const heroTop = hr?.height ? hr.top : innerHeight;
  document.documentElement.style.setProperty('--scrim', Math.round(innerHeight - heroTop + 90) + 'px');
  return { top: bottom || (top?.getBoundingClientRect().bottom ?? 80), heroTop, hero: hr, tm: tm?.getBoundingClientRect() ?? null };
}

export function showModal(m: HTMLElement) {
  if (reduced) return;
  gsap.fromTo(m, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  if (m.firstElementChild) gsap.fromTo(m.firstElementChild, { y: 40, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out', delay: 0.1 });
}

export function hideModal(m: HTMLElement, done: () => void) {
  gsap.to(m, { opacity: 0, duration: reduced ? 0.01 : 0.3, onComplete: () => { gsap.set([m, m.firstElementChild], { clearProps: 'all' }); done(); } });
}
