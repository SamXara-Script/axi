// Home: 3D hero (scroll-driven camera, live Tbilisi light), the full-screen explorer with the
// sunlight study, plus the stacking plan and the "view from your floor" sections.
import { gsap, ScrollTrigger, lockScroll, unlockScroll, scrollTo } from '../core/scroll.js';
import { t, fmtNumber, locale } from '../core/i18n.js';
import { bus } from '../core/store.js';
import { $, $$, icons, loadScript, replaceUrl } from '../core/ui.js';
import { PROJECT, ZONES } from '../data/project.js';
import { zonedDate, sunTimes, sunPosition, fmtClock } from '../features/sun.js';
import { initStacking } from '../features/stacking.js';
import { initViewSim } from '../features/viewsim.js';
import { renderNews } from '../features/news.js';

export function initHome({ reduced }) {
  initStacking();
  initViewSim();
  loadScript('assets/js/map.js').then(() => window.AxisMap.initMap({ t, bus })).catch(() => {});
  renderNews();
  initScrubText(reduced);
  return initHero({ reduced });
}

function webglAvailable() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // free the probe context for the real renderer
    return !!gl;
  } catch {
    return false;
  }
}

async function initHero({ reduced }) {
  const hero = $('[data-hero]');
  const canvas = $('[data-towers]');
  if (!hero || !canvas) return;

  // The copy entrance is wired up first, independent of the 3D bundle, so a slow load can
  // never leave the title hidden. The towers' own intro starts whenever both are ready.
  let towers = null;
  let entered = false;
  const startIntro = () => towers && entered && towers.ready.then(() => towers.playIntro(reduced ? 0 : 4.2));
  if (!reduced) {
    gsap.set($$('.hero__title > span > span', hero), { yPercent: 110 });
    gsap.set($$('[data-hero-fade]', hero), { autoAlpha: 0 });
  }
  const enter = () => {
    entered = true;
    startIntro();
    if (reduced) return;
    gsap.to($$('.hero__title > span > span', hero), { yPercent: 0, duration: 1.6, ease: 'expo.out', stagger: 0.12, delay: 0.5 });
    gsap.fromTo($$('[data-hero-fade]', hero), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.08, delay: 1.1 });
  };
  if (document.documentElement.classList.contains('is-ready')) enter();
  else document.addEventListener('axis:ready', enter, { once: true });

  if (!webglAvailable()) {
    hero.classList.add('is-static');
    return;
  }
  try {
    await loadScript('assets/js/scene.js');
  } catch {
    hero.classList.add('is-static');
    return;
  }
  const { createTowers } = window.AxisScene;
  const tip = $('.float-tip');
  // a cached scene.js arrives before the first paint: let the preloader show and start counting first
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    towers = createTowers(canvas, {
      reducedMotion: reduced,
      onHover: (info, e) => showTip(tip, info, e),
      onSelect: (info) => explorer.showFloor(info),
    });
  } catch (err) {
    // the renderer can still fail to get a context (GPU busy or blocklisted, too many contexts)
    console.error(err);
    hero.classList.add('is-static');
    return;
  }
  hero.classList.add('has-3d');

  // live Tbilisi light by default
  const clock = liveClock();
  towers.setDate(clock.now());
  setInterval(() => !explorer.active && hero.dataset.preset === 'live' && towers.setDate(clock.now()), 60000);
  initPresets(hero, towers, clock);

  // pinned hero: scrolling flies the camera up the towers while the copy fades away
  if (!reduced) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: '+=110%',
      pin: true,
      scrub: true,
      onUpdate: (self) => {
        towers.setScroll(self.progress);
        hero.style.setProperty('--p', self.progress.toFixed(3));
      },
    });
  }

  const explorer = initExplorer(hero, canvas, towers, clock);
  startIntro();

  // the preloader waits (up to its time limit) for the shaders, so the first frame is smooth
  return towers.ready;
}

// ------------------------------------------------------------------ hover tooltip
function zoneLabel(zone) {
  return t(`zones.${zone}`);
}

function showTip(tip, info, e) {
  if (!tip) return;
  if (!info || !e) {
    tip.classList.remove('is-visible');
    return;
  }
  tip.innerHTML = `
    <div class="float-tip__floor">${String(info.floor).padStart(2, '0')}<small>${t('explorer.floor')} · ${t(`towers.${info.tower}.short`)}</small></div>
    <div class="float-tip__zone" style="--dot:${ZONES[info.zone]?.color}"><i></i>${zoneLabel(info.zone)}</div>`;
  const x = Math.min(e.clientX + 18, window.innerWidth - tip.offsetWidth - 12);
  const y = Math.min(e.clientY + 18, window.innerHeight - tip.offsetHeight - 12);
  tip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  tip.classList.add('is-visible');
}

