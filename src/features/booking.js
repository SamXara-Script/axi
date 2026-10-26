// "Book a private viewing": a four-step dialog that works without a backend.
// The request goes out through WhatsApp or e-mail (pre-filled), the visitor can add the
// appointment to their calendar (.ics), and FORM_ENDPOINT can be set to POST it to a CRM.
import { t, lang, locale } from '../core/i18n.js';
import { PROJECT } from '../data/project.js';
import { layer, icons, h, $, $$, escapeHtml, toast, copyText } from '../core/ui.js';
import { bus } from '../core/store.js';

const FORM_ENDPOINT = ''; // e.g. 'https://formspree.io/f/xxxx' — leave empty to use WhatsApp / e-mail
const INTERESTS = ['residence', 'office', 'retail', 'hotel', 'other'];
const ROOMS = ['studio', '1', '2', '3', 'penthouse'];
const SLOTS = ['10:00', '11:00', '12:00', '13:00', '15:00', '16:00', '17:00', '18:00'];

let modal;
let el;
const state = { step: 0, interest: 'residence', rooms: '2', unit: '', date: '', time: '', mode: 'visit', name: '', phone: '', email: '', contact: 'whatsapp', note: '' };

export function initBooking() {
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-book]');
    if (!trigger) return;
    e.preventDefault();
    openBooking({ interest: trigger.dataset.book || undefined, unit: trigger.dataset.bookUnit || '' });
  });
  bus.on('lang', () => el && render());
}

export function openBooking({ interest, unit = '' } = {}) {
  if (!el) build();
  if (interest && INTERESTS.includes(interest)) state.interest = interest;
  state.unit = unit;
  state.step = 0;
  render();
  modal.open();
}

function build() {
  el = h(`<div class="modal booking" role="dialog" aria-modal="true" aria-labelledby="booking-title">
    <div class="modal__panel" data-lenis-prevent>
      <button class="icon-btn icon-btn--sm modal__close" type="button" data-close data-i18n-attr="aria-label:common.close" aria-label="${t('common.close')}">${icons.close}</button>
      <div class="booking__inner"></div>
    </div>
  </div>`);
  document.body.append(el);
  modal = layer(el);
  el.addEventListener('click', onClick);
  el.addEventListener('input', onInput);
  el.addEventListener('change', onInput);
}

