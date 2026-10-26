// Small page initialisers for the inner pages.
import { t, tList } from '../core/i18n.js';
import { bus } from '../core/store.js';
import { area as fmtArea } from '../core/currency.js';
import { $$, loadScript, copyText, toast, escapeHtml } from '../core/ui.js';
import { renderNews } from '../features/news.js';
import { initFinder, openUnit } from '../features/finder.js';
import { planSvg } from '../features/floorplan.js';
import { initTwistDemo } from '../features/drawings.js';
import { UNITS } from '../data/units.js';

function finder(kind) {
  const el = document.querySelector(`[data-finder="${kind}"]`);
  if (el) initFinder(el, kind);
}

// FAQ accordions come from translated lists (faq.<name> in the dictionaries).
function renderFaq() {
  $$('[data-faq]').forEach((el) => {
    const render = () => {
      el.innerHTML = tList(`faq.${el.dataset.faq}`)
        .map((item) => `<details><summary>${escapeHtml(item.q)}</summary><div><p>${escapeHtml(item.a)}</p></div></details>`)
        .join('');
    };
    render();
    bus.on('lang', render);
  });
}

// One representative plan per apartment type.
function renderLayouts() {
  $$('[data-layouts]').forEach((el) => {
    const picks = ['D', 'C', 'B', 'A', 'P1'].map((letter) => UNITS.find((u) => u.kind === 'apartment' && u.letter === letter));
    const render = () => {
      el.innerHTML = picks
        .map(
          (u) => `
          <button type="button" class="layout-card" data-unit="${u.id}">
            <span class="layout-card__plan">${planSvg(u, { size: 420 })}</span>
            <span class="layout-card__title">${escapeHtml(t(`finder.roomsShort.${u.rooms}`))}</span>
            <span class="layout-card__meta">${escapeHtml(fmtArea(u.area))} · ${escapeHtml(t('finder.orientation'))} ${escapeHtml(t(`finder.dirs.${u.faces}`))}</span>
          </button>`,
        )
        .join('');
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-unit]');
      if (b) openUnit(b.dataset.unit);
    });
    render();
    bus.on('lang', render);
    bus.on('area', render);
  });
}

function mapAndCopy() {
  if (document.querySelector('[data-map]')) {
    loadScript('assets/js/map.js')
      .then(() => window.AxisMap.initMap({ t, bus }))
      .catch(() => {});
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    copyText(b.dataset.copy).then((ok) => ok && toast(t('common.copied')));
  });
}

export function initResidencesPage() {
  finder('apartment');
  renderLayouts();
  renderFaq();
}

export function initOfficesPage() {
  finder('office');
  renderFaq();
}

export function initNewsPage() {
  renderNews();
}

export function initContactPage() {
  mapAndCopy();
  renderFaq();
}

export function initAboutPage() {
  initTwistDemo();
}

export function initGenericPage() {
  renderFaq();
  mapAndCopy();
}
