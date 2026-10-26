// Smooth scrolling (Lenis) driven by GSAP's ticker so ScrollTrigger stays in sync.
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export let lenis = null;
const lockReasons = new Set();

export function initScroll({ smooth }) {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!smooth) return;
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  if (window.__AXIS_SHOT || /[?&]shot\b/.test(location.search)) window.__lenis = lenis; // automated screenshots drive scrolling
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// Accepts a selector, element or pixel offset. Header height is compensated automatically.
export function scrollTo(target, { offset = 0, immediate = false } = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (target !== 0 && typeof target !== 'number' && !el) return;
  if (lenis) {
    lenis.scrollTo(el || target, { offset, immediate, duration: immediate ? 0 : 1.6 });
  } else {
    const top = typeof target === 'number' ? target : el.getBoundingClientRect().top + window.scrollY + offset;
    window.scrollTo({ top, behavior: immediate ? 'auto' : 'smooth' });
  }
}

// Modals and menus lock page scroll; several can be open at once, so track reasons.
export function lockScroll(reason) {
  lockReasons.add(reason);
  lenis?.stop();
  document.documentElement.classList.add('is-locked');
}

export function unlockScroll(reason) {
  lockReasons.delete(reason);
  if (lockReasons.size) return;
  lenis?.start();
  document.documentElement.classList.remove('is-locked');
}

export function scrollY() {
  return lenis ? lenis.scroll : window.scrollY;
}

export { gsap, ScrollTrigger };