// ------------------------------------------------------------------ rendering
function upcomingDays(count = 14) {
  const days = [];
  const now = new Date();
  for (let i = 1; days.length < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (d.getDay() === 0) continue; // sales office closed on Sundays
    days.push(d);
  }
  return days;
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function render() {
  const steps = ['booking.stepInterest', 'booking.stepDetails', 'booking.stepTime', 'booking.stepContact'];
  const inner = $('.booking__inner', el);
  const done = state.step === 4;
  inner.innerHTML = `
    <p class="eyebrow">${t('booking.eyebrow')}</p>
    <h2 class="h3 booking__title" id="booking-title">${done ? t('booking.doneTitle') : t('booking.title')}</h2>
    ${done ? '' : `<ol class="booking__steps">${steps
      .map((s, i) => `<li class="${i === state.step ? 'is-current' : i < state.step ? 'is-done' : ''}"><span>${i + 1}</span>${t(s)}</li>`)
      .join('')}</ol>`}
    <div class="booking__body">${[stepInterest, stepDetails, stepTime, stepContact, stepDone][state.step]()}</div>
    ${done ? '' : `<div class="booking__nav">
      ${state.step > 0 ? `<button type="button" class="btn btn--sm" data-nav="back">${t('common.back')}</button>` : '<span></span>'}
      <button type="button" class="btn btn--primary" data-nav="next">${state.step === 3 ? t('booking.submit') : t('common.continue')} ${icons.arrow}</button>
    </div>`}`;
}

function stepInterest() {
  return `<div class="tile-group">${INTERESTS.map(
    (k) => `<label class="tile"><input type="radio" name="interest" value="${k}" ${state.interest === k ? 'checked' : ''}>
      <span><b>${t(`booking.interest.${k}`)}</b><small>${t(`booking.interestHint.${k}`)}</small></span></label>`,
  ).join('')}</div>`;
}

function stepDetails() {
  const rooms =
    state.interest === 'residence'
      ? `<p class="label">${t('booking.rooms')}</p>
        <div class="row booking__chips">${ROOMS.map((r) => `<button type="button" class="chip" data-rooms="${r}" aria-pressed="${state.rooms === r}">${t(`booking.roomsOption.${r}`)}</button>`).join('')}</div>`
      : '';
  return `${rooms}
    ${state.unit ? `<p class="booking__unit">${icons.pin}<span>${t('booking.unit')}: <b>${escapeHtml(state.unit)}</b></span></p>` : ''}
    <div class="field" style="margin-top:22px">
      <textarea id="bk-note" name="note" placeholder=" " rows="3">${escapeHtml(state.note)}</textarea>
      <label for="bk-note">${t('booking.note')}</label>
    </div>`;
}

function stepTime() {
  const days = upcomingDays();
  if (!state.date) state.date = iso(days[0]);
  const dayFmt = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
  const dateFmt = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' });
  return `
    <div class="segmented" role="group" aria-label="${t('booking.mode')}">
      <button type="button" data-mode="visit" aria-pressed="${state.mode === 'visit'}">${t('booking.visit')}</button>
      <button type="button" data-mode="video" aria-pressed="${state.mode === 'video'}">${t('booking.video')}</button>
    </div>
    <p class="label" style="margin-top:26px">${t('booking.date')}</p>
    <div class="booking__days" data-lenis-prevent>${days
      .map((d) => {
        const v = iso(d);
        return `<button type="button" class="booking__day" data-date="${v}" aria-pressed="${state.date === v}"><small>${dayFmt.format(d)}</small><b>${d.getDate()}</b><small>${dateFmt.format(d).replace(/\d+\s?/, '')}</small></button>`;
      })
      .join('')}</div>
    <p class="label" style="margin-top:22px">${t('booking.time')}</p>
    <div class="row booking__chips">${SLOTS.map((s) => `<button type="button" class="chip" data-time="${s}" aria-pressed="${state.time === s}">${s}</button>`).join('')}</div>
    <p class="field__error" data-error="time"></p>`;
}

function stepContact() {
  const field = (name, type, auto, extra = '') => `
    <div class="field" data-field="${name}">
      <input id="bk-${name}" name="${name}" type="${type}" autocomplete="${auto}" placeholder=" " value="${escapeHtml(state[name])}" ${extra}>
      <label for="bk-${name}">${t(`booking.${name}`)}</label>
      <p class="field__error" data-error="${name}"></p>
    </div>`;
  return `<div class="booking__fields">
      ${field('name', 'text', 'name', 'required')}
      ${field('phone', 'tel', 'tel', 'required inputmode="tel"')}
      ${field('email', 'email', 'email')}
    </div>
    <p class="label" style="margin-top:20px">${t('booking.contactVia')}</p>
    <div class="row booking__chips">${['whatsapp', 'phone', 'email']
      .map((c) => `<button type="button" class="chip" data-contact="${c}" aria-pressed="${state.contact === c}">${t(`booking.via.${c}`)}</button>`)
      .join('')}</div>
    <p class="small faint" style="margin-top:18px">${t('booking.privacy')}</p>`;
}

function summaryLines() {
  const dateText = state.date
    ? new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${state.date}T12:00:00`))
    : '';
  return [
    `${t('booking.summary.interest')}: ${t(`booking.interest.${state.interest}`)}${state.interest === 'residence' ? ` · ${t(`booking.roomsOption.${state.rooms}`)}` : ''}`,
    state.unit ? `${t('booking.unit')}: ${state.unit}` : '',
    `${t('booking.summary.when')}: ${dateText}, ${state.time} (${t(state.mode === 'video' ? 'booking.video' : 'booking.visit')})`,
    `${t('booking.name')}: ${state.name}`,
    `${t('booking.phone')}: ${state.phone}`,
    state.email ? `${t('booking.email')}: ${state.email}` : '',
    state.note ? `${t('booking.note')}: ${state.note}` : '',
  ].filter(Boolean);
}

function stepDone() {
  const lines = summaryLines();
  const text = `${t('booking.messageIntro')}\n\n${lines.join('\n')}`;
  const wa = `https://wa.me/${PROJECT.whatsapp}?text=${encodeURIComponent(text)}`;
  const mail = `mailto:${PROJECT.email}?subject=${encodeURIComponent(t('booking.mailSubject'))}&body=${encodeURIComponent(text)}`;
  return `
    <p class="lead">${t('booking.doneLead')}</p>
    <ul class="booking__summary">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>
    <div class="booking__send">
      <a class="btn btn--primary" href="${wa}" target="_blank" rel="noopener">${icons.whatsapp}${t('booking.sendWhatsapp')}</a>
      <a class="btn" href="${mail}">${icons.mail}${t('booking.sendEmail')}</a>
      <button type="button" class="btn" data-ics>${icons.calendar}${t('booking.addCalendar')}</button>
      <button type="button" class="btn btn--sm" data-copy>${t('booking.copy')}</button>
    </div>
    <p class="small faint">${t('booking.orCall')} <a class="link" href="${PROJECT.phoneHref}">${PROJECT.phone}</a></p>`;
}

// ------------------------------------------------------------------ behaviour
function onInput(e) {
  const target = e.target;
  if (target.name === 'interest') state.interest = target.value;
  else if (target.name in state) state[target.name] = target.value;
  target.closest('.field')?.classList.remove('is-invalid');
}

function onClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.dataset.rooms) pick('rooms', btn.dataset.rooms);
  else if (btn.dataset.mode) pick('mode', btn.dataset.mode);
  else if (btn.dataset.date) pick('date', btn.dataset.date);
  else if (btn.dataset.time) pick('time', btn.dataset.time);
  else if (btn.dataset.contact) pick('contact', btn.dataset.contact);
  else if (btn.dataset.nav === 'back') {
    state.step = Math.max(0, state.step - 1);
    render();
  } else if (btn.dataset.nav === 'next') next();
  else if ('ics' in btn.dataset) downloadIcs();
  else if ('copy' in btn.dataset) copyText(summaryLines().join('\n')).then((ok) => ok && toast(t('common.copied')));
}

