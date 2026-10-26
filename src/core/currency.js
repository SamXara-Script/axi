// Prices are stored in lari (as axistowers.ge quotes them) and shown in the visitor's currency.
// Dollar and euro rates are indicative — update them, or wire them to the NBG feed, before launch.
import { store, bus } from './store.js';
import { locale, t } from './i18n.js';

export const CURRENCIES = {
  GEL: { symbol: '₾', rate: 1 },
  USD: { symbol: '$', rate: 1 / 2.7 },
  EUR: { symbol: '€', rate: 1 / 3.15 },
};

let current = store.get('currency', 'GEL');
if (!CURRENCIES[current]) current = 'GEL';

export function currency() {
  return current;
}

export function setCurrency(code) {
  if (!CURRENCIES[code] || code === current) return;
  current = code;
  store.set('currency', code);
  bus.emit('currency', code);
}

export function convert(gel) {
  return gel * CURRENCIES[current].rate;
}

// money(675000) → "₾675,000" / "675 000 ₾" / "$250,000" depending on language + currency
export function money(gel, { compact = false } = {}) {
  return new Intl.NumberFormat(locale(), {
    style: 'currency',
    currency: current,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
    notation: compact ? 'compact' : 'standard',
  }).format(convert(gel));
}

// Area: m² by default, optional ft² for international buyers.
let unit = store.get('area', 'm2');
export function areaUnit() {
  return unit;
}
export function setAreaUnit(next) {
  unit = next === 'ft2' ? 'ft2' : 'm2';
  store.set('area', unit);
  bus.emit('area', unit);
}
export function area(m2, digits = 1) {
  const value = unit === 'ft2' ? m2 * 10.7639 : m2;
  const formatted = new Intl.NumberFormat(locale(), { maximumFractionDigits: unit === 'ft2' ? 0 : digits }).format(value);
  return `${formatted} ${unit === 'ft2' ? 'ft²' : t('units.m2')}`;
}