// ------------------------------------------------------------------ time of day
function liveClock() {
  return {
    now() {
      return new Date();
    },
    // Tbilisi wall-clock parts for a Date
    parts(date = new Date()) {
      const local = new Date(date.getTime() + PROJECT.utcOffset * 3600000);
      return {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth(),
        day: local.getUTCDate(),
        minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
      };
    },
  };
}

function initPresets(hero, towers, clock) {
  const buttons = $$('[data-preset]', hero);
  const label = $('[data-live-time]', hero);
  const { lat, lng } = PROJECT.coords;
  const apply = (preset) => {
    hero.dataset.preset = preset;
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === preset)));
    const p = clock.parts();
    if (preset === 'live') return towers.setDate(clock.now());
    const times = sunTimes(p.year, p.month, p.day, lat, lng, PROJECT.utcOffset);
    const minutes = {
      sunrise: (times.rise ?? 360) + 12,
      day: 13 * 60,
      sunset: (times.set ?? 1140) - 8,
      night: (times.set ?? 1140) + 75,
    }[preset];
    towers.setDate(zonedDate(p.year, p.month, p.day, minutes, PROJECT.utcOffset));
  };
  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.preset)));
  const renderLive = () => {
    if (label) label.textContent = fmtClock(clock.parts().minutes);
  };
  renderLive();
  setInterval(renderLive, 30000);
  apply('live');
}