function pick(key, value) {
  state[key] = value;
  const attr = { rooms: 'rooms', mode: 'mode', date: 'date', time: 'time', contact: 'contact' }[key];
  $$(`[data-${attr}]`, el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));
  if (key === 'time') $('[data-error="time"]', el).textContent = '';
}

function validate() {
  if (state.step === 2 && !state.time) {
    $('[data-error="time"]', el).textContent = t('booking.errors.time');
    return false;
  }
  if (state.step !== 3) return true;
  let ok = true;
  const fail = (name, key) => {
    ok = false;
    const field = $(`[data-field="${name}"]`, el);
    field.classList.add('is-invalid');
    $(`[data-error="${name}"]`, field).textContent = t(`booking.errors.${key}`);
  };
  if (state.name.trim().length < 2) fail('name', 'name');
  if (state.phone.replace(/[^\d]/g, '').length < 9) fail('phone', 'phone');
  if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) fail('email', 'email');
  if (state.contact === 'email' && !state.email) fail('email', 'emailRequired');
  if (!ok) $('.is-invalid input', el)?.focus();
  return ok;
}

async function next() {
  if (!validate()) return;
  if (state.step < 3) {
    state.step++;
    render();
    $('.booking__body', el).querySelector('input, button')?.focus({ preventScroll: true });
    return;
  }
  if (FORM_ENDPOINT) {
    try {
      await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...state, lang: lang(), source: location.pathname }),
      });
    } catch {
      /* the WhatsApp / e-mail buttons on the next screen still work */
    }
  }
  state.step = 4;
  render();
}

function downloadIcs() {
  const [hh, mm] = (state.time || '12:00').split(':').map(Number);
  const [y, m, d] = state.date.split('-').map(Number);
  // Tbilisi is UTC+4 all year
  const start = new Date(Date.UTC(y, m - 1, d, hh - PROJECT.utcOffset, mm));
  const end = new Date(start.getTime() + 45 * 60000);
  const stamp = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Axis Towers//Viewing//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@axistowers`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${t('booking.icsTitle')}`,
    `LOCATION:${t('contact.addressLine').replace(/<[^>]+>/g, ' ').replace(/,/g, '\\,')}`,
    `DESCRIPTION:${summaryLines().join('\\n').replace(/,/g, '\\,')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'axis-towers-viewing.ics';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
