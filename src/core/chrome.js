// Site chrome: header behaviour, full-screen menu, Tbilisi clock, language / theme / currency
// switches, preloader and page-to-page transitions.
import { gsap, ScrollTrigger, scrollTo, lockScroll, unlockScroll, scrollY } from './scroll.js';
import { setLang, lang, LANGS, t } from './i18n.js';
import { store, bus } from './store.js';
import { $, $$, replaceUrl } from './ui.js';

// ------------------------------------------------------------------ header
export function initHeader() {
  const header = $('.header');
  if (!header) return;
  let last = 0;
  let ticking = false;
  const update = () => {
    const y = scrollY();
    header.classList.toggle('is-scrolled', y > 40);
    const menuOpen = document.documentElement.classList.contains('menu-open');
    header.classList.toggle('is-hidden', !menuOpen && y > 400 && y > last + 2);
    if (y < last - 2) header.classList.remove('is-hidden');
    last = y;
    ticking = false;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();

  // header keyboard focus should always reveal it
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  // mark the current page in both navs
  const file = location.pathname.split('/').pop() || 'index.html';
  $$('.nav a, .menu__links a').forEach((a) => {
    if (a.getAttribute('href') === file) a.setAttribute('aria-current', 'page');
  });

  initClock();
  initMenu();
  initLangSwitch();
  initTheme();
  initAnchors();
}

function initClock() {
  const el = $('[data-clock]');
  if (!el) return;
  const fmt = () =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tbilisi', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const render = () => {
    el.innerHTML = `<b>${fmt()}</b><span>${t('chrome.tbilisi')} · 41.71°N</span>`;
  };
  render();
  setInterval(render, 15000);
  bus.on('lang', render);
}

function initMenu() {
  const toggle = $('[data-menu-toggle]');
  const menu = $('.menu');
  if (!toggle || !menu) return;
  const root = document.documentElement;
  const set = (open) => {
    root.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.toggleAttribute('inert', !open);
    if (open) lockScroll('menu');
    else unlockScroll('menu');
  };
  menu.setAttribute('inert', '');
  toggle.addEventListener('click', () => set(!root.classList.contains('menu-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('menu-open')) set(false);
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) set(false);
  });
  // the aside shows each destination's floor range in large type
  const preview = $('[data-menu-preview]', menu);
  $$('.menu__links a', menu).forEach((a, i) => {
    a.style.setProperty('--i', i);
    a.addEventListener('pointerenter', () => {
      if (!preview || preview.textContent === a.dataset.preview) return;
      gsap.fromTo(preview, { yPercent: 12, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out' });
      preview.textContent = a.dataset.preview;
    });
  });
  bus.on('menu:close', () => set(false));
}

function initLangSwitch() {
  const render = () => {
    $$('[data-lang]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang())));
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    switchLanguage(btn.dataset.lang);
  });
  bus.on('lang', render);
  render();
}

// Language changes get a quick veil so the swap reads as intentional, not a flicker.
export function switchLanguage(code) {
  if (code === lang()) return;
  const veil = document.createElement('div');
  veil.className = 'lang-veil';
  veil.innerHTML = `<span>${LANGS.find((l) => l.code === code)?.name || ''}</span>`;
  document.body.append(veil);
  gsap.fromTo(veil, { clipPath: 'inset(100% 0 0 0)' }, {
    clipPath: 'inset(0% 0 0 0)',
    duration: 0.55,
    ease: 'expo.inOut',
    onComplete: () => {
      setLang(code);
      ScrollTrigger.refresh();
      gsap.to(veil, {
        clipPath: 'inset(0 0 100% 0)',
        duration: 0.6,
        delay: 0.15,
        ease: 'expo.inOut',
        onComplete: () => veil.remove(),
      });
    },
  });
}

export function initTheme() {
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    $$('[data-theme-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', String(theme === 'light'));
      b.setAttribute('aria-label', t(theme === 'light' ? 'chrome.themeDark' : 'chrome.themeLight'));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'light' ? '#efebe4' : '#0a0b0d';
  };
  apply(store.get('theme', 'dark'));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    store.set('theme', next);
    apply(next);
    bus.emit('theme', next);
  });
}

// In-page anchors go through the smooth scroller.
function initAnchors() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    scrollTo(target, { offset: -20 });
    replaceUrl(a.getAttribute('href'));
  });
}

// ------------------------------------------------------------------ preloader + transitions
const FLOOR_SEQUENCE = ['B4', 'B3', 'B2', 'B1', ...Array.from({ length: 37 }, (_, i) => String(i + 1).padStart(2, '0'))];

// First visit: count up through the building while assets load. Returning visitors get the curtain.
export function runIntro({ ready, reduced }) {
  const root = document.documentElement;
  const returning = root.classList.contains('is-returning');
  try {
    sessionStorage.setItem('axis:visited', '1');
  } catch {
    /* storage blocked (sandboxed or private contexts) — the preloader simply shows again */
  }

  if (returning || reduced) {
    const curtain = $('.curtain');
    return ready.then(() => {
      if (!curtain) return;
      return gsap
        .to(curtain, { yPercent: -100, duration: reduced ? 0.01 : 0.9, ease: 'expo.inOut', delay: 0.05 })
        .then(() => {
          root.classList.remove('is-returning');
          gsap.set(curtain, { clearProps: 'transform' });
        });
    });
  }

  const pre = $('.preloader');
  if (!pre) return ready;
  const floorEl = $('.preloader__floor b', pre);
  const counter = { i: 0 };
  const word = $$('.preloader__word span', pre);
  const tl = gsap.timeline();
  tl.fromTo(word, { yPercent: 110 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06 }, 0.1)
    .to($('.preloader__axis', pre), { scaleY: 1, duration: 2.2, ease: 'power2.inOut' }, 0)
    .to(counter, {
      i: FLOOR_SEQUENCE.length - 1,
      duration: 2.2,
      ease: 'power2.inOut',
      onUpdate: () => (floorEl.textContent = FLOOR_SEQUENCE[Math.round(counter.i)]),
    }, 0);

  return Promise.all([ready, tl.then()]).then(
    () =>
      new Promise((resolve) => {
        gsap
          .timeline({ onComplete: () => (pre.remove(), resolve()) })
          .to(word, { yPercent: -110, duration: 0.6, ease: 'expo.in', stagger: 0.03 })
          .to($('.preloader__meta', pre), { autoAlpha: 0, duration: 0.3 }, 0)
          .to($('.preloader__axis', pre), { scaleX: 3, autoAlpha: 0, duration: 0.6 }, 0.45)
          .to($('.preloader__half--l', pre), { xPercent: -100, duration: 1.2, ease: 'expo.inOut' }, 0.5)
          .to($('.preloader__half--r', pre), { xPercent: 100, duration: 1.2, ease: 'expo.inOut' }, 0.5)
          .add(() => (pre.style.pointerEvents = 'none'), 0.9);
      }),
  );
}

// Internal page links: cover with the curtain, then navigate.
export function initTransitions({ reduced }) {
  const curtain = $('.curtain');
  if (!curtain || reduced) return;
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^(mailto|tel|https?|javascript):/i.test(href)) return;
    if (!/\.html(#.*)?$/.test(href) && href !== './') return;
    e.preventDefault();
    bus.emit('menu:close');
    gsap.fromTo(curtain, { yPercent: 100 }, {
      yPercent: 0,
      duration: 0.75,
      ease: 'expo.inOut',
      onComplete: () => (window.location.href = href),
    });
  });
  // back/forward cache: make sure the curtain is not left covering the page
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) gsap.set(curtain, { yPercent: 100 });
  });
}
