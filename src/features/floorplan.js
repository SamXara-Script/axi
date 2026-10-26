// Indicative floor plans drawn from a few room templates, scaled to each unit's area.
// Room areas are proportional estimates, labelled as indicative in the UI.
import { t } from '../core/i18n.js';
import { area as fmtArea } from '../core/currency.js';
import { escapeHtml } from '../core/ui.js';

// Rooms as fractions of a rectangular footprint; the facade (windows) is the top edge.
const TEMPLATES = {
  studio: [
    ['studio', 0, 0, 0.62, 1],
    ['kitchen', 0.62, 0, 0.38, 0.42],
    ['bath', 0.62, 0.42, 0.38, 0.3],
    ['hall', 0.62, 0.72, 0.38, 0.28],
  ],
  bed1: [
    ['living', 0, 0, 0.56, 0.62],
    ['bed', 0.56, 0, 0.44, 0.62],
    ['kitchen', 0, 0.62, 0.3, 0.38],
    ['hall', 0.3, 0.62, 0.3, 0.38],
    ['bath', 0.6, 0.62, 0.4, 0.38],
  ],
  bed2: [
    ['living', 0, 0, 0.42, 0.62],
    ['bed', 0.42, 0, 0.29, 0.62],
    ['bed', 0.71, 0, 0.29, 0.62],
    ['kitchen', 0, 0.62, 0.28, 0.38],
    ['hall', 0.28, 0.62, 0.32, 0.38],
    ['bath', 0.6, 0.62, 0.4, 0.38],
  ],
  bed3: [
    ['living', 0, 0, 0.36, 0.6],
    ['bed', 0.36, 0, 0.22, 0.6],
    ['bed', 0.58, 0, 0.21, 0.6],
    ['bed', 0.79, 0, 0.21, 0.6],
    ['kitchen', 0, 0.6, 0.24, 0.4],
    ['hall', 0.24, 0.6, 0.28, 0.4],
    ['bath', 0.52, 0.6, 0.24, 0.4],
    ['bath', 0.76, 0.6, 0.24, 0.4],
  ],
  penthouse: [
    ['terrace', 0, 0, 1, 0.14],
    ['living', 0, 0.14, 0.34, 0.5],
    ['bed', 0.34, 0.14, 0.165, 0.5],
    ['bed', 0.505, 0.14, 0.165, 0.5],
    ['bed', 0.67, 0.14, 0.165, 0.5],
    ['bed', 0.835, 0.14, 0.165, 0.5],
    ['kitchen', 0, 0.64, 0.22, 0.36],
    ['hall', 0.22, 0.64, 0.22, 0.36],
    ['bath', 0.44, 0.64, 0.187, 0.36],
    ['bath', 0.627, 0.64, 0.187, 0.36],
    ['bath', 0.814, 0.64, 0.186, 0.36],
  ],
  office: [
    ['open', 0, 0, 0.68, 0.66],
    ['meeting', 0.68, 0, 0.32, 0.4],
    ['bath', 0.68, 0.4, 0.32, 0.26],
    ['reception', 0, 0.66, 0.4, 0.34],
    ['storage', 0.4, 0.66, 0.28, 0.34],
    ['kitchen', 0.68, 0.66, 0.32, 0.34],
  ],
};

const FILL = { living: 0.07, studio: 0.07, open: 0.07, bed: 0.04, terrace: 0.12, kitchen: 0.02, meeting: 0.04 };

// Returns an SVG string. `size` is the drawing width in px; height follows the footprint.
export function planSvg(unit, { size = 520, labels = true } = {}) {
  const rooms = TEMPLATES[unit.plan] || TEMPLATES.bed2;
  const ratio = unit.plan === 'penthouse' || unit.plan === 'office' ? 1.55 : unit.plan === 'studio' ? 1.15 : 1.4;
  const W = size;
  const H = Math.round(size / ratio);
  const pad = labels ? 26 : 6;
  const iw = W - pad * 2;
  const ih = H - pad * 2;
  const wall = labels ? 3 : 2;
  let body = '';
  for (const [kind, x, y, w, h] of rooms) {
    const rx = pad + x * iw;
    const ry = pad + y * ih;
    const rw = w * iw;
    const rh = h * ih;
    const tone = FILL[kind] ?? 0;
    body += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" class="fp-room fp-room--${kind}" style="--tone:${tone}"/>`;
    if (labels && rw > 60 && rh > 34) {
      const m2 = unit.area * w * h;
      body += `<text class="fp-label" x="${(rx + rw / 2).toFixed(1)}" y="${(ry + rh / 2 - 2).toFixed(1)}" text-anchor="middle">${escapeHtml(t(`finder.rooms_.${kind}`))}</text>
        <text class="fp-area" x="${(rx + rw / 2).toFixed(1)}" y="${(ry + rh / 2 + 14).toFixed(1)}" text-anchor="middle">${escapeHtml(fmtArea(m2, 0))}</text>`;
    }
  }
  // outer wall, windows along the facade (top) and the corner side
  const corner = ['bed3', 'penthouse'].includes(unit.plan) || unit.letter === 'E';
  let windows = '';
  const winCount = Math.max(3, Math.round(iw / 70));
  for (let i = 0; i < winCount; i++) {
    const wx = pad + (iw / winCount) * (i + 0.18);
    windows += `<line class="fp-window" x1="${wx.toFixed(1)}" y1="${pad}" x2="${(wx + (iw / winCount) * 0.64).toFixed(1)}" y2="${pad}"/>`;
  }
  if (corner) {
    const n = Math.max(2, Math.round(ih / 70));
    for (let i = 0; i < n; i++) {
      const wy = pad + (ih / n) * (i + 0.2);
      windows += `<line class="fp-window" x1="${pad + iw}" y1="${wy.toFixed(1)}" x2="${pad + iw}" y2="${(wy + (ih / n) * 0.6).toFixed(1)}"/>`;
    }
  }
  const entry = `<path class="fp-entry" d="M${(pad + iw * 0.36).toFixed(1)} ${(pad + ih + 12).toFixed(1)} l6 -9 l6 9"/>`;
  return `<svg class="fp" viewBox="0 0 ${W} ${H + (labels ? 10 : 0)}" role="img" aria-label="${escapeHtml(t('finder.plan'))}">
    ${body}
    <rect class="fp-wall" x="${pad}" y="${pad}" width="${iw}" height="${ih}" stroke-width="${wall}"/>
    ${windows}
    ${labels ? entry : ''}
  </svg>`;
}
