// Mortgage calculator: monthly payment (hero figure), principal vs interest (stacked bar),
// balance over time (area chart with crosshair) and a year-by-year table view.
import { t, fmtNumber } from '../core/i18n.js';
import { bus } from '../core/store.js';
import { money, convert, CURRENCIES, currency } from '../core/currency.js';
import { h, $, escapeHtml } from '../core/ui.js';

const DEFAULTS = { price: 650000, down: 30, years: 15, rate: 11 }; // lari; indicative GEL mortgage rate

export function monthlyPayment(principal, annualRate, years) {
  const n = years * 12;
  const r = annualRate / 100 / 12;
  if (principal <= 0) return 0;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function schedule(principal, annualRate, years) {
  const r = annualRate / 100 / 12;
  const pay = monthlyPayment(principal, annualRate, years);
  let balance = principal;
  const rows = [{ year: 0, balance, principal: 0, interest: 0 }];
  for (let y = 1; y <= years; y++) {
    let p = 0;
    let i = 0;
    for (let m = 0; m < 12; m++) {
      const interest = balance * r;
      const princ = Math.min(pay - interest, balance);
      balance -= princ;
      p += princ;
      i += interest;
    }
    rows.push({ year: y, balance: Math.max(balance, 0), principal: p, interest: i });
  }
  return rows;
}

const instances = new Set();

export function initCalculators(root = document) {
  root.querySelectorAll('[data-calculator]').forEach((el) => instances.add(mount(el)));
  bus.on('currency', () => instances.forEach((c) => c.rebuild()));
  bus.on('lang', () => instances.forEach((c) => c.rebuild()));
}

// Lets the unit drawer push a price in ("Calculate payments" for this apartment).
export function setCalculatorPrice(gel) {
  instances.forEach((c) => c.setPrice(gel));
}

function mount(el) {
  const state = { ...DEFAULTS, price: Number(el.dataset.price) || DEFAULTS.price, table: false };

  function rebuild() {
    el.innerHTML = template(state);
    bind();
    render();
  }

  function bind() {
    el.querySelectorAll('[data-k]').forEach((input) => {
      input.addEventListener('input', () => {
        const key = input.dataset.k;
        let value = Number(input.value);
        if (key === 'price') value = value / CURRENCIES[currency()].rate; // typed in display currency
        if (!Number.isFinite(value)) return;
        state[key] = value;
        // keep the twin control (range ↔ number) in sync
        el.querySelectorAll(`[data-k="${key}"]`).forEach((other) => {
          if (other !== input) other.value = input.value;
        });
        render();
      });
    });
    $('[data-view-toggle]', el).addEventListener('click', (e) => {
      state.table = !state.table;
      e.currentTarget.setAttribute('aria-pressed', String(state.table));
      render();
    });
    bindChartHover();
  }

  function render() {
    const priceDisplay = Math.round(convert(state.price));
    el.querySelectorAll('[data-k="price"]').forEach((input) => {
      if (input.type === 'range') {
        input.min = Math.round(convert(100000));
        input.max = Math.round(convert(3000000));
        input.step = Math.round(convert(10000));
      }
      if (document.activeElement !== input) input.value = priceDisplay;
    });
    el.querySelectorAll('input[type="range"]').forEach((r) => {
      r.style.setProperty('--fill', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
    });

    const principal = state.price * (1 - state.down / 100);
    const pay = monthlyPayment(principal, state.rate, state.years);
    const rows = schedule(principal, state.rate, state.years);
    const totalInterest = rows.reduce((s, r) => s + r.interest, 0);

    $('[data-out="pay"]', el).textContent = money(pay);
    $('[data-out="down"]', el).textContent = `${fmtNumber(state.down)}% · ${money(state.price * (state.down / 100))}`;
    $('[data-out="years"]', el).textContent = t('calc.yearsValue', { n: state.years });
    $('[data-out="rate"]', el).textContent = `${fmtNumber(state.rate, { maximumFractionDigits: 2 })}%`;
    $('[data-out="loan"]', el).textContent = money(principal);
    $('[data-out="interest"]', el).textContent = money(totalInterest);
    $('[data-out="total"]', el).textContent = money(principal + totalInterest + state.price * (state.down / 100));

    renderSplit(principal, totalInterest);
    renderBalance(rows);
    renderTable(rows);
    $('[data-chart]', el).hidden = state.table;
    $('[data-table]', el).hidden = !state.table;
    el._rows = rows;
  }

  function renderSplit(principal, interest) {
    const total = principal + interest || 1;
    const pShare = principal / total;
    const bar = $('[data-split]', el);
    const gap = 2;
    const width = bar.clientWidth || 600;
    const pw = Math.max(0, pShare * width - gap / 2);
    const iw = Math.max(0, width - pw - gap);
    const label = (w, text) => (w > text.length * 7.5 + 24 ? text : '');
    const pText = `${fmtNumber(pShare * 100, { maximumFractionDigits: 0 })}%`;
    const iText = `${fmtNumber((1 - pShare) * 100, { maximumFractionDigits: 0 })}%`;
    bar.innerHTML = `
      <svg width="100%" height="24" viewBox="0 0 ${width} 24" preserveAspectRatio="none" role="img"
        aria-label="${escapeHtml(t('calc.splitAria', { p: pText, i: iText }))}">
        <rect x="0" y="0" width="${pw}" height="24" rx="4" fill="var(--viz-1)"></rect>
        <rect x="${pw + gap}" y="0" width="${iw}" height="24" rx="4" fill="var(--viz-2)"></rect>
      </svg>
      <div class="calc-split__labels">
        <span style="width:${pw}px">${label(pw, pText)}</span>
        <span style="width:${iw}px;margin-left:${gap}px">${label(iw, iText)}</span>
      </div>`;
  }

  function renderBalance(rows) {
    const svg = $('[data-balance]', el);
    const W = Math.max(svg.clientWidth || 640, 280);
    const H = 220;
    const pad = { l: 56, r: 12, t: 12, b: 28 };
    const max = rows[0].balance || 1;
    const x = (year) => pad.l + (year / (rows.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
    const line = rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.year).toFixed(1)},${y(r.balance).toFixed(1)}`).join('');
    const area = `${line}L${x(rows.at(-1).year)},${y(0)}L${x(0)},${y(0)}Z`;
    const ticks = niceTicks(convert(max));
    const yTicks = ticks
      .map((v) => {
        const base = v / CURRENCIES[currency()].rate; // tick value back in lari
        const yy = y(base);
        return `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" class="viz-grid"></line>
          <text x="${pad.l - 10}" y="${yy + 4}" text-anchor="end" class="viz-tick">${escapeHtml(compactMoney(v))}</text>`;
      })
      .join('');
    const step = rows.length > 21 ? 5 : rows.length > 11 ? 2 : 1;
    const xTicks = rows
      .filter((r) => r.year % step === 0)
      .map((r) => `<text x="${x(r.year)}" y="${H - 8}" text-anchor="middle" class="viz-tick">${r.year}</text>`)
      .join('');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = `
      ${yTicks}
      <path d="${area}" fill="var(--viz-1)" fill-opacity="0.1"></path>
      <path d="${line}" fill="none" stroke="var(--viz-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
      ${xTicks}
      <line class="viz-crosshair" y1="${pad.t}" y2="${H - pad.b}" x1="0" x2="0" visibility="hidden"></line>
      <circle class="viz-dot" r="4" visibility="hidden"></circle>
      <rect class="viz-hit" x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="transparent" tabindex="0"
        aria-label="${escapeHtml(t('calc.balanceAria'))}"></rect>`;
    svg._geom = { W, pad, x, y, rows };
  }

  function bindChartHover() {
    const svg = $('[data-balance]', el);
    const tip = $('[data-tip]', el);
    const show = (index) => {
      const g = svg._geom;
      if (!g) return;
      const r = g.rows[Math.max(0, Math.min(g.rows.length - 1, index))];
      const cx = g.x(r.year);
      const cy = g.y(r.balance);
      const cross = $('.viz-crosshair', svg);
      const dot = $('.viz-dot', svg);
      cross.setAttribute('x1', cx);
      cross.setAttribute('x2', cx);
      cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', cx);
      dot.setAttribute('cy', cy);
      dot.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.querySelector('[data-tip-value]').textContent = money(r.balance);
      tip.querySelector('[data-tip-label]').textContent = t('calc.afterYear', { n: r.year });
      const box = svg.getBoundingClientRect();
      const px = (cx / g.W) * box.width;
      tip.style.left = `${Math.min(Math.max(px, 70), box.width - 70)}px`;
      svg._active = r.year;
    };
    const hide = () => {
      tip.hidden = true;
      svg.querySelectorAll('.viz-crosshair, .viz-dot').forEach((n) => n.setAttribute('visibility', 'hidden'));
    };
    svg.addEventListener('pointermove', (e) => {
      const g = svg._geom;
      if (!g) return;
      const box = svg.getBoundingClientRect();
      const vx = ((e.clientX - box.left) / box.width) * g.W;
      const span = g.x(g.rows.length - 1) - g.x(0);
      show(Math.round(((vx - g.x(0)) / span) * (g.rows.length - 1)));
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focusin', () => show(svg._active ?? 0));
    svg.addEventListener('focusout', hide);
    svg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      show((svg._active ?? 0) + (e.key === 'ArrowRight' ? 1 : -1));
    });
  }

  function renderTable(rows) {
    $('[data-table] tbody', el).innerHTML = rows
      .slice(1)
      .map(
        (r) =>
          `<tr><td>${r.year}</td><td>${escapeHtml(money(r.principal))}</td><td>${escapeHtml(money(r.interest))}</td><td>${escapeHtml(money(r.balance))}</td></tr>`,
      )
      .join('');
  }

  rebuild();
  window.addEventListener('resize', () => render());
  return {
    render,
    rebuild,
    setPrice(gel) {
      state.price = gel;
      render();
    },
  };
}

function niceTicks(max) {
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = 0; v <= max + 1e-6; v += step) ticks.push(v);
  return ticks;
}

function compactMoney(v) {
  const sym = CURRENCIES[currency()].symbol;
  return sym + new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

function template(state) {
  const uid = Math.random().toString(36).slice(2, 7);
  const range = (key, min, max, step, value) =>
    `<input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${escapeHtml(t(`calc.${key}`))}">`;
  return `
  <div class="calc">
    <div class="calc__inputs">
      <div class="range">
        <div class="range__head"><label class="label" for="calc-price-${uid}" >${t('calc.price')} (${currency()})</label>
          <input class="calc__number num" id="calc-price-${uid}" type="number" inputmode="numeric" data-k="price" min="0" step="1000"></div>
        ${range('price', 100000, 3000000, 10000, state.price)}
      </div>
      <div class="range">
        <div class="range__head"><span class="label">${t('calc.down')}</span><span class="range__value" data-out="down"></span></div>
        ${range('down', 10, 80, 5, state.down)}
      </div>
      <div class="range">
        <div class="range__head"><span class="label">${t('calc.years')}</span><span class="range__value" data-out="years"></span></div>
        ${range('years', 5, 30, 1, state.years)}
      </div>
      <div class="range">
        <div class="range__head"><span class="label">${t('calc.rate')}</span><span class="range__value" data-out="rate"></span></div>
        ${range('rate', 1, 18, 0.1, state.rate)}
      </div>
      <p class="small faint">${t('calc.note')}</p>
    </div>
    <div class="calc__results">
      <p class="label">${t('calc.monthly')}</p>
      <p class="calc__hero" data-out="pay" aria-live="polite"></p>
      <dl class="calc__figures">
        <div><dt>${t('calc.loan')}</dt><dd data-out="loan"></dd></div>
        <div><dt>${t('calc.interest')}</dt><dd data-out="interest"></dd></div>
        <div><dt>${t('calc.total')}</dt><dd data-out="total"></dd></div>
      </dl>
      <div class="calc-split">
        <div class="calc-legend">
          <span><i style="background:var(--viz-1)"></i>${t('calc.principalLegend')}</span>
          <span><i style="background:var(--viz-2)"></i>${t('calc.interestLegend')}</span>
        </div>
        <div class="calc-split__bar" data-split></div>
      </div>
      <div class="calc-chart">
        <div class="calc-chart__head">
          <p class="label">${t('calc.balanceTitle')}</p>
          <button type="button" class="chip" data-view-toggle aria-pressed="${state.table}">${t('calc.tableView')}</button>
        </div>
        <div class="calc-chart__plot" data-chart>
          <svg class="viz" data-balance role="img" aria-label="${escapeHtml(t('calc.balanceTitle'))}"></svg>
          <div class="viz-tip" data-tip hidden><b data-tip-value></b><span data-tip-label></span></div>
        </div>
        <div class="calc-table" data-table hidden data-lenis-prevent>
          <table>
            <thead><tr><th>${t('calc.year')}</th><th>${t('calc.principalLegend')}</th><th>${t('calc.interestLegend')}</th><th>${t('calc.balance')}</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`;
}

