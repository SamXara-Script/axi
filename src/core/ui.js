// Shared UI primitives: modals/drawers with focus handling, toasts, icons.
import { lockScroll, unlockScroll } from './scroll.js';

export const icons = {
  arrow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 8h12M9 3l5 5-5 5"/></svg>',
  arrowUp: '<svg viewBox="0 0 10 10" fill="currentColor"><path d="M5 1l4 6H1z"/></svg>',
  arrowDown: '<svg viewBox="0 0 10 10" fill="currentColor"><path d="M5 9L1 3h8z"/></svg>',
  close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 3l10 10M13 3L3 13"/></svg>',
  search: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="5"/><path d="M11 11l3.5 3.5"/></svg>',
  heart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 13.5S2 10 2 5.8A3.1 3.1 0 0 1 8 4.4a3.1 3.1 0 0 1 6 1.4C14 10 8 13.5 8 13.5z"/></svg>',
  heartFull: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1.4"><path d="M8 13.5S2 10 2 5.8A3.1 3.1 0 0 1 8 4.4a3.1 3.1 0 0 1 6 1.4C14 10 8 13.5 8 13.5z"/></svg>',
  compare: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 2v12M11 2v12M2 5h6M8 11h6"/></svg>',
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8.5l3.2 3L13 4.5"/></svg>',
  phone: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3.5 2h2.6l1.2 3-1.6 1.1a8 8 0 0 0 4.2 4.2L11 8.7l3 1.2v2.6c0 .8-.7 1.5-1.5 1.5A11.5 11.5 0 0 1 2 3.5C2 2.7 2.7 2 3.5 2z"/></svg>',
  mail: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3.5" width="12" height="9" rx="1"/><path d="M2.5 4l5.5 4.5L13.5 4"/></svg>',
  whatsapp: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 13.5l.8-2.8A5.8 5.8 0 1 1 5.5 13z"/><path d="M6 5.5c0 2.5 2 4.5 4.5 4.5l.8-1-1.4-.8-.6.6c-.8-.3-1.5-1-1.8-1.8l.6-.6-.8-1.4z" fill="currentColor" stroke="none"/></svg>',
  share: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="3.5" r="1.8"/><circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="12.5" r="1.8"/><path d="M5.6 7.1l4.8-2.7M5.6 8.9l4.8 2.7"/></svg>',
  sun: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"/></svg>',
  moon: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M13.5 9.5A5.5 5.5 0 1 1 6.5 2.5a4.5 4.5 0 0 0 7 7z"/></svg>',
  cube: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7z"/><path d="M2.5 4.5L8 7.5l5.5-3M8 7.5v7"/></svg>',
  calendar: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3"/></svg>',
  pin: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 14.5s4.5-4.2 4.5-8a4.5 4.5 0 0 0-9 0c0 3.8 4.5 8 4.5 8z"/><circle cx="8" cy="6.5" r="1.6"/></svg>',
  globe: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M1.5 8h13M8 1.5c2 2 2 11 0 13M8 1.5c-2 2-2 11 0 13"/></svg>',
  grid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/></svg>',
  list: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 4h12M2 8h12M2 12h12"/></svg>',
  layers: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2l6 3-6 3-6-3z"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3"/></svg>',
  calc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="1.5" width="10" height="13" rx="1"/><path d="M5.5 4.5h5M5.5 8h1M9.5 8h1M5.5 11h1M9.5 11h1"/></svg>',
  play: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8v10.4L13 8z"/></svg>',
  pause: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>',
  chat: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 3.5h11v7.5h-6l-3.5 2.5V11h-1.5z"/></svg>',
  motion: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8c2-4 4-4 6.5 0s4.5 4 6.5 0"/></svg>',
  currency: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M10 5.5c-.4-.6-1.1-1-2-1-1.2 0-2 .7-2 1.6 0 2.2 4.2 1.2 4.2 3.6 0 .9-.9 1.8-2.2 1.8-1 0-1.8-.4-2.2-1.1M8 3v1.5M8 11.5V13"/></svg>',
  download: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M8 2v8.5M4.5 7L8 10.5 11.5 7M2.5 13.5h11"/></svg>',
  expand: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"/></svg>',
};

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ------------------------------------------------------------------ layers (modal / drawer)
let overlay;
const stack = [];

function getOverlay() {
  if (!overlay) {
    overlay = h('<div class="overlay" aria-hidden="true"></div>');
    overlay.addEventListener('click', () => stack.at(-1)?.close());
    document.body.append(overlay);
  }
  return overlay;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

// Wraps a .modal or .drawer element with open/close, Esc, focus trap and scroll lock.
export function layer(el, { onOpen, onClose, overlay: useOverlay = true } = {}) {
  let returnFocus = null;
  const api = {
    el,
    get isOpen() {
      return el.classList.contains('is-open');
    },
    open() {
      if (api.isOpen) return;
      returnFocus = document.activeElement;
      stack.push(api);
      el.classList.add('is-open');
      el.removeAttribute('aria-hidden');
      el.removeAttribute('inert');
      if (useOverlay) getOverlay().classList.add('is-open');
      lockScroll(el);
      onOpen?.();
      requestAnimationFrame(() => {
        const target = el.querySelector('[autofocus]') || el.querySelector(FOCUSABLE);
        target?.focus({ preventScroll: true });
      });
    },
    close() {
      if (!api.isOpen) return;
      stack.splice(stack.indexOf(api), 1);
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
      if (!stack.length) getOverlay().classList.remove('is-open');
      unlockScroll(el);
      onClose?.();
      returnFocus?.focus?.({ preventScroll: true });
    },
    toggle() {
      api.isOpen ? api.close() : api.open();
    },
  };
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('inert', '');
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) api.close();
    // clicks on the empty area around a modal panel close it
    if (e.target === el && el.classList.contains('modal')) api.close();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  return api;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    e.preventDefault();
    stack.at(-1).close();
  }
});

export function closeAllLayers() {
  [...stack].reverse().forEach((l) => l.close());
}

// ------------------------------------------------------------------ toasts
let toastRoot;
export function toast(message, { icon = 'check', timeout = 3200 } = {}) {
  if (!toastRoot) {
    toastRoot = h('<div class="toasts" role="status" aria-live="polite"></div>');
    document.body.append(toastRoot);
  }
  const el = h(`<div class="toast">${icons[icon] || ''}<span></span></div>`);
  el.querySelector('span').textContent = message;
  toastRoot.append(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, timeout);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = h('<textarea style="position:fixed;opacity:0"></textarea>');
    area.value = text;
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

// Classic <script> loader (works from file:// too, unlike module imports). Cached per URL.
const scripts = new Map();
export function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.onload = resolve;
        el.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.append(el);
      }),
    );
  }
  return scripts.get(src);
}

// history.replaceState throws in sandboxed / opaque-origin documents; URL sync is a nicety.
export function replaceUrl(url) {
  try {
    history.replaceState(null, '', url);
  } catch {
    /* ignore */
  }
}
