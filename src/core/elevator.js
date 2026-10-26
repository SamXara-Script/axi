// The page as a building: every <section data-floor="07" data-floor-label="i18n.key"> is a stop.
// A lift display tracks where you are; clicking it opens a lift panel to jump between floors.
import { gsap, ScrollTrigger, scrollTo } from './scroll.js';
import { t } from './i18n.js';
import { bus } from './store.js';
import { layer, icons, h, $, $$ } from './ui.js';

export function initElevator() {
  // sections carry a lift label; other [data-floor] elements (plans, strips) are not stops
  const sections = $$('[data-floor][data-floor-label]');
  if (sections.length < 3) return;

  const el = h(`
    <button class="elevator" type="button" aria-haspopup="dialog" data-cursor-i18n="elevator.cursor" data-cursor="Lift">
      <span class="elevator__arrow" data-dir="up">${icons.arrowUp}</span>
      <span class="elevator__display" aria-live="off"><span></span></span>
      <span class="elevator__arrow" data-dir="down">${icons.arrowDown}</span>
      <span class="elevator__label"></span>
    </button>`);
  document.body.append(el);
  const display = $('.elevator__display', el);
  const label = $('.elevator__label', el);
  const up = $('[data-dir="up"]', el);
  const down = $('[data-dir="down"]', el);

  const panel = h(`
    <div class="modal lift-panel" role="dialog" aria-modal="true" aria-labelledby="lift-title">
      <div class="modal__panel">
        <button class="icon-btn icon-btn--sm modal__close" type="button" data-close aria-label="Close">${icons.close}</button>
        <p class="eyebrow" data-i18n="elevator.eyebrow">${t('elevator.eyebrow')}</p>
        <h2 class="h3" id="lift-title" style="margin-top:14px" data-i18n="elevator.title">${t('elevator.title')}</h2>
        <div class="lift-panel__grid"></div>
      </div>
    </div>`);
  document.body.append(panel);
  const grid = $('.lift-panel__grid', panel);
  const modal = layer(panel);

  let current = -1;

  function renderPanel() {
    // top floor first, like a real lift panel
    grid.innerHTML = sections
      .map((s, i) => ({ s, i }))
      .reverse()
      .map(
        ({ s, i }) =>
          `<button class="lift-btn" type="button" data-go="${i}" aria-current="${i === current}"><b>${s.dataset.floor}</b><span>${t(s.dataset.floorLabel)}</span></button>`,
      )
      .join('');
  }

  function show(index, direction) {
    if (index === current) return;
    const s = sections[index];
    const next = document.createElement('span');
    next.textContent = s.dataset.floor;
    const prev = display.lastElementChild;
    display.append(next);
    const dy = direction > 0 ? 100 : -100;
    gsap.fromTo(next, { yPercent: dy }, { yPercent: 0, duration: 0.6, ease: 'expo.out' });
    if (prev) gsap.to(prev, { yPercent: -dy, duration: 0.6, ease: 'expo.out', onComplete: () => prev.remove() });
    label.textContent = t(s.dataset.floorLabel);
    current = index;
    up.classList.toggle('is-active', direction < 0);
    down.classList.toggle('is-active', direction > 0);
    clearTimeout(show.timer);
    show.timer = setTimeout(() => {
      up.classList.remove('is-active');
      down.classList.remove('is-active');
    }, 900);
  }

  sections.forEach((s, i) => {
    ScrollTrigger.create({
      trigger: s,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => self.isActive && show(i, self.direction),
    });
  });

  // hide the lift over the hero so it doesn't compete with the 3D scene
  const hero = $('[data-hero]');
  if (hero) {
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: 'bottom 30%',
      onToggle: (self) => el.classList.toggle('is-hidden', self.isActive),
    });
  }

  el.addEventListener('click', () => {
    renderPanel();
    modal.open();
  });
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-go]');
    if (!btn) return;
    modal.close();
    scrollTo(sections[Number(btn.dataset.go)], { offset: 0 });
  });
  bus.on('lang', () => {
    if (current >= 0) label.textContent = t(sections[current].dataset.floorLabel);
    if (modal.isOpen) renderPanel();
  });

  return { sections: () => sections.map((s) => ({ floor: s.dataset.floor, label: s.dataset.floorLabel, el: s })) };
}
