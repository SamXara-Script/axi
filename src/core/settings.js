// Preferences dock: theme, currency, area unit and motion — remembered between visits.
import { t } from './i18n.js';
import { store, bus } from './store.js';
import { currency, setCurrency, CURRENCIES, areaUnit, setAreaUnit } from './currency.js';
import { layer, icons, h, $, toast } from './ui.js';
import { switchLanguage } from './chrome.js';

export function initSettings() {
  const dock = h(`<div class="dock">
      <button class="icon-btn" type="button" data-theme-toggle aria-pressed="false">${icons.moon}</button>
      <button class="icon-btn" type="button" data-settings-open aria-haspopup="dialog">${icons.globe}</button>
    </div>`);
  document.body.append(dock);
  const settingsBtn = $('[data-settings-open]', dock);
  settingsBtn.setAttribute('aria-label', t('settings.title'));

  const themeBtn = $('[data-theme-toggle]', dock);
  const syncThemeIcon = () => {
    themeBtn.innerHTML = document.documentElement.dataset.theme === 'light' ? icons.moon : icons.sun;
  };
  syncThemeIcon();
  bus.on('theme', syncThemeIcon);

  const el = h(`<div class="modal settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div class="modal__panel">
        <button class="icon-btn icon-btn--sm modal__close" type="button" data-close aria-label="Close">${icons.close}</button>
        <div class="settings__body"></div>
      </div>
    </div>`);
  document.body.append(el);
  const modal = layer(el);

  const motion = () => (store.get('motion') === 'off' ? 'off' : 'on');
  const group = (name, current, options) => `
    <div class="settings__row">
      <p class="label">${t(`settings.${name}`)}</p>
      <div class="segmented" role="group" aria-label="${t(`settings.${name}`)}">
        ${options.map(([value, label]) => `<button type="button" data-set="${name}" data-value="${value}" aria-pressed="${current === value}">${label}</button>`).join('')}
      </div>
    </div>`;

  function render() {
    $('.settings__body', el).innerHTML = `
      <p class="eyebrow">${t('settings.eyebrow')}</p>
      <h2 class="h3" id="settings-title" style="margin:14px 0 26px">${t('settings.title')}</h2>
      ${group('language', document.documentElement.lang, [['ka', 'ქართული'], ['en', 'English'], ['ru', 'Русский']])}
      ${group('theme', document.documentElement.dataset.theme || 'dark', [['dark', t('settings.night')], ['light', t('settings.day')]])}
      ${group('currency', currency(), Object.keys(CURRENCIES).map((c) => [c, `${CURRENCIES[c].symbol} ${c}`]))}
      ${group('area', areaUnit(), [['m2', 'm²'], ['ft2', 'ft²']])}
      ${group('motion', motion(), [['on', t('settings.motionOn')], ['off', t('settings.motionOff')]])}
      <p class="small faint" style="margin-top:22px">${t('settings.note')}</p>`;
  }

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set]');
    if (!btn) return;
    const { set, value } = btn.dataset;
    if (set === 'language') {
      modal.close();
      switchLanguage(value);
      return;
    }
    if (set === 'theme' && document.documentElement.dataset.theme !== value) document.querySelector('[data-theme-toggle]').click();
    if (set === 'currency') setCurrency(value);
    if (set === 'area') setAreaUnit(value);
    if (set === 'motion' && motion() !== value) {
      store.set('motion', value);
      toast(t('settings.motionReload'));
      setTimeout(() => location.reload(), 900);
    }
    render();
  });

  settingsBtn.addEventListener('click', () => {
    render();
    modal.open();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-settings]')) {
      render();
      modal.open();
    }
  });
  bus.on('lang', () => {
    settingsBtn.setAttribute('aria-label', t('settings.title'));
    if (modal.isOpen) render();
  });
  return modal;
}
