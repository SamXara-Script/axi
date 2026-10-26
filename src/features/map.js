// Location map (Leaflet + CARTO basemaps, themed with the site). Wheel-zoom only after the
// map is clicked, so it never hijacks page scrolling. Falls back to a note when offline.
//
// Ships as its own bundle, so it receives the app's translator and event bus instead of
// importing them (a second copy of those modules would hold separate state).
import L from 'leaflet';
import { PROJECT } from '../data/project.js';

// Places with verified coordinates (see README); labels are translated.
const POIS = [
  { key: 'home.loc.d1', lat: 41.7089, lng: 44.7514 },
  { key: 'home.loc.d3', lat: 41.6934, lng: 44.8015 },
  { key: 'home.loc.d4', lat: 41.6878, lng: 44.8086 },
];

const tiles = (theme) =>
  `https://{s}.basemaps.cartocdn.com/${theme === 'light' ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`;

export function initMap({ t, bus }) {
  document.querySelectorAll('[data-map]').forEach((el) => mount(el, t, bus));
}

function mount(el, t, bus) {
  const { lat, lng } = PROJECT.coords;
  const map = L.map(el, {
    center: [lat - 0.004, lng + 0.012],
    zoom: 14,
    scrollWheelZoom: false,
    zoomControl: true,
    attributionControl: true,
  });
  let failures = 0;
  const layer = L.tileLayer(tiles(document.documentElement.dataset.theme), {
    subdomains: 'abcd',
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  }).addTo(map);
  layer.on('tileerror', () => {
    if (++failures === 6) el.classList.add('is-offline');
  });
  layer.on('tileload', () => el.classList.remove('is-offline'));

  // distance rings around the towers
  [1000, 2000, 4000].forEach((radius) =>
    L.circle([lat, lng], { radius, color: 'currentColor', weight: 1, opacity: 0.35, fill: false, interactive: false, className: 'map__ring' }).addTo(map),
  );

  const home = L.marker([lat, lng], {
    icon: L.divIcon({
      className: 'map-pin',
      html: '<span class="map-pin__pulse"></span><span class="map-pin__dot"></span><span class="map-pin__label">Axis Towers<small>147 m</small></span>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
    keyboard: false,
  }).addTo(map);

  const poiMarkers = POIS.map((p) =>
    L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: 'map-poi', html: `<span class="map-poi__dot"></span><span class="map-poi__label"></span>`, iconSize: [10, 10], iconAnchor: [5, 5] }),
      keyboard: false,
    }).addTo(map),
  );
  const labelPois = () =>
    poiMarkers.forEach((m, i) => {
      const label = m.getElement()?.querySelector('.map-poi__label');
      if (label) label.textContent = t(POIS[i].key);
    });
  labelPois();

  map.on('click', () => map.scrollWheelZoom.enable());
  map.on('mouseout', () => map.scrollWheelZoom.disable());
  el.setAttribute('aria-label', t('contactPage.mapTitle'));

  bus.on('theme', (theme) => layer.setUrl(tiles(theme)));
  bus.on('lang', labelPois);
  // the map is often first measured while hidden behind the preloader
  document.addEventListener('axis:ready', () => map.invalidateSize(), { once: true });
  window.addEventListener('resize', () => map.invalidateSize());
  return { map, home };
}
