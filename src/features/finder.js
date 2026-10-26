// Unit finder — apartments (residences page) and offices (offices page).
// Filters, availability-by-floor strip, saved units, compare (up to 3), a detail drawer with an
// indicative plan, deep links (#unit=12A, ?floor=24) and unit search in the command palette.
import { t } from '../core/i18n.js';
import { bus, persistentSet } from '../core/store.js';
import { money, area as fmtArea } from '../core/currency.js';
import { $, $$, h, icons, layer, escapeHtml, toast, copyText, replaceUrl } from '../core/ui.js';
import { registerProvider } from '../core/palette.js';
import { scrollTo } from '../core/scroll.js';
import { UNITS, IS_DEMO } from '../data/units.js';
import { planSvg } from './floorplan.js';
import { openBooking } from './booking.js';
import { setCalculatorPrice } from './calculator.js';

const saved = persistentSet('saved');
const compared = persistentSet('compare', 3);
const PAGE = 24;

const byId = (id) => UNITS.find((u) => u.id.toLowerCase() === String(id).toLowerCase());
const valueOf = (u) => (u.kind === 'office' ? u.rent : u.price);
const isOpen = (u) => u.status === 'available' || u.status === 'reserved';
const pageFor = (u) => (u.kind === 'office' ? 'offices.html' : 'residences.html');

export function unitTitle(u) {
  if (u.kind === 'office') return `${t('finder.office')} ${u.id}`;
  return `№ ${u.id} · ${t(`finder.roomsShort.${u.rooms}`)}`;
}

function priceLine(u) {
  if (u.kind === 'office') {
    return `<b>${escapeHtml(money(u.rent))}</b><small>${escapeHtml(t('finder.perMonth'))} · ${escapeHtml(money(u.perM2))} ${escapeHtml(t('finder.perM2'))}</small>`;
  }
  return `<b>${escapeHtml(money(u.price))}</b><small>${escapeHtml(money(u.perM2))} ${escapeHtml(t('finder.perM2'))}</small>`;
}

// ------------------------------------------------------------------ dual range control
function dualRange(el, { min, max, step, value, format, onInput }) {
  el.innerHTML = `
    <div class="range__head"><span class="label">${escapeHtml(t(el.dataset.label))}</span><span class="range__value"></span></div>
    <div class="dual-range">
      <div class="dual-range__track"><div class="dual-range__fill"></div></div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value[0]}" aria-label="${escapeHtml(t(el.dataset.label))} — min">
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value[1]}" aria-label="${escapeHtml(t(el.dataset.label))} — max">
    </div>`;
  const [a, b] = $$('input', el);
  const out = $('.range__value', el);
  const fill = $('.dual-range__fill', el);
  const sync = (emit) => {
    let lo = Number(a.value);
    let hi = Number(b.value);
    if (lo > hi) [lo, hi] = [hi, lo];
    out.textContent = lo === hi ? format(lo) : `${format(lo)} – ${format(hi)}`;
    fill.style.left = `${((lo - min) / (max - min)) * 100}%`;
    fill.style.right = `${100 - ((hi - min) / (max - min)) * 100}%`;
    if (emit) onInput([lo, hi]);
  };
  a.addEventListener('input', () => sync(true));
  b.addEventListener('input', () => sync(true));
  sync(false);
  return {
    set([lo, hi]) {
      a.value = lo;
      b.value = hi;
      sync(false);
    },
    refresh: () => sync(false),
  };
}

