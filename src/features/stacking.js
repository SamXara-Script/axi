// Stacking plan: both towers floor by floor, coloured by use, with direct labels on each
// band, a zone filter, hover/focus details and a floor card. Renders at real pixel size.
import { t, fmtNumber } from '../core/i18n.js';
import { bus } from '../core/store.js';
import { $, $$, escapeHtml } from '../core/ui.js';
import { PROJECT, TOWER_STACK, ZONES, zoneAt } from '../data/project.js';

const BELOW = PROJECT.floorsBelow;
const ABOVE = PROJECT.massing.floors;

export function initStacking() {
  const root = $('[data-stacking]');
  if (!root) return;
  const svgWrap = $('.stacking__plot', root);
  const info = $('.stacking__info', root);
  const filters = $('.stacking__filters', root);
  let active = 'all';
  let selected = null;

  const zonesInUse = [...new Set(Object.values(TOWER_STACK).flatMap((rows) => rows.map((r) => r.zone))), 'parking'];

  function renderFilters() {
    filters.innerHTML = ['all', ...zonesInUse]
      .map(
        (z) =>
          `<button type="button" class="chip" data-zone="${z}" aria-pressed="${active === z}" ${z !== 'all' ? `style="--dot:var(--z-${z})"` : ''}>${
            z !== 'all' ? '<i></i>' : ''
          }${escapeHtml(t(z === 'all' ? 'stacking.all' : `zones.${z}`))}</button>`,
      )
      .join('');
  }

  function render() {
    const W = Math.max(svgWrap.clientWidth, 300);
    const rowH = Math.max(11, Math.min(17, (window.innerHeight * 0.78) / (ABOVE + BELOW + 3)));
    const gap = 2;
    const top = 26;
    const groundY = top + ABOVE * rowH;
    const H = groundY + BELOW * rowH + 34;
    const scaleW = 54;
    const towerW = Math.min(220, (W - scaleW - 40) / 2.25);
    const xStone = scaleW + 10;
    const xGlass = xStone + towerW + towerW * 0.25;
    const towers = { stone: xStone, glass: xGlass };
    const y = (floor) => (floor > 0 ? groundY - floor * rowH : groundY + (-floor - 1) * rowH + gap);

    let rects = '';
    let labels = '';
    for (const [tower, x] of Object.entries(towers)) {
      for (let f = ABOVE; f >= -BELOW; f--) {
        if (f === 0) continue;
        const zone = zoneAt(tower, f);
        const dim = active !== 'all' && active !== zone;
        const isSel = selected && selected.tower === tower && selected.floor === f;
        rects += `<rect class="stk-floor${isSel ? ' is-selected' : ''}" data-tower="${tower}" data-floor="${f}" data-zone="${zone}"
          x="${x}" y="${y(f) + gap / 2}" width="${towerW}" height="${rowH - gap}" rx="2"
          fill="var(--z-${zone})" fill-opacity="${dim ? 0.12 : 0.9}"></rect>`;
      }
      // direct labels per zone band (only where the band is tall enough)
      for (const band of TOWER_STACK[tower]) {
        const span = band.to - band.from + 1;
        if (span * rowH < 20) continue;
        const cy = (y(band.to) + y(band.from) + rowH) / 2;
        const range = band.from === band.to ? pad(band.from) : `${pad(band.from)}–${pad(band.to)}`;
        // full label when it fits the band, otherwise just the floor range (≈6.4px per glyph at 11px)
        const full = `${t(`zones.${band.zone}`)} · ${range}`;
        const text = full.length * 6.4 < towerW - 20 ? full : range;
        labels += `<text class="stk-label" x="${x + 12}" y="${cy + 4}" fill="${labelInk(zoneColor(band.zone))}" opacity="${active !== 'all' && active !== band.zone ? 0.25 : 1}">${escapeHtml(text)}</text>`;
      }
      labels += `<text class="stk-tower" x="${x}" y="${top - 10}">${escapeHtml(t(`towers.${tower}.name`))}</text>`;
    }
    // podium bridge between the towers (floors 1–3)
    const bridge = `<rect x="${xStone + towerW}" y="${y(PROJECT.massing.podiumFloors) + 1}" width="${xGlass - xStone - towerW}" height="${PROJECT.massing.podiumFloors * rowH - 2}" fill="var(--z-retail)" fill-opacity="${active === 'all' || active === 'retail' ? 0.45 : 0.08}" rx="2"></rect>`;

    // height scale: every 50 m + the top
    let scale = '';
    const mPerFloor = PROJECT.massing.floorHeight;
    for (const m of [0, 50, 100, PROJECT.heightM]) {
      const yy = groundY - (m / mPerFloor) * rowH;
      scale += `<line class="stk-grid" x1="${scaleW - 6}" x2="${W}" y1="${yy}" y2="${yy}"></line>
        <text class="stk-tick" x="${scaleW - 12}" y="${yy + 4}" text-anchor="end">${fmtNumber(m)} ${t('units.m')}</text>`;
    }
    const ground = `<line class="stk-ground" x1="0" x2="${W}" y1="${groundY + gap / 2}" y2="${groundY + gap / 2}"></line>
      <text class="stk-tick" x="${scaleW - 12}" y="${groundY + BELOW * rowH * 0.6}" text-anchor="end"><title>${escapeHtml(t('stacking.underground'))}</title>B1–B${BELOW}</text>`;

    svgWrap.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(t('stacking.aria'))}">
      ${scale}${ground}${bridge}${rects}${labels}</svg>`;
  }

  function describe(tower, floor) {
    const zone = zoneAt(tower, floor);
    const height = floor > 0 ? fmtNumber(floor * PROJECT.massing.floorHeight, { maximumFractionDigits: 0 }) : null;
    info.innerHTML = `
      <p class="label">${escapeHtml(t(`towers.${tower}.name`))}</p>
      <p class="stacking__num">${floor > 0 ? pad(floor) : `B${-floor}`}</p>
      <p class="stacking__zone" style="--dot:var(--z-${zone})"><i></i>${escapeHtml(t(`zones.${zone}`))}</p>
      <p class="muted">${t(`zoneInfo.${zone}`)}</p>
      ${height ? `<p class="small faint">${t('explorer.height', { m: height })}</p>` : ''}
      ${zone === 'residential' ? `<a class="link" href="residences.html?floor=${floor}">${t('explorer.ctaResidential')}</a>` : ''}
      ${zone === 'office' ? `<a class="link" href="offices.html?floor=${floor}">${t('explorer.ctaOffice')}</a>` : ''}`;
  }

  function idle() {
    info.innerHTML = `<p class="label">${t('stacking.hintLabel')}</p><p class="muted">${t('stacking.hint')}</p>`;
  }

  svgWrap.addEventListener('pointermove', (e) => {
    const r = e.target.closest('.stk-floor');
    if (r) describe(r.dataset.tower, Number(r.dataset.floor));
  });
  svgWrap.addEventListener('pointerleave', () => (selected ? describe(selected.tower, selected.floor) : idle()));
  svgWrap.addEventListener('click', (e) => {
    const r = e.target.closest('.stk-floor');
    if (!r) return;
    selected = { tower: r.dataset.tower, floor: Number(r.dataset.floor) };
    render();
    describe(selected.tower, selected.floor);
  });
  // keyboard: the plot is one focus stop, arrows walk floors, ←/→ switch tower
  svgWrap.tabIndex = 0;
  svgWrap.addEventListener('keydown', (e) => {
    const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const cur = selected || { tower: 'stone', floor: 1 };
    let { tower, floor } = cur;
    if (e.key === 'ArrowUp') floor = floor === -1 ? 1 : Math.min(ABOVE, floor + 1);
    if (e.key === 'ArrowDown') floor = floor === 1 ? -1 : Math.max(-BELOW, floor - 1);
    if (e.key === 'ArrowLeft') tower = 'stone';
    if (e.key === 'ArrowRight') tower = 'glass';
    selected = { tower, floor };
    render();
    describe(tower, floor);
  });
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-zone]');
    if (!b) return;
    active = b.dataset.zone;
    renderFilters();
    render();
  });

  renderFilters();
  render();
  idle();
  let w = svgWrap.clientWidth;
  window.addEventListener('resize', () => {
    if (svgWrap.clientWidth !== w) {
      w = svgWrap.clientWidth;
      render();
    }
  });
  bus.on('lang', () => {
    renderFilters();
    render();
    selected ? describe(selected.tower, selected.floor) : idle();
  });
  bus.on('theme', render);
}

const pad = (n) => String(n).padStart(2, '0');

// Resolved zone colour for the active theme (labels pick black or white ink against it).
function zoneColor(zone) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--z-${zone}`).trim() || ZONES[zone].color;
}

// Labels inside a coloured band: near-black or white, whichever reads on the fill.
function labelInk(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.22 ? '#121316' : '#ffffff';
}
