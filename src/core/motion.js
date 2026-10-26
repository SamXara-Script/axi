// Scroll-driven reveals, parallax, counters and marquees.
//
//   data-reveal="lines"   headline lines rise out of a mask
//   data-reveal="fade"    fade + lift (data-delay="0.2" optional)
//   data-reveal="image"   clip-path wipe with a slow zoom-out of the inner <img>
//   data-reveal="stagger" children fade in one after another
//   data-parallax="0.15"  vertical drift relative to scroll
//   data-count="147"      number ticks up when visible (data-decimals, data-suffix)
//
// Initial states are applied immediately; reveals only play once `gate` resolves
// (after the preloader / page curtain), so nothing animates while it is covered.
import { gsap, ScrollTrigger } from './scroll.js';
import { SplitText } from 'gsap/SplitText';
import { bus } from './store.js';
import { fmtNumber } from './i18n.js';

gsap.registerPlugin(SplitText);

const splits = new Map();
let reduced = false;
let gate = Promise.resolve();

export function initMotion(options) {
  reduced = options.reduced;
  gate = options.gate || Promise.resolve();
  document.documentElement.classList.toggle('reduced-motion', reduced);
  if (reduced) {
    document.querySelectorAll('[data-count]').forEach(setFinalCount);
    return;
  }
  setup(document);
  setupParallax(document);
  setupMarquees(document);

  // A language switch replaces text nodes, so line splits are rebuilt (already-revealed text stays put).
  bus.on('lang', () => {
    splits.forEach((entry, el) => {
      entry.trigger?.kill();
      splits.delete(el);
    });
    setupLines(document);
    document.querySelectorAll('[data-count][data-counted]').forEach(setFinalCount);
    ScrollTrigger.refresh();
  });
}

function setup(root) {
  setupLines(root);
  setupFades(root);
  setupImages(root);
  setupStagger(root);
  setupCounters(root);
}

function onEnter(el, play, start = 'top 88%') {
  return ScrollTrigger.create({
    trigger: el,
    start,
    once: true,
    onEnter: () => gate.then(play),
  });
}

function setupLines(root) {
  root.querySelectorAll('[data-reveal="lines"]:not([data-revealed])').forEach((el) => {
    if (splits.has(el)) return;
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
    gsap.set(split.lines, { yPercent: 110 });
    el.style.visibility = 'visible';
    const trigger = onEnter(el, () => {
      gsap.to(split.lines, {
        yPercent: 0,
        duration: 1.25,
        ease: 'expo.out',
        stagger: 0.09,
        delay: Number(el.dataset.delay || 0),
        onComplete: () => {
          el.dataset.revealed = 'true';
          split.revert();
          splits.delete(el);
        },
      });
    });
    splits.set(el, { split, trigger });
  });
}

function setupFades(root) {
  root.querySelectorAll('[data-reveal="fade"]').forEach((el) => {
    gsap.set(el, { autoAlpha: 0, y: 40 });
    onEnter(el, () =>
      gsap.to(el, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out', delay: Number(el.dataset.delay || 0), clearProps: 'transform' }),
      'top 92%',
    );
  });
}

function setupImages(root) {
  root.querySelectorAll('[data-reveal="image"]').forEach((el) => {
    const media = el.querySelector('img, video, canvas');
    gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)' });
    if (media) gsap.set(media, { scale: 1.35 });
    onEnter(el, () => {
      const tl = gsap.timeline();
      tl.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' });
      if (media) tl.to(media, { scale: 1, duration: 2, ease: 'expo.out' }, 0.1);
    }, 'top 85%');
  });
}

function setupStagger(root) {
  root.querySelectorAll('[data-reveal="stagger"]').forEach((el) => {
    gsap.set(el.children, { autoAlpha: 0, y: 30 });
    onEnter(el, () =>
      gsap.to(el.children, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, clearProps: 'transform' }),
    );
  });
}

function setupParallax(root) {
  root.querySelectorAll('[data-parallax]').forEach((el) => {
    const amount = Number(el.dataset.parallax) || 0.15;
    gsap.fromTo(
      el,
      { yPercent: -amount * 100 },
      {
        yPercent: amount * 100,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
}

function formatCount(el, value) {
  const decimals = Number(el.dataset.decimals || 0);
  return fmtNumber(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + (el.dataset.suffix || '');
}

function setFinalCount(el) {
  el.textContent = formatCount(el, Number(el.dataset.count));
}

function setupCounters(root) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const state = { v: 0 };
    el.textContent = formatCount(el, 0);
    onEnter(el, () =>
      gsap.to(state, {
        v: Number(el.dataset.count),
        duration: 2.2,
        ease: 'power4.out',
        onUpdate: () => (el.textContent = formatCount(el, state.v)),
        onComplete: () => {
          el.dataset.counted = 'true';
          setFinalCount(el);
        },
      }),
      'top 92%',
    );
  });
}

// Duplicates the track once and loops it; scrolling speeds it up briefly.
function setupMarquees(root) {
  root.querySelectorAll('[data-marquee]').forEach((el) => {
    const track = el.querySelector('.marquee__track');
    if (!track) return;
    track.append(...[...track.children].map((n) => n.cloneNode(true)));
    const speed = Number(el.dataset.marquee) || 40;
    const tween = gsap.to(track, { xPercent: -50, duration: speed, ease: 'none', repeat: -1 });
    tween.totalTime(speed * 1000); // headroom so reversing (scrolling up) never hits time 0
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const dir = self.direction < 0 ? -1 : 1;
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 600, 4);
        gsap.to(tween, { timeScale: boost * dir, duration: 0.2, overwrite: true });
        gsap.to(tween, { timeScale: dir, duration: 1.2, delay: 0.2 });
      },
    });
  });
}

// Lets feature modules reveal content they inject after start-up.
export function refreshMotion(root) {
  if (reduced) return;
  setup(root);
  ScrollTrigger.refresh();
}