// ------------------------------------------------------------------ markup
function template(kind) {
  const roomChips =
    kind === 'apartment'
      ? `<div class="finder__group">
          <p class="label">${t('finder.rooms')}</p>
          <div class="row finder__chips" role="group" aria-label="${escapeHtml(t('finder.rooms'))}">
            ${['any', 0, 1, 2, 3, 4]
              .map((r) => `<button type="button" class="chip" data-rooms="${r}">${escapeHtml(r === 'any' ? t('finder.any') : r === 0 ? t('finder.studio') : r === 4 ? t('finder.roomsShort.4') : String(r))}</button>`)
              .join('')}
          </div>
        </div>`
      : '';
  return `
    ${IS_DEMO ? `<p class="finder__demo">${escapeHtml(t('finder.demo'))}</p>` : ''}
    <div class="finder__filters">
      ${roomChips}
      <div class="range finder__range" data-range="floor" data-label="finder.floor"></div>
      <div class="range finder__range" data-range="area" data-label="finder.area"></div>
      <div class="range finder__range" data-range="price" data-label="${kind === 'office' ? 'finder.rent' : 'finder.price'}"></div>
    </div>
    <div class="finder__strip-wrap">
      <p class="label">${t('finder.byFloor')}</p>
      <div class="finder__strip" role="group" aria-label="${escapeHtml(t('finder.byFloor'))}"></div>
      <p class="finder__strip-legend small faint"><span>${t('finder.fewer')}</span><i></i><span>${t('finder.more')}</span></p>
    </div>
    <div class="finder__bar">
      <p class="finder__count"><b data-count-out></b> <span>${t('finder.resultsLabel')}</span></p>
      <label class="switch"><input type="checkbox" data-toggle="available"><span></span>${t('finder.onlyAvailable')}</label>
      <label class="switch"><input type="checkbox" data-toggle="saved"><span></span>${t('finder.saved')}</label>
      <label class="finder__sort"><span class="visually-hidden">${t('finder.sort')}</span>
        <select data-sort>
          ${['floor', 'priceAsc', 'priceDesc', 'area'].map((s) => `<option value="${s}">${escapeHtml(t(`finder.sortOptions.${s}`))}</option>`).join('')}
        </select>
      </label>
      <div class="segmented" role="group" aria-label="View">
        <button type="button" data-view="grid" aria-label="${escapeHtml(t('finder.grid'))}">${icons.grid}</button>
        <button type="button" data-view="list" aria-label="${escapeHtml(t('finder.list'))}">${icons.list}</button>
      </div>
      <button type="button" class="link" data-reset>${t('finder.reset')}</button>
    </div>
    <div class="finder__results" aria-live="polite"></div>
    <div class="finder__more"><button type="button" class="btn" data-more>${t('finder.showMore')}</button></div>`;
}

function card(u) {
  const sold = !isOpen(u);
  const type = u.kind === 'office' ? fmtArea(u.area) : `${t(`finder.roomsShort.${u.rooms}`)} · ${fmtArea(u.area)}`;
  return `
    <article class="unit-card${sold ? ' is-sold' : ''}" data-id="${u.id}">
      <div class="unit-card__plan" aria-hidden="true">${planSvg(u, { size: 300, labels: false })}</div>
      <div class="unit-card__head">
        <span class="unit-card__id">${u.kind === 'office' ? escapeHtml(u.id) : `№ ${escapeHtml(u.id)}`}</span>
        <span class="tag tag--${u.status}">${escapeHtml(t(`finder.statusLabel.${u.status}`))}</span>
      </div>
      <h3 class="unit-card__type"><button type="button" class="unit-card__open" data-open="${u.id}">${escapeHtml(type)}</button></h3>
      <dl class="unit-card__meta">
        <div><dt>${escapeHtml(t('finder.floor'))}</dt><dd>${u.floor}</dd></div>
        <div><dt>${escapeHtml(t('finder.orientation'))}</dt><dd>${escapeHtml(t(`finder.dirs.${u.faces}`))}</dd></div>
      </dl>
      <div class="unit-card__price">${priceLine(u)}</div>
      <div class="unit-card__actions">
        <button type="button" class="icon-btn icon-btn--sm" data-save="${u.id}" aria-pressed="${saved.has(u.id)}" aria-label="${escapeHtml(t(saved.has(u.id) ? 'finder.unsave' : 'finder.save'))}">${saved.has(u.id) ? icons.heartFull : icons.heart}</button>
        <button type="button" class="icon-btn icon-btn--sm" data-compare="${u.id}" aria-pressed="${compared.has(u.id)}" aria-label="${escapeHtml(t('finder.compare'))}">${icons.compare}</button>
      </div>
    </article>`;
}

