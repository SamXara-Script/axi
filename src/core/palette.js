// Command palette (⌘K / Ctrl+K or "/"): jump anywhere, run actions, find units.
// Feature modules add their own entries with registerCommands().
import { t } from './i18n.js';
import { bus } from './store.js';
import { layer, icons, h, escapeHtml, $ } from './ui.js';

const commands = [];
const providers = []; // functions(query) → dynamic results (e.g. unit search)

export function registerCommands(list) {
  commands.push(...list);
}
export function registerProvider(fn) {
  providers.push(fn);
}

const normalize = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

function score(cmd, tokens) {
  const label = typeof cmd.label === 'function' ? cmd.label() : t(cmd.label);
  const hay = normalize(`${label} ${cmd.keywords || ''} ${t(cmd.group)}`);
  let total = 0;
  for (const token of tokens) {
    const at = hay.indexOf(token);
    if (at < 0) return -1;
    total += at === 0 ? 3 : hay[at - 1] === ' ' ? 2 : 1;
  }
  return total;
}

export function initPalette() {
  const el = h(`
    <div class="modal palette" role="dialog" aria-modal="true" aria-labelledby="palette-label">
      <div class="modal__panel">
        <label class="palette__input">
          ${icons.search}
          <span id="palette-label" class="visually-hidden" data-i18n="palette.label">${t('palette.label')}</span>
          <input type="text" autocomplete="off" spellcheck="false" autofocus
            data-i18n-attr="placeholder:palette.placeholder" placeholder="${t('palette.placeholder')}"
            role="combobox" aria-expanded="true" aria-controls="palette-list">
          <kbd>Esc</kbd>
        </label>
        <div class="palette__list" id="palette-list" role="listbox" data-lenis-prevent></div>
        <div class="palette__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd><span data-i18n="palette.navigate">${t('palette.navigate')}</span></span>
          <span><kbd>↵</kbd><span data-i18n="palette.select">${t('palette.select')}</span></span>
        </div>
      </div>
    </div>`);
  document.body.append(el);
  const input = $('input', el);
  const list = $('.palette__list', el);
  let results = [];
  let active = 0;

  const modal = layer(el, {
    onOpen: () => {
      input.value = '';
      render();
    },
  });

  function render() {
    const query = normalize(input.value.trim());
    const tokens = query.split(/\s+/).filter(Boolean);
    const visible = commands.filter((c) => !c.when || c.when());
    let ranked = tokens.length
      ? visible
          .map((c) => ({ c, s: score(c, tokens) }))
          .filter((r) => r.s >= 0)
          .sort((a, b) => b.s - a.s)
          .map((r) => r.c)
      : visible;
    if (tokens.length) providers.forEach((fn) => (ranked = ranked.concat(fn(query) || [])));
    results = ranked.slice(0, 40);
    active = 0;
    if (!results.length) {
      list.innerHTML = `<div class="palette__empty">${escapeHtml(t('palette.empty'))}</div>`;
      return;
    }
    let group = null;
    list.innerHTML = results
      .map((c, i) => {
        const label = typeof c.label === 'function' ? c.label() : t(c.label);
        const head = c.group !== group ? `<div class="palette__group">${escapeHtml(t(c.group))}</div>` : '';
        group = c.group;
        const hint = c.hint ? `<small>${escapeHtml(typeof c.hint === 'function' ? c.hint() : t(c.hint))}</small>` : '';
        return `${head}<button type="button" class="palette__item${i === 0 ? ' is-active' : ''}" role="option" data-index="${i}">${icons[c.icon] || icons.arrow}<span>${escapeHtml(label)}</span>${hint}</button>`;
      })
      .join('');
  }

  function highlight(index) {
    const items = list.querySelectorAll('.palette__item');
    if (!items.length) return;
    active = (index + items.length) % items.length;
    items.forEach((n, i) => n.classList.toggle('is-active', i === active));
    items[active].scrollIntoView({ block: 'nearest' });
  }

  function run(index) {
    const cmd = results[index];
    if (!cmd) return;
    modal.close();
    // let the modal close before navigating/scrolling
    setTimeout(() => cmd.run(), 120);
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(active);
    }
  });
  list.addEventListener('click', (e) => {
    const item = e.target.closest('.palette__item');
    if (item) run(Number(item.dataset.index));
  });
  list.addEventListener('pointermove', (e) => {
    const item = e.target.closest('.palette__item');
    if (item && Number(item.dataset.index) !== active) highlight(Number(item.dataset.index));
  });

  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
      e.preventDefault();
      modal.toggle();
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-palette]')) modal.open();
  });
  bus.on('lang', () => modal.isOpen && render());
  return modal;
}
