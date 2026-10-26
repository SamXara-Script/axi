// Axonometric line drawings of the towers: every floor plate drawn as an outline, turned 2°
// from the one below (in opposite directions per tower), so the twist reads like a drawing set.
//
//   <svg data-drawing="both|stone|glass" data-highlight="residential" data-zone-colors></svg>
import { PROJECT, zoneAt } from '../data/project.js';
import { gsap, ScrollTrigger } from '../core/scroll.js';

const M = PROJECT.massing;
const VIEW = { yaw: (-18 * Math.PI) / 180, tilt: Math.sin((24 * Math.PI) / 180) };

function plateOutline(w, d, r, steps = 5) {
  const hw = w / 2 - r;
  const hd = d / 2 - r;
  const pts = [];
  const corners = [
    [hw, hd, 0],
    [-hw, hd, Math.PI / 2],
    [-hw, -hd, Math.PI],
    [hw, -hd, Math.PI * 1.5],
  ];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (Math.PI / 2) * (i / steps);
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

// Returns [screenX, screenY, depth]; depth > 0 is the side facing the viewer.
function project(x, y, z) {
  const c = Math.cos(VIEW.yaw);
  const s = Math.sin(VIEW.yaw);
  const xr = x * c - z * s;
  const zr = x * s + z * c;
  return [xr, -y + zr * VIEW.tilt, zr];
}

const fmt = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;

// Split a closed outline into its near and far halves (relative to the tower centre) so the
// far side can be drawn lighter — a cheap depth cue for a wireframe.
function splitOutline(pts, centerDepth) {
  let near = '';
  let far = '';
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const seg = `M${fmt(a)}L${fmt(b)}`;
    if ((a[2] + b[2]) / 2 >= centerDepth) near += seg;
    else far += seg;
  }
  return { near, far };
}

function towerPaths(id, cfg, { every = 1, rotation = PROJECT.rotationPerFloorDeg } = {}) {
  const base = plateOutline(cfg.w, cfg.d, M.cornerRadius);
  const twist = (cfg.twist * rotation * Math.PI) / 180;
  const floors = [];
  const corners = [[], [], [], []];
  const centerDepth = project(cfg.x, 0, cfg.z)[2];
  for (let f = 0; f <= M.floors; f += every) {
    const y = f * M.floorHeight;
    const a = twist * f;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pts = base.map(([x, z]) => project(cfg.x + x * c + z * s, y, cfg.z - x * s + z * c));
    floors.push({ floor: f, pts, ...splitOutline(pts, centerDepth) });
    // the four rounded corners, followed up the tower
    [0, 6, 12, 18].forEach((idx, k) => corners[k].push(pts[idx]));
  }
  // crown line
  const topY = M.floors * M.floorHeight + M.crown;
  const a = twist * (topY / M.floorHeight);
  const top = base.map(([x, z]) => project(cfg.x + x * Math.cos(a) + z * Math.sin(a), topY, cfg.z - x * Math.sin(a) + z * Math.cos(a)));
  const crown = 'M' + top.map(fmt).join('L') + 'Z';
  const edges = corners.map((list) => 'M' + list.map(fmt).join('L'));
  const core = [project(cfg.x, -8, cfg.z), project(cfg.x, topY + 14, cfg.z)];
  return { id, floors, edges, crown, core };
}

export function drawTowers(svg) {
  const which = svg.dataset.drawing || 'both';
  const highlight = (svg.dataset.highlight || '').split(',').filter(Boolean);
  const ids = which === 'both' ? ['stone', 'glass'] : [which];
  const rotation = svg.dataset.rotation != null ? Number(svg.dataset.rotation) : PROJECT.rotationPerFloorDeg;
  const towers = ids.map((id) => towerPaths(id, M.towers[id], { rotation }));

  // podium outline (only with both towers)
  let podium = '';
  const extra = [];
  if (which === 'both') {
    const { x, z, w, d } = M.podium;
    const h = M.podiumFloors * M.podiumFloorHeight;
    const box = [
      [x - w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
    ];
    const lo = box.map(([bx, bz]) => project(bx, 0, bz));
    const hi = box.map(([bx, bz]) => project(bx, h, bz));
    const poly = (pts) => 'M' + pts.map(fmt).join('L') + 'Z';
    podium = `<path class="dw-podium" d="${poly(lo)}"/><path class="dw-podium" d="${poly(hi)}"/>` +
      lo.map((p, i) => `<path class="dw-podium" d="M${fmt(p)}L${fmt(hi[i])}"/>`).join('');
    extra.push(...lo, ...hi);
  }

  // fit the viewBox to the drawing
  const all = [...extra];
  towers.forEach((t) => t.floors.forEach((f) => all.push(...f.pts)));
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const pad = 14;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - 30;
  const maxY = Math.max(...ys) + (which === 'both' ? 14 : 10);
  svg.setAttribute('viewBox', `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`);
  svg.setAttribute('aria-hidden', 'true');

  svg.innerHTML =
    podium +
    towers
      .map((t) => {
        const plates = t.floors
          .map((f) => {
            const zone = f.floor > 0 ? zoneAt(t.id, f.floor) : 'retail';
            const lit = highlight.includes(zone) || highlight.includes(t.id);
            const cls = `dw-plate${lit ? ' is-lit' : ''}`;
            return `<g class="${cls}" data-floor="${f.floor}" data-zone="${zone}" style="--zc:var(--z-${zone})"><path class="dw-far" d="${f.far}"/><path d="${f.near}"/></g>`;
          })
          .join('');
        return `<g class="dw-tower dw-tower--${t.id}">
          <path class="dw-core" d="M${t.core[0][0]},${t.core[0][1]}L${t.core[1][0]},${t.core[1][1]}"/>
          ${t.edges.map((e) => `<path class="dw-edge" d="${e}"/>`).join('')}
          ${plates}
          <path class="dw-crown" d="${t.crown}"/>
        </g>`;
      })
      .join('');
  return svg;
}

// Draw-on animation when the drawing scrolls into view.
export function initDrawings(root = document, { reduced } = {}) {
  root.querySelectorAll('[data-drawing]').forEach((svg) => {
    drawTowers(svg);
    if (reduced || 'static' in svg.dataset) return;
    const plates = svg.querySelectorAll('.dw-plate path, .dw-crown, .dw-edge, .dw-podium');
    plates.forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 400;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });
    ScrollTrigger.create({
      trigger: svg,
      start: 'top 85%',
      once: true,
      onEnter: () =>
        gsap.to(plates, {
          strokeDashoffset: 0,
          duration: 1.6,
          ease: 'power2.inOut',
          stagger: { each: 0.018, from: 'start' },
          onComplete: () => plates.forEach((p) => (p.style.strokeDasharray = 'none')),
        }),
    });
  });
}


// About page: scrub the per-floor rotation from 0° to 4° and redraw live.
export function initTwistDemo() {
  document.querySelectorAll('[data-twist-demo]').forEach((demo) => {
    const svg = demo.querySelector('[data-drawing]');
    const input = demo.querySelector('input[type="range"]');
    const out = demo.querySelector('[data-twist-out]');
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        svg.dataset.rotation = input.value;
        drawTowers(svg);
        out.textContent = `${Number(input.value).toFixed(1)}°`;
        input.style.setProperty('--fill', `${(input.value / input.max) * 100}%`);
      });
    };
    input.addEventListener('input', update);
    update();
  });
}