// ------------------------------------------------------------------ finder
export function initFinder(root, kind) {
  const all = UNITS.filter((u) => u.kind === kind);
  const floors = [Math.min(...all.map((u) => u.floor)), Math.max(...all.map((u) => u.floor))];
  const areas = [Math.floor(Math.min(...all.map((u) => u.area))), Math.ceil(Math.max(...all.map((u) => u.area)))];
  const priceStep = kind === 'office' ? 500 : 10000;
  const values = all.map(valueOf);
  const prices = [Math.floor(Math.min(...values) / priceStep) * priceStep, Math.ceil(Math.max(...values) / priceStep) * priceStep];
  const defaults = () => ({ rooms: 'any', floor: [...floors], area: [...areas], price: [...prices], available: false, saved: false, shown: PAGE });

  const state = { ...defaults(), sort: 'floor', view: 'grid' };
  const qFloor = Number(new URLSearchParams(location.search).get('floor'));
  if (qFloor >= floors[0] && qFloor <= floors[1]) state.floor = [qFloor, qFloor];

  let ranges = {};
  function build() {
    root.innerHTML = template(kind);
    ranges = {
      floor: dualRange($('[data-range="floor"]', root), { min: floors[0], max: floors[1], step: 1, value: state.floor, format: String, onInput: (v) => update({ floor: v }) }),
      area: dualRange($('[data-range="area"]', root), { min: areas[0], max: areas[1], step: 1, value: state.area, format: (v) => fmtArea(v, 0), onInput: (v) => update({ area: v }) }),
      price: dualRange($('[data-range="price"]', root), {
        min: prices[0],
        max: prices[1],
        step: priceStep,
        value: state.price,
        format: (v) => money(v, { compact: true }),
        onInput: (v) => update({ price: v }),
      }),
    };
    $('[data-sort]', root).value = state.sort;
    render();
  }

  function update(patch) {
    Object.assign(state, patch, { shown: PAGE });
    render();
  }

  function filtered() {
    const sorters = {
      floor: (a, b) => a.floor - b.floor || a.letter.localeCompare(b.letter),
      priceAsc: (a, b) => valueOf(a) - valueOf(b),
      priceDesc: (a, b) => valueOf(b) - valueOf(a),
      area: (a, b) => b.area - a.area,
    };
    return all
      .filter(
        (u) =>
          (state.rooms === 'any' || u.rooms === state.rooms) &&
          u.floor >= state.floor[0] &&
          u.floor <= state.floor[1] &&
          u.area >= state.area[0] &&
          u.area <= state.area[1] &&
          valueOf(u) >= state.price[0] &&
          valueOf(u) <= state.price[1] &&
          (!state.available || isOpen(u)) &&
          (!state.saved || saved.has(u.id)),
      )
      .sort(sorters[state.sort]);
  }

  // availability by floor: one hue, darker = more units on offer
  function renderStrip() {
    const per = {};
    all.forEach((u) => (per[u.floor] = (per[u.floor] || 0) + (isOpen(u) ? 1 : 0)));
    const max = Math.max(1, ...Object.values(per));
    let cells = '';
    for (let f = floors[0]; f <= floors[1]; f++) {
      const n = per[f] || 0;
      const active = f >= state.floor[0] && f <= state.floor[1];
      const label = t('finder.floorAvailability', { floor: f, n });
      cells += `<button type="button" class="strip__cell${active ? ' is-active' : ''}${n ? '' : ' is-empty'}" data-floor="${f}" style="--v:${(n / max).toFixed(2)}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}"><span>${f}</span></button>`;
    }
    $('.finder__strip', root).innerHTML = cells;
  }

  function render() {
    const list = filtered();
    const grid = $('.finder__results', root);
    grid.dataset.view = state.view;
    const visible = list.slice(0, state.shown);
    grid.innerHTML = visible.length ? visible.map(card).join('') : `<p class="finder__empty">${escapeHtml(t('finder.empty'))}</p>`;
    $('[data-count-out]', root).textContent = t('finder.results', { count: list.length, total: all.length });
    $('[data-more]', root).hidden = list.length <= state.shown;
    $$('[data-rooms]', root).forEach((b) => b.setAttribute('aria-pressed', String(String(state.rooms) === b.dataset.rooms)));
    $$('[data-view]', root).forEach((b) => b.setAttribute('aria-pressed', String(state.view === b.dataset.view)));
    $('[data-toggle="available"]', root).checked = state.available;
    $('[data-toggle="saved"]', root).checked = state.saved;
    renderStrip();
  }

  root.addEventListener('click', (e) => {
    const target = e.target.closest('button, .unit-card');
    if (!target) return;
    if (target.dataset.rooms) return update({ rooms: target.dataset.rooms === 'any' ? 'any' : Number(target.dataset.rooms) });
    if (target.dataset.view) return update({ view: target.dataset.view });
    if (target.matches('.strip__cell')) {
      const f = Number(target.dataset.floor);
      const next = state.floor[0] === f && state.floor[1] === f ? [...floors] : [f, f];
      ranges.floor.set(next);
      return update({ floor: next });
    }
    if (target.dataset.save) {
      saved.toggle(target.dataset.save);
      toast(t(saved.has(target.dataset.save) ? 'finder.savedToast' : 'finder.removedToast'), { icon: 'heart', timeout: 1800 });
      return;
    }
    if (target.dataset.compare) {
      if (!compared.toggle(target.dataset.compare)) toast(t('finder.compareMax'), { icon: 'compare' });
      return;
    }
    if ('more' in target.dataset) {
      state.shown += PAGE;
      return render();
    }
    if ('reset' in target.dataset) {
      Object.assign(state, defaults());
      ranges.floor.set(state.floor);
      ranges.area.set(state.area);
      ranges.price.set(state.price);
      return render();
    }
    const cardEl = target.closest('.unit-card');
    if (cardEl && !e.target.closest('.unit-card__actions')) openUnit(cardEl.dataset.id);
  });
  root.addEventListener('change', (e) => {
    if (e.target.dataset.toggle) update({ [e.target.dataset.toggle]: e.target.checked });
    if (e.target.matches('[data-sort]')) update({ sort: e.target.value });
  });

  bus.on('saved', render);
  bus.on('compare', render);
  bus.on('currency', () => {
    ranges.price.refresh();
    render();
  });
  bus.on('area', () => {
    ranges.area.refresh();
    render();
  });
  bus.on('lang', build);

  build();
  initTray();
  if (location.hash.startsWith('#unit=')) {
    document.addEventListener('axis:ready', () => openUnit(decodeURIComponent(location.hash.slice(6))), { once: true });
  }
}

