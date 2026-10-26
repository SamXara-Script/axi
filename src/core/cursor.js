// Custom cursor for fine pointers: a dot, a lagging ring and contextual labels
// (data-cursor="View"), plus magnetic pull on [data-magnetic] elements.
import { gsap } from './scroll.js';
import { t } from './i18n.js';

export function initCursor() {
  if (!matchMedia('(pointer: fine)').matches) return;

  const el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div>';
  document.body.append(el);
  document.documentElement.classList.add('has-cursor');

  const ring = el.querySelector('.cursor__ring');
  const dot = el.querySelector('.cursor__dot');
  const label = el.querySelector('.cursor__label');
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });

  window.addEventListener(
    'pointermove',
    (e) => {
      ringX(e.clientX);
      ringY(e.clientY);
      dotX(e.clientX);
      dotY(e.clientY);
      el.classList.add('is-visible');
    },
    { passive: true },
  );
  document.addEventListener('pointerleave', () => el.classList.remove('is-visible'));
  window.addEventListener('pointerdown', () => el.classList.add('is-down'));
  window.addEventListener('pointerup', () => el.classList.remove('is-down'));

  // Hover state is resolved by delegation so injected content works too.
  let active = null;
  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest('[data-cursor], a, button, [role="button"], input, select, textarea, label');
    if (target === active) return;
    active = target;
    el.classList.remove('is-hover', 'is-label', 'is-text');
    if (!target) return;
    if (target.matches('input[type="text"], input[type="email"], input[type="tel"], textarea')) {
      el.classList.add('is-text');
    } else if (target.dataset.cursor) {
      label.textContent = target.dataset.cursorI18n ? t(target.dataset.cursorI18n) : target.dataset.cursor;
      el.classList.add('is-label');
    } else {
      el.classList.add('is-hover');
    }
  });

  initMagnetic();
}

function initMagnetic() {
  document.addEventListener('pointermove', (e) => {
    const target = e.target.closest('[data-magnetic]');
    document.querySelectorAll('[data-magnetic].is-magnet').forEach((m) => {
      if (m !== target) {
        m.classList.remove('is-magnet');
        gsap.to(m, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      }
    });
    if (!target) return;
    const r = target.getBoundingClientRect();
    const strength = Number(target.dataset.magnetic) || 0.3;
    target.classList.add('is-magnet');
    gsap.to(target, {
      x: (e.clientX - (r.left + r.width / 2)) * strength,
      y: (e.clientY - (r.top + r.height / 2)) * strength,
      duration: 0.5,
      ease: 'power3.out',
    });
  });
}
