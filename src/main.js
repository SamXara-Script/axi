// Entry point: shared chrome on every page, then the features the page asks for.
import { init as initI18n } from './core/i18n.js';
import { initScroll, ScrollTrigger } from './core/scroll.js';
import { initMotion } from './core/motion.js';
import { initCursor } from './core/cursor.js';
import { initHeader, runIntro, initTransitions } from './core/chrome.js';
import { initPalette } from './core/palette.js';
import { initElevator } from './core/elevator.js';
import { initSettings } from './core/settings.js';
import { store } from './core/store.js';
import { registerSiteCommands } from './features/commands.js';
import { registerUnitSearch } from './features/finder.js';
import { initBooking } from './features/booking.js';
import { initCalculators } from './features/calculator.js';
import { initDrawings } from './features/drawings.js';
import { initPage } from './pages/index.js';

const reduced =
  matchMedia('(prefers-reduced-motion: reduce)').matches ||
  store.get('motion') === 'off' ||
  /[?&]motion=off\b/.test(location.search) ||
  window.__AXIS_MOTION === 'off';
const coarse = matchMedia('(pointer: coarse)').matches;

// One feature that throws is logged and skipped; it must never stop the rest of the start-up
// (an uncaught error here used to leave the preloader on "B4" for good).
const safely = (fn) => {
  try {
    return fn();
  } catch (err) {
    console.error(err);
  }
};

safely(initI18n);
safely(() => initScroll({ smooth: !reduced && !coarse }));
safely(initHeader);
safely(initSettings);
safely(initPalette);
safely(registerSiteCommands);
safely(registerUnitSearch);
safely(initBooking);
safely(initCalculators);
safely(() => initDrawings(document, { reduced }));
if (!reduced) safely(initCursor);

// Page features may expose a promise (e.g. the 3D scene compiling) that the intro waits for.
const pageReady = safely(() => initPage(document.body.dataset.page, { reduced }));

const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
const ready = Promise.race([Promise.all([fontsReady, pageReady]), new Promise((r) => setTimeout(r, 4500))]);
// if the intro itself fails, the page is simply uncovered once it is ready
const introDone =
  safely(() => runIntro({ ready, reduced })) || ready.then(() => document.documentElement.classList.add('no-intro'));

safely(() => initMotion({ reduced, gate: introDone }));
safely(initElevator);
safely(() => initTransitions({ reduced }));

introDone.then(() => {
  document.documentElement.classList.add('is-ready');
  document.dispatchEvent(new CustomEvent('axis:ready'));
  ScrollTrigger.refresh();
  // deep link to a section (#location) after the intro; ids like "#24B" are not valid selectors
  if (location.hash.length > 1 && !location.hash.includes('=')) {
    const target = safely(() => document.getElementById(decodeURIComponent(location.hash.slice(1))));
    if (target) setTimeout(() => target.scrollIntoView(), 50);
  }
});