// ------------------------------------------------------------------ unit drawer
let drawer;
let drawerEl;
let current = null;

function ensureDrawer() {
  if (drawer) return;
  drawerEl = h(`<aside class="drawer unit-drawer" role="dialog" aria-modal="true" aria-labelledby="unit-title">
      <div class="drawer__head">
        <div><p class="label" data-unit-kicker></p><h2 class="h3" id="unit-title"></h2></div>
        <button class="icon-btn icon-btn--sm" type="button" data-close aria-label="Close">${icons.close}</button>
      </div>
      <div class="drawer__body" data-lenis-prevent></div>
      <div class="drawer__foot"></div>
    </aside>`);
  document.body.append(drawerEl);
  drawer = layer(drawerEl, {
    onClose: () => {
      current = null;
      if (location.hash.startsWith('#unit=')) replaceUrl(location.pathname + location.search);
    },
  });
  drawerEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !current) return;
    const u = current;
    if ('book' in b.dataset) {
      drawer.close();
      openBooking({ interest: u.kind === 'office' ? 'office' : 'residence', unit: unitTitle(u) });
    } else if ('calc' in b.dataset) {
      drawer.close();
      setCalculatorPrice(u.price);
      setTimeout(() => scrollTo('#calculator', { offset: -20 }), 350);
    } else if ('share' in b.dataset) {
      const url = `${location.href.split('#')[0].split('?')[0]}#unit=${encodeURIComponent(u.id)}`;
      copyText(url).then((ok) => ok && toast(t('common.copied')));
    } else if ('save' in b.dataset) {
      saved.toggle(u.id);
      fillDrawer(u);
    } else if ('compare' in b.dataset) {
      if (!compared.toggle(u.id)) toast(t('finder.compareMax'), { icon: 'compare' });
      fillDrawer(u);
    }
  });
  bus.on('lang', () => current && fillDrawer(current));
  bus.on('currency', () => current && fillDrawer(current));
  bus.on('area', () => current && fillDrawer(current));
}

