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

initI18n();
initScroll({ smooth: !reduced && !coarse });
initHeader();
initSettings();
initPalette();
registerSiteCommands();
registerUnitSearch();
initBooking();
initCalculators();
initDrawings(document, { reduced });
if (!reduced) initCursor();

// Page features may expose a promise (e.g. the 3D scene compiling) that the intro waits for.
const pageReady = initPage(document.body.dataset.page, { reduced }) || Promise.resolve();

const fontsReady = document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve();
const ready = Promise.race([Promise.all([fontsReady, pageReady]), new Promise((r) => setTimeout(r, 4500))]);
const introDone = runIntro({ ready, reduced });

initMotion({ reduced, gate: introDone });
initElevator();
initTransitions({ reduced });

introDone.then(() => {
  document.documentElement.classList.add('is-ready');
  document.dispatchEvent(new CustomEvent('axis:ready'));
  ScrollTrigger.refresh();
  // deep link to a section (#location) after the intro
  if (location.hash.length > 1 && !location.hash.includes('=')) {
    const target = document.querySelector(location.hash);
    if (target) setTimeout(() => target.scrollIntoView(), 50);
  }
});