// ------------------------------------------------------------------ explorer (full screen)
function initExplorer(hero, canvas, towers, clock) {
  const el = $('[data-explorer]');
  const stage = $('.explorer__stage', el);
  const home = canvas.parentElement;
  const timeInput = $('[data-explorer-time]', el);
  const dayInput = $('[data-explorer-day]', el);
  const playBtn = $('[data-explorer-play]', el);
  const card = $('[data-floor-card]', el);
  const compass = $('[data-compass]', el);
  const { lat, lng } = PROJECT.coords;
  let playing = null;
  let compassFrame = 0;

  // day-of-year slider (1–365) + minutes slider
  const start = clock.parts();
  const dayOfYear = (y, m, d) => Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 0)) / 86400000);
  dayInput.value = dayOfYear(start.year, start.month, start.day);
  timeInput.value = start.minutes;

  const api = {
    active: false,
    open() {
      api.active = true;
      el.hidden = false;
      stage.append(canvas);
      document.documentElement.classList.add('is-exploring');
      lockScroll('explorer');
      towers.resize();
      towers.setExplore(true);
      update();
      gsap.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
      $('[data-explorer-close]', el).focus({ preventScroll: true });
      spinCompass();
      replaceUrl('#explore');
    },
    close() {
      api.active = false;
      stopPlay();
      cancelAnimationFrame(compassFrame);
      towers.setExplore(false);
      towers.select(null);
      towers.setMode('real');
      $$('[data-explorer-mode]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.explorerMode === 'real')));
      home.prepend(canvas);
      towers.resize();
      el.hidden = true;
      card.hidden = true;
      document.documentElement.classList.remove('is-exploring');
      unlockScroll('explorer');
      ScrollTrigger.refresh();
      replaceUrl(location.pathname);
      $('[data-explore]')?.focus({ preventScroll: true });
    },
    showFloor(info) {
      if (!api.active || !info) return;
      renderCard(info);
    },
  };

  function currentDate() {
    const y = clock.parts().year;
    const date = new Date(Date.UTC(y, 0, Number(dayInput.value)));
    return { y, m: date.getUTCMonth(), d: date.getUTCDate(), minutes: Number(timeInput.value) };
  }

  function update() {
    const { y, m, d, minutes } = currentDate();
    const date = zonedDate(y, m, d, minutes, PROJECT.utcOffset);
    towers.setDate(date);
    const times = sunTimes(y, m, d, lat, lng, PROJECT.utcOffset);
    const pos = sunPosition(date, lat, lng);
    $('[data-out="time"]', el).textContent = fmtClock(minutes);
    $('[data-out="date"]', el).textContent = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, d)));
    $('[data-out="sunrise"]', el).textContent = times.rise != null ? fmtClock(times.rise) : '—';
    $('[data-out="sunset"]', el).textContent = times.set != null ? fmtClock(times.set) : '—';
    $('[data-out="altitude"]', el).textContent = `${fmtNumber((pos.altitude * 180) / Math.PI, { maximumFractionDigits: 0 })}°`;
    $('[data-out="daylight"]', el).textContent =
      times.rise != null && times.set != null ? t('explorer.hours', { h: fmtNumber((times.set - times.rise) / 60, { maximumFractionDigits: 1 }) }) : '—';
    [timeInput, dayInput].forEach((r) => r.style.setProperty('--fill', `${((r.value - r.min) / (r.max - r.min)) * 100}%`));
  }

  function stopPlay() {
    if (!playing) return;
    playing.kill();
    playing = null;
    playBtn.innerHTML = icons.play;
    playBtn.setAttribute('aria-label', t('explorer.play'));
  }

  playBtn.addEventListener('click', () => {
    if (playing) return stopPlay();
    const state = { v: Number(timeInput.value) };
    if (state.v > 1300) state.v = 300;
    playBtn.innerHTML = icons.pause;
    playBtn.setAttribute('aria-label', t('explorer.pause'));
    playing = gsap.to(state, {
      v: 1380,
      duration: ((1380 - state.v) / 1080) * 18,
      ease: 'none',
      onUpdate: () => {
        timeInput.value = Math.round(state.v / 5) * 5;
        update();
      },
      onComplete: stopPlay,
    });
  });

  timeInput.addEventListener('input', () => {
    stopPlay();
    update();
  });
  dayInput.addEventListener('input', update);
  $('[data-explorer-now]', el).addEventListener('click', () => {
    const p = clock.parts();
    dayInput.value = dayOfYear(p.year, p.month, p.day);
    timeInput.value = Math.round(p.minutes / 5) * 5;
    stopPlay();
    update();
  });
  $$('[data-explorer-season]', el).forEach((b) =>
    b.addEventListener('click', () => {
      dayInput.value = b.dataset.explorerSeason;
      update();
    }),
  );
  $$('[data-explorer-mode]', el).forEach((b) =>
    b.addEventListener('click', () => {
      towers.setMode(b.dataset.explorerMode);
      $$('[data-explorer-mode]', el).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      $('[data-explorer-legend]', el).hidden = b.dataset.explorerMode !== 'functions';
    }),
  );
  $$('[data-explorer-focus]', el).forEach((b) => b.addEventListener('click', () => towers.focusTower(b.dataset.explorerFocus || null)));
  $('[data-explorer-close]', el).addEventListener('click', () => api.close());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && api.active && api.close());
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-explore]')) {
      e.preventDefault();
      if (window.scrollY > 10) scrollTo(0, { immediate: true });
      api.open();
    }
  });
  bus.on('lang', () => api.active && update());

  function spinCompass() {
    const tick = () => {
      compass.style.setProperty('--heading', `${-towers.heading()}deg`);
      compassFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  function renderCard(info) {
    const floor = String(info.floor).padStart(2, '0');
    const cta = {
      residential: `<a class="btn btn--primary btn--sm" href="residences.html?floor=${info.floor}">${t('explorer.ctaResidential')}</a>`,
      office: `<a class="btn btn--primary btn--sm" href="offices.html?floor=${info.floor}">${t('explorer.ctaOffice')}</a>`,
      hotel: `<a class="btn btn--primary btn--sm" href="${PROJECT.hotelUrl}" target="_blank" rel="noopener">${t('explorer.ctaHotel')}</a>`,
      dining: `<a class="btn btn--primary btn--sm" href="hotel.html#dining">${t('explorer.ctaDining')}</a>`,
      retail: `<button class="btn btn--primary btn--sm" type="button" data-book="retail">${t('explorer.ctaRetail')}</button>`,
    }[info.zone] || '';
    card.innerHTML = `
      <button class="icon-btn icon-btn--sm floor-card__close" type="button" data-card-close aria-label="${t('common.close')}">${icons.close}</button>
      <p class="label">${t(`towers.${info.tower}.name`)}</p>
      <p class="floor-card__num">${floor}<small>/ 37</small></p>
      <p class="floor-card__zone" style="--dot:${ZONES[info.zone]?.color}"><i></i>${zoneLabel(info.zone)}</p>
      <p class="small muted">${t(`zoneInfo.${info.zone}`)}</p>
      <p class="small faint">${t('explorer.height', { m: fmtNumber(info.floor * PROJECT.massing.floorHeight, { maximumFractionDigits: 0 }) })}</p>
      ${cta}`;
    card.hidden = false;
    $('[data-card-close]', card).addEventListener('click', () => {
      card.hidden = true;
      towers.select(null);
    });
  }

  if (location.hash === '#explore') document.addEventListener('axis:ready', () => api.open(), { once: true });
  return api;
}

// Intro paragraph: words brighten one by one as the section scrolls past.
function initScrubText(reduced) {
  const el = $('[data-scrub-text]');
  if (!el || reduced) return;
  let trigger;
  const build = () => {
    trigger?.kill();
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map((w) => `<span class="scrub-word">${w}</span> `).join('');
    const spans = $$('.scrub-word', el);
    trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 80%',
      end: 'bottom 45%',
      scrub: true,
      onUpdate: (self) => {
        const lit = Math.round(self.progress * spans.length);
        spans.forEach((s, i) => s.classList.toggle('is-lit', i < lit));
      },
    });
  };
  build();
  bus.on('lang', () => requestAnimationFrame(build));
}
