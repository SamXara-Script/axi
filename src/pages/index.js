// Per-page features. Each initialiser may return a promise the intro waits for.
import { initHome } from './home.js';
import { initResidencesPage, initOfficesPage, initNewsPage, initContactPage, initAboutPage, initGenericPage } from './inner.js';

const PAGES = {
  index: initHome,
  residences: initResidencesPage,
  offices: initOfficesPage,
  news: initNewsPage,
  contact: initContactPage,
  about: initAboutPage,
};

export function initPage(page, options) {
  return (PAGES[page] || initGenericPage)(options);
}
