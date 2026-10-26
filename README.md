# Axis Towers — website redesign (concept)

A rebuilt, trilingual (ქართული / English / Русский) website for **Axis Towers**, Tbilisi.
It is a static site: open `index.html` and it runs — no server, no build step needed to view it.

## Open it

- **Quickest:** double-click `index.html`.
- **Best (all browsers, all features):** serve the folder locally, e.g.
  `npx serve .` or `python3 -m http.server 8000`, then open <http://localhost:8000>.
  The map tiles and the "Book a stay" / WhatsApp links need an internet connection.

## Pages

| Page | File | Highlights |
|---|---|---|
| Home | `index.html` | Live 3D twin towers, sunlight study, stacking plan, "view from your floor", location map |
| Residences | `residences.html` | Apartment finder, saved units, compare, floor plans, payment calculator, FAQ |
| Business Center | `offices.html` | Class A features, World Trade Center Tbilisi, office finder |
| Hotel & Sky Bar | `hotel.html` | Pullman rooms, Dumas (36), Weather Report (37), wellness |
| Lifestyle | `lifestyle.html` | Falestra street, shopping center (−1), spa/pool/gym, events |
| The Towers | `about.html` | Story, the 2°-per-floor twist (interactive), structure, architects, timeline |
| News | `news.html` | Filterable news cards linking to the full stories on axistowers.ge |
| Contact | `contact.html` | Phone / *1717 / email / WhatsApp, booking, map |

## What's new (the "multifunction" part)

- **Live 3D model** (three.js) of both towers — each floor turned 2° in opposite directions, lit by the
  **real sun position over Tbilisi** for the current time ("Live"), or sunrise / day / sunset / night.
  Windows light up after dark; the sky bar and pool glow; traffic moves along Chavchavadze Ave.
- **3D explorer + sunlight study:** orbit, pick any day of the year and hour, play a whole day,
  see sunrise/sunset/daylight; switch to **Uses** to colour floors by function; click a floor for details.
- **Stacking plan:** both towers floor by floor, filterable by use, keyboard accessible.
- **View from your floor:** a parallax panorama that opens up as you pick a higher floor.
- **Apartment & office finder:** filters (bedrooms, floor, area, price/rent), availability-by-floor strip,
  sorting, grid/list, **saved** units, **compare up to 3**, detail drawer with an indicative **floor plan**,
  shareable deep links (`residences.html#unit=24B`, `residences.html?floor=24`).
- **Payment calculator:** monthly payment, principal vs interest, balance chart (hover + keyboard), table view.
- **Book a viewing:** 4-step flow that sends a pre-written request via **WhatsApp or email**, and can
  **add the appointment to your calendar** (.ics). Set `FORM_ENDPOINT` in `src/features/booking.js` to
  also POST requests to a CRM.
- **Command palette:** press **⌘K / Ctrl+K** (or `/`) to jump to any page or section, run actions,
  switch language/currency, or search units ("2 bedrooms", "floor 25", "24B", "penthouse").
- **The lift:** a floor indicator follows you down each page; click it for a lift panel to jump around.
- **Preferences:** language (live switch, no reload), day/night theme, currency (₾ / $ / €),
  m² / ft², reduced motion. All remembered.
- Preloader that counts the floors (B4 → 37), page-to-page curtain transitions, custom cursor,
  smooth scrolling, scroll-driven reveals — all disabled automatically for reduced-motion users.

## Edit content

Everything is generated from `src/` by `build.mjs`:

```
src/i18n/en.js, ka.js, ru.js   all text (same structure in each language)
src/data/project.js            facts, contacts, coordinates, floor-by-floor uses, 3D massing
src/data/units.js              apartment / office inventory  ← DEMO DATA, see below
src/data/news.js               news cards (titles/excerpts live in i18n under news.items)
src/pages/*.html               page templates ({{t:key}} = English text baked in at build)
src/partials/*.html            shared head, header/menu, footer, 3D explorer
src/styles/*.css               design system and page styles
src/core, src/features         behaviour (i18n, scroll, palette, finder, 3D, …)
```

Rebuild after editing:

```bash
npm install
npm run build      # or: npm run dev  (rebuilds on save)
```

The built files are `*.html` in this folder plus `assets/css/main.css` and `assets/js/{app,scene,map}.js`
(`scene.js` = three.js, only loaded on the home page; `map.js` = Leaflet, home + contact).

## Before going live — please check

1. **Content source.** axistowers.ge could not be opened from the environment this was built in, so the
   copy was written from public information about the project (the official site's indexed pages, Accor /
   Pullman announcements, CTBUH, supplier project references). Facts used: 147 m, 37 + 4 floors,
   2° rotation per floor, core + 12 pylons, Pullman on floors 19–35 (218 rooms), Dumas on 36,
   Weather Report on 37, 17,000 m² business center, 700 m² business lobby, 7 meeting rooms,
   WTC status (2020), 2,500 m² courtyard, 25 × 9 m pool, shopping center on −1, Falestra tenants,
   phone +995 32 237 17 17 / *1717, info@ and sales@axistowers.ge, 37m Ilia Chavchavadze Ave.
   **Verify** these, and especially the floor allocation in `TOWER_STACK` (residences 4–37, offices 4–18),
   which is inferred from listings.
2. **Inventory is demo data** (`src/data/units.js`, flagged on screen). Connect the real sales feed.
3. **Photography.** There are no photos yet — the architectural line drawings and the 3D model stand in.
   Add the official renders/photos where the `.art` panels and cards are.
4. **Exchange rates** for $ / € are indicative (`src/core/currency.js`).
5. **Map tiles** come from CARTO/OpenStreetMap; check their usage terms for production traffic.

## Credits

three.js (MIT) · GSAP (standard no-charge licence) · Lenis (MIT) · Leaflet (BSD-2) ·
Inter Tight, Cormorant Garamond, Noto Sans Georgian, Noto Serif Georgian (SIL OFL, via Fontsource).
