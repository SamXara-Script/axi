// Site-wide entries for the command palette.
import { registerCommands } from '../core/palette.js';
import { switchLanguage } from '../core/chrome.js';
import { setCurrency } from '../core/currency.js';
import { scrollTo } from '../core/scroll.js';
import { openBooking } from './booking.js';
import { PROJECT } from '../data/project.js';
import { NAV } from '../data/nav.js';
import { copyText, toast } from '../core/ui.js';
import { t } from '../core/i18n.js';

const go = (href) => () => {
  const curtain = document.querySelector('.curtain');
  if (!curtain) return (window.location.href = href);
  // reuse the page transition by clicking a temporary link
  const a = document.createElement('a');
  a.href = href;
  document.body.append(a);
  a.click();
  a.remove();
};

export function registerSiteCommands() {
  registerCommands(
    NAV.map((item) => ({
      group: 'palette.groups.pages',
      label: item.label,
      keywords: item.keywords,
      icon: 'arrow',
      hint: () => item.floor,
      run: go(item.href),
    })),
  );

  // sections of the current page (anything with a lift floor number)
  registerCommands(
    [...document.querySelectorAll('[data-floor-label][id]')].map((section) => ({
      group: 'palette.groups.sections',
      label: section.dataset.floorLabel,
      icon: 'layers',
      hint: () => section.dataset.floor,
      run: () => scrollTo(section),
    })),
  );

  registerCommands([
    { group: 'palette.groups.actions', label: 'palette.book', keywords: 'viewing visit appointment', icon: 'calendar', run: () => openBooking() },
    { group: 'palette.groups.actions', label: 'palette.call', keywords: 'phone sales', icon: 'phone', hint: () => PROJECT.phone, run: () => (window.location.href = PROJECT.phoneHref) },
    { group: 'palette.groups.actions', label: 'palette.whatsapp', keywords: 'message chat', icon: 'whatsapp', run: () => window.open(`https://wa.me/${PROJECT.whatsapp}`, '_blank', 'noopener') },
    { group: 'palette.groups.actions', label: 'palette.email', keywords: 'mail', icon: 'mail', hint: () => PROJECT.email, run: () => (window.location.href = `mailto:${PROJECT.email}`) },
    {
      group: 'palette.groups.actions',
      label: 'palette.copyAddress',
      keywords: 'address location map',
      icon: 'pin',
      run: () => copyText(t('contact.addressPlain')).then((ok) => ok && toast(t('common.copied'))),
    },
    { group: 'palette.groups.actions', label: 'palette.explore3d', keywords: '3d model sun light', icon: 'cube', run: go('index.html#explore') },
    { group: 'palette.groups.actions', label: 'palette.calculator', keywords: 'mortgage loan payment', icon: 'calc', run: go('residences.html#calculator') },
    { group: 'palette.groups.settings', label: () => 'ქართული', keywords: 'georgian ka language', icon: 'globe', run: () => switchLanguage('ka') },
    { group: 'palette.groups.settings', label: () => 'English', keywords: 'english en language', icon: 'globe', run: () => switchLanguage('en') },
    { group: 'palette.groups.settings', label: () => 'Русский', keywords: 'russian ru language', icon: 'globe', run: () => switchLanguage('ru') },
    { group: 'palette.groups.settings', label: 'palette.theme', keywords: 'dark light mode', icon: 'moon', run: () => document.querySelector('[data-theme-toggle]')?.click() },
    { group: 'palette.groups.settings', label: () => 'USD $', keywords: 'currency dollar', icon: 'currency', run: () => setCurrency('USD') },
    { group: 'palette.groups.settings', label: () => 'GEL ₾', keywords: 'currency lari', icon: 'currency', run: () => setCurrency('GEL') },
    { group: 'palette.groups.settings', label: () => 'EUR €', keywords: 'currency euro', icon: 'currency', run: () => setCurrency('EUR') },
  ]);
}