function fillDrawer(u) {
  $('[data-unit-kicker]', drawerEl).textContent = `${t(`towers.${u.tower}.name`)} · ${t('finder.floor')} ${u.floor}`;
  $('#unit-title', drawerEl).textContent = unitTitle(u);
  const rows = [
    [t('finder.total'), fmtArea(u.area)],
    u.living ? [t('finder.living'), fmtArea(u.living)] : null,
    u.kind === 'apartment' ? [t('finder.rooms'), t(`finder.roomsShort.${u.rooms}`)] : null,
    u.baths ? [t('finder.bathrooms'), String(u.baths)] : null,
    [t('finder.floor'), String(u.floor)],
    [t('finder.orientation'), t(`finder.dirs.${u.faces}`)],
    [t('finder.status'), t(`finder.statusLabel.${u.status}`)],
  ].filter(Boolean);
  $('.drawer__body', drawerEl).innerHTML = `
    <div class="unit-drawer__plan">${planSvg(u, { size: 560 })}</div>
    <p class="small faint">${escapeHtml(t('finder.plan'))}</p>
    <div class="unit-drawer__price">${priceLine(u)}</div>
    <dl class="unit-drawer__facts">${rows.map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
    ${IS_DEMO ? `<p class="finder__demo">${escapeHtml(t('finder.demo'))}</p>` : ''}`;
  $('.drawer__foot', drawerEl).innerHTML = `
    <button type="button" class="btn btn--primary btn--sm" data-book>${icons.calendar}${escapeHtml(t('finder.book'))}</button>
    ${u.kind === 'apartment' && document.querySelector('[data-calculator]') ? `<button type="button" class="btn btn--sm" data-calc>${icons.calc}${escapeHtml(t('finder.calculate'))}</button>` : ''}
    <button type="button" class="icon-btn icon-btn--sm" data-save aria-pressed="${saved.has(u.id)}" aria-label="${escapeHtml(t(saved.has(u.id) ? 'finder.unsave' : 'finder.save'))}">${saved.has(u.id) ? icons.heartFull : icons.heart}</button>
    <button type="button" class="icon-btn icon-btn--sm" data-compare aria-pressed="${compared.has(u.id)}" aria-label="${escapeHtml(t('finder.compare'))}">${icons.compare}</button>
    <button type="button" class="icon-btn icon-btn--sm" data-share aria-label="${escapeHtml(t('finder.share'))}">${icons.share}</button>`;
}

export function openUnit(id) {
  const u = byId(id);
  if (!u) return;
  if (!document.querySelector(`[data-finder="${u.kind}"]`)) {
    window.location.href = `${pageFor(u)}#unit=${encodeURIComponent(u.id)}`;
    return;
  }
  ensureDrawer();
  current = u;
  fillDrawer(u);
  drawer.open();
  replaceUrl(`${location.pathname}${location.search}#unit=${encodeURIComponent(u.id)}`);
}

// ------------------------------------------------------------------ compare tray + table
let tray;
let compareModal;
function initTray() {
  if (tray) return;
  tray = h('<div class="compare-tray" hidden></div>');
  document.body.append(tray);
  const modalEl = h(`<div class="modal compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title">
      <div class="modal__panel" data-lenis-prevent>
        <button class="icon-btn icon-btn--sm modal__close" type="button" data-close aria-label="Close">${icons.close}</button>
        <div class="compare-modal__body"></div>
      </div>
    </div>`);
  document.body.append(modalEl);
  compareModal = layer(modalEl);

  tray.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.remove) compared.remove(b.dataset.remove);
    if ('clear' in b.dataset) compared.clear();
    if ('open' in b.dataset) {
      renderCompare();
      compareModal.open();
    }
  });
  const renderTray = () => {
    const units = compared.list().map(byId).filter(Boolean);
    tray.hidden = !units.length;
    tray.innerHTML = `
      <span class="compare-tray__label">${escapeHtml(t('finder.compareTray', { n: units.length }))}</span>
      <div class="compare-tray__items">${units
        .map((u) => `<button type="button" class="chip" data-remove="${u.id}" aria-label="${escapeHtml(t('finder.removeFromCompare', { id: u.id }))}">${escapeHtml(u.id)} ${icons.close}</button>`)
        .join('')}</div>
      <button type="button" class="btn btn--primary btn--sm" data-open ${units.length < 2 ? 'disabled' : ''}>${escapeHtml(t('finder.compare'))}</button>
      <button type="button" class="link" data-clear>${escapeHtml(t('finder.clear'))}</button>`;
    if (compareModal.isOpen) renderCompare();
  };
  bus.on('compare', renderTray);
  bus.on('lang', renderTray);
  bus.on('currency', renderTray);
  renderTray();
}

