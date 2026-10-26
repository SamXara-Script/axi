// Runtime language engine. Static pages ship with English text baked in at build time;
// switching language rewrites every [data-i18n] node in place, without reloading.
//
//   <h2 data-i18n="home.intro.title">…</h2>                → innerHTML
//   <input data-i18n-attr="placeholder:form.name">          → attributes ("attr:key; attr2:key2")
import en from '../i18n/en.js';
import ka from '../i18n/ka.js';
import ru from '../i18n/ru.js';
import { store, bus } from './store.js';

const dictionaries = { en, ka, ru };
export const LANGS = [
  { code: 'ka', label: 'ქარ', name: 'ქართული', locale: 'ka-GE' },
  { code: 'en', label: 'Eng', name: 'English', locale: 'en-GB' },
  { code: 'ru', label: 'Рус', name: 'Русский', locale: 'ru-RU' },
];

let current = detect();

function detect() {
  const saved = store.get('lang');
  if (saved && dictionaries[saved]) return saved;
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return dictionaries[nav] ? nav : 'en';
}

function resolve(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? node : node[part]), dict);
}

export function lang() {
  return current;
}

export function locale() {
  return LANGS.find((l) => l.code === current).locale;
}

// t('finder.results', { count: 3 }) — falls back to English, then to the key itself.
export function t(key, vars) {
  let value = resolve(dictionaries[current], key);
  if (value == null) value = resolve(en, key);
  if (value == null) return key;
  if (typeof value === 'function') return value(vars || {});
  if (vars && typeof value === 'string') {
    value = value.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
  }
  return value;
}

// Arrays/objects (e.g. lists of FAQ entries) for the current language.
export function tList(key) {
  const value = resolve(dictionaries[current], key) ?? resolve(en, key);
  return Array.isArray(value) ? value : [];
}

export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = t(el.dataset.i18n);
    if (el.innerHTML !== value) el.innerHTML = value;
  });
  // static figures in the markup ("17,000") regroup per language ("17 000")
  root.querySelectorAll('[data-num]').forEach((el) => {
    const n = Number(el.dataset.num);
    const digits = (el.dataset.num.split('.')[1] || '').length;
    el.textContent = fmtNumber(n, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
}

export function setLang(code) {
  if (!dictionaries[code] || code === current) return;
  current = code;
  store.set('lang', code);
  syncDocument();
  apply();
  bus.emit('lang', code);
}

function syncDocument() {
  const html = document.documentElement;
  html.lang = current;
  html.dataset.lang = current;
  const title = document.querySelector('meta[name="i18n-title"]');
  if (title) document.title = t(title.content);
}

// Number helpers that follow the active language.
export function fmtNumber(value, options) {
  return new Intl.NumberFormat(locale(), options).format(value);
}

export function init() {
  syncDocument();
  apply();
}
