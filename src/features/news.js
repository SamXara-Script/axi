// News cards: [data-news="3"] shows the latest three; [data-news-filters] adds category chips.
import { t, locale } from '../core/i18n.js';
import { bus } from '../core/store.js';
import { $$, escapeHtml, icons } from '../core/ui.js';
import { NEWS } from '../data/news.js';

const CAT_COLOR = { hotel: 'var(--z-hotel)', business: 'var(--z-office)', project: 'var(--accent)', lifestyle: 'var(--z-retail)' };

function formatDate(value) {
  if (!value) return '';
  const [y, m] = value.split('-').map(Number);
  if (!m) return String(y);
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
}

function card(item, index) {
  const title = t(`news.items.${item.id}.title`);
  const excerpt = t(`news.items.${item.id}.excerpt`);
  return `
    <a class="news-card" href="${item.url}" target="_blank" rel="noopener" style="--cat:${CAT_COLOR[item.cat]}" data-cursor="Read" data-cursor-i18n="common.readMore">
      <div class="news-card__top">
        <span class="news-card__cat">${escapeHtml(t(`news.cats.${item.cat}`))}</span>
        <span class="news-card__date">${escapeHtml(formatDate(item.date))}</span>
      </div>
      <span class="news-card__num" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <h3 class="h3">${escapeHtml(title)}</h3>
      <p class="muted">${escapeHtml(excerpt)}</p>
      <span class="news-card__more">${escapeHtml(t('news.read'))} ${icons.arrow}</span>
    </a>`;
}

export function renderNews() {
  $$('[data-news]').forEach((grid) => {
    const limit = Number(grid.dataset.news) || NEWS.length;
    const filters = grid.parentElement.querySelector('[data-news-filters]');
    let active = 'all';

    const render = () => {
      const items = NEWS.filter((n) => active === 'all' || n.cat === active).slice(0, limit);
      grid.innerHTML = items.map(card).join('');
      if (filters) {
        const cats = ['all', ...new Set(NEWS.map((n) => n.cat))];
        filters.innerHTML = cats
          .map((c) => `<button type="button" class="chip" data-cat="${c}" aria-pressed="${c === active}">${escapeHtml(c === 'all' ? t('news.all') : t(`news.cats.${c}`))}</button>`)
          .join('');
      }
    };
    filters?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      active = b.dataset.cat;
      render();
    });
    render();
    bus.on('lang', render);
  });
}