function renderCompare() {
  const units = compared.list().map(byId).filter(Boolean);
  const body = $('.compare-modal__body');
  const row = (label, fn) => `<tr><th scope="row">${escapeHtml(label)}</th>${units.map((u) => `<td>${fn(u)}</td>`).join('')}</tr>`;
  body.innerHTML = `
    <p class="eyebrow">${escapeHtml(t('finder.compareTitle'))}</p>
    <h2 class="h3" id="compare-title" style="margin:12px 0 24px">${units.map((u) => escapeHtml(u.id)).join(' · ')}</h2>
    <div class="compare-table">
      <table>
        <thead><tr><th></th>${units.map((u) => `<th scope="col"><div class="compare-table__plan">${planSvg(u, { size: 260, labels: false })}</div>${escapeHtml(unitTitle(u))}</th>`).join('')}</tr></thead>
        <tbody>
          ${row(t('finder.total'), (u) => escapeHtml(fmtArea(u.area)))}
          ${row(t('finder.living'), (u) => (u.living ? escapeHtml(fmtArea(u.living)) : '—'))}
          ${row(t('finder.rooms'), (u) => (u.kind === 'apartment' ? escapeHtml(t(`finder.roomsShort.${u.rooms}`)) : '—'))}
          ${row(t('finder.bathrooms'), (u) => (u.baths ? String(u.baths) : '—'))}
          ${row(t('finder.floor'), (u) => String(u.floor))}
          ${row(t('finder.orientation'), (u) => escapeHtml(t(`finder.dirs.${u.faces}`)))}
          ${row(t('finder.priceTotal'), (u) => escapeHtml(money(valueOf(u))))}
          ${row(t('finder.perM2'), (u) => escapeHtml(money(u.perM2)))}
          ${row(t('finder.status'), (u) => `<span class="tag tag--${u.status}">${escapeHtml(t(`finder.statusLabel.${u.status}`))}</span>`)}
        </tbody>
      </table>
    </div>`;
}

// ------------------------------------------------------------------ palette search
// "12A", "floor 25", "2 bedrooms", "studio", "penthouse", "office" (also in Georgian / Russian)
export function registerUnitSearch() {
  registerProvider((query) => {
    const q = query.toLowerCase();
    const idMatch = q.match(/\b(o-)?(\d{1,2}[a-ep]\d?)\b/i);
    const floorMatch = q.match(/(?:floor|fl|სართ\S*|этаж\S*)\s*(\d{1,2})|(\d{1,2})\s*(?:floor|fl|სართ|этаж)/);
    const roomsMatch = q.match(/(\d)\s*(?:bed|br|სა?ძ|спал|комн)/);
    let list = UNITS.filter(isOpen);
    if (idMatch) list = UNITS.filter((u) => u.id.toLowerCase() === idMatch[0].toLowerCase());
    else {
      let narrowed = false;
      if (floorMatch) {
        const f = Number(floorMatch[1] || floorMatch[2]);
        list = list.filter((u) => u.floor === f);
        narrowed = true;
      }
      if (roomsMatch) {
        list = list.filter((u) => u.kind === 'apartment' && u.rooms === Number(roomsMatch[1]));
        narrowed = true;
      }
      if (/studio|სტუდ|студ/.test(q)) {
        list = list.filter((u) => u.rooms === 0);
        narrowed = true;
      }
      if (/penthouse|პენტ|пентх/.test(q)) {
        list = list.filter((u) => u.rooms === 4);
        narrowed = true;
      }
      if (/office|ოფის|офис/.test(q)) {
        list = list.filter((u) => u.kind === 'office');
        narrowed = true;
      }
      if (!narrowed) return [];
    }
    return list.slice(0, 6).map((u) => ({
      group: 'palette.groups.units',
      label: () => unitTitle(u),
      hint: () => t('palette.unitHint', { floor: u.floor, area: fmtArea(u.area) }),
      icon: 'layers',
      run: () => openUnit(u.id),
    }));
  });
}
