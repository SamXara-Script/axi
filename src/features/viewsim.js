// "View from your floor": an illustrative layered panorama of Tbilisi. Raising the floor
// lowers the near rooftops faster than the distant ridges (parallax by depth), so the
// city opens up the way it does in the lift. Time of day recolours the whole scene.
import { t, fmtNumber } from '../core/i18n.js';
import { bus } from '../core/store.js';
import { $, $$ } from '../core/ui.js';
import { PROJECT } from '../data/project.js';

const W = 1600;
const H = 700;

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function ridge(seed, base, amp, step, roughness = 0.5) {
  const rand = rng(seed);
  let d = `M0 ${H}`;
  let y = base;
  for (let x = 0; x <= W + step; x += step) {
    y += (rand() - 0.5) * amp * roughness;
    y = Math.max(base - amp, Math.min(base + amp * 0.3, y * 0.85 + base * 0.15));
    d += ` L${x} ${y.toFixed(1)}`;
  }
  return `${d} L${W} ${H} Z`;
}

function skyline(seed, base, minH, maxH, minW, maxW, windowsClass) {
  const rand = rng(seed);
  let shapes = '';
  let lights = '';
  for (let x = -20; x < W; ) {
    const w = minW + rand() * (maxW - minW);
    const h = minH + Math.pow(rand(), 1.8) * (maxH - minH);
    const top = base - h;
    shapes += `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${w.toFixed(1)}" height="${(H - top).toFixed(1)}"/>`;
    if (windowsClass) {
      for (let wy = top + 6; wy < base - 4; wy += 9) {
        for (let wx = x + 4; wx < x + w - 4; wx += 7) {
          if (rand() > 0.82) lights += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="2.6" height="3.4"/>`;
        }
      }
    }
    x += w + rand() * 4;
  }
  return { shapes, lights };
}

function scene() {
  const caucasus = ridge(11, 300, 46, 18, 0.9);
  const hills = ridge(5, 392, 70, 26, 0.7);
  const far = skyline(21, 470, 12, 46, 8, 22, true);
  const mid = skyline(33, 540, 18, 80, 14, 40, true);
  const near = skyline(47, 650, 40, 170, 40, 110, true);
  // landmarks on the ridge / mid layer
  const tvX = 1080;
  const tvBase = 330;
  return `
  <svg class="viewsim__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs>
      <linearGradient id="vs-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--vs-sky-top)"/><stop offset="1" stop-color="var(--vs-sky-bottom)"/>
      </linearGradient>
      <radialGradient id="vs-sun" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="var(--vs-sun)" stop-opacity="0.95"/><stop offset="1" stop-color="var(--vs-sun)" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#vs-sky)"/>
    <circle class="viewsim__sun" cx="380" cy="230" r="160" fill="url(#vs-sun)"/>
    <g class="viewsim__layer" data-depth="40"><path d="${caucasus}" fill="var(--vs-l0)"/>
      <path d="${caucasus}" fill="none" stroke="var(--vs-snow)" stroke-width="2" opacity="0.5" transform="translate(0,-2)"/></g>
    <g class="viewsim__layer" data-depth="14"><path d="${hills}" fill="var(--vs-l1)"/>
      <g fill="var(--vs-l1)" stroke="var(--vs-l1)">
        <path d="M${tvX - 10} ${tvBase + 40} L${tvX - 2} ${tvBase - 90} L${tvX + 2} ${tvBase - 90} L${tvX + 10} ${tvBase + 40} Z"/>
        <rect x="${tvX - 1}" y="${tvBase - 128}" width="2" height="40"/>
      </g>
      <circle class="viewsim__beacon" cx="${tvX}" cy="${tvBase - 128}" r="3"/></g>
    <g class="viewsim__layer" data-depth="7"><g fill="var(--vs-l2)">${far.shapes}</g><g class="viewsim__lights">${far.lights}</g>
      <path fill="var(--vs-l2)" d="M1240 470 v-36 h18 v-14 a22 22 0 0 1 44 0 v14 h18 v36 z M1278 392 h4 v-28 h-4 z"/></g>
    <g class="viewsim__layer" data-depth="3.2"><g fill="var(--vs-l3)">${mid.shapes}</g><g class="viewsim__lights">${mid.lights}</g></g>
    <g class="viewsim__layer" data-depth="1.2"><g fill="var(--vs-l4)">${near.shapes}</g><g class="viewsim__lights">${near.lights}</g></g>
  </svg>`;
}

export function initViewSim() {
  const root = $('[data-viewsim]');
  if (!root) return;
  const stage = $('.viewsim__stage', root);
  stage.insertAdjacentHTML('afterbegin', scene());
  const layers = $$('.viewsim__layer', stage);
  const input = $('input[type="range"]', root);
  const out = {
    floor: $('[data-out="floor"]', root),
    height: $('[data-out="height"]', root),
    horizon: $('[data-out="horizon"]', root),
  };
  const marks = $$('[data-min-floor]', root);

  function update() {
    const floor = Number(input.value);
    // eye height: podium + floors, roughly mid-window
    const h = floor * PROJECT.massing.floorHeight + 1.6;
    const lift = (floor - 1) / (PROJECT.massing.floors - 1); // 0..1
    layers.forEach((g) => {
      const depth = Number(g.dataset.depth);
      g.style.transform = `translateY(${(lift * 420) / depth}px)`;
    });
    stage.style.setProperty('--haze', (0.35 - lift * 0.25).toFixed(3));
    out.floor.textContent = String(floor).padStart(2, '0');
    out.height.textContent = `${fmtNumber(Math.round(h))} ${t('units.m')}`;
    // geometric horizon, d ≈ 3.57·√h km (ignores terrain and haze)
    out.horizon.textContent = `${fmtNumber(3.57 * Math.sqrt(h), { maximumFractionDigits: 0 })} ${t('units.km')}`;
    marks.forEach((m) => m.classList.toggle('is-visible', floor >= Number(m.dataset.minFloor)));
    input.style.setProperty('--fill', `${((floor - input.min) / (input.max - input.min)) * 100}%`);
  }

  $$('[data-viewsim-time]', root).forEach((b) =>
    b.addEventListener('click', () => {
      root.dataset.time = b.dataset.viewsimTime;
      $$('[data-viewsim-time]', root).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }),
  );
  input.addEventListener('input', update);
  bus.on('lang', update);
  update();
}
