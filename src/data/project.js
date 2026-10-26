// Project facts shared by every page and feature. Copy that needs translating lives in src/i18n.
// Sources: axistowers.ge (EN/KA pages), Pullman/Accor announcements, Reynaers & Saint-Gobain
// project references, CTBUH Skyscraper Center. Verify against the live site before launch.
export const PROJECT = {
  name: 'Axis Towers',
  // Vake, 37m Ilia Chavchavadze Ave — used for the map and the sunlight study (approximate).
  coords: { lat: 41.7118, lng: 44.7568 },
  utcOffset: 4, // Georgia: UTC+4, no daylight saving
  heightM: 147,
  floorsAbove: 37,
  floorsBelow: 4,
  rotationPerFloorDeg: 2, // each floor turns 2° around the core; the towers twist in opposite directions
  pylons: 12,
  completed: 2019,
  hotelOpened: 2022,
  wtcSince: 2020,
  phone: '+995 32 237 17 17',
  phoneHref: 'tel:+995322371717',
  shortCode: '*1717',
  whatsapp: '995322371717',
  email: 'info@axistowers.ge',
  salesEmail: 'sales@axistowers.ge',
  hotelUrl: 'https://pullmantbilisi.com/',
  architects: ['Alexander Mezhevidze', 'Gega Astakhishvili', 'Nino Mosulishvili', 'Nikoloz Kilasonia'],

  // Simplified massing used by the 3D model (metres).
  massing: {
    floors: 37,
    floorHeight: 3.85,
    crown: 4.6,
    podiumFloors: 3,
    podiumFloorHeight: 5.2,
    siteRotationDeg: 14,
    avenueZ: 62,
    towers: {
      stone: { x: -29, z: 0, w: 31, d: 31, bay: 3.1, twist: 1 },
      glass: { x: 29, z: 0, w: 31, d: 31, bay: 1.55, twist: -1 },
    },
    cornerRadius: 4.5,
    podium: { x: 0, z: 6, w: 118, d: 54 },
    pool: { x: 0, z: 22, w: 25, d: 9 }, // the 25 × 9 m pool on the podium roof
  },
};

// Uses of the complex. Colours are the validated categorical slots (see styles/tokens.css,
// --z-*); every band in the stacking plan also carries a text label, so colour is never alone.
// `lit` is the share of windows lit at night in the 3D model.
export const ZONES = {
  residential: { color: '#c98500', lit: 0.42 },
  retail: { color: '#199e70', lit: 0.85 },
  office: { color: '#3987e5', lit: 0.3 },
  hotel: { color: '#d95926', lit: 0.58 },
  dining: { color: '#9085e9', lit: 0.92 },
  parking: { color: '#4a4d54', lit: 0 },
};

// Floor ranges per tower above ground. B1 is the shopping centre, B2–B4 parking.
export const TOWER_STACK = {
  stone: [
    { from: 1, to: 3, zone: 'retail' },
    { from: 4, to: 37, zone: 'residential' },
  ],
  glass: [
    { from: 1, to: 3, zone: 'retail' },
    { from: 4, to: 18, zone: 'office' },
    { from: 19, to: 35, zone: 'hotel' },
    { from: 36, to: 37, zone: 'dining' },
  ],
};

export function zoneAt(tower, floor) {
  if (floor === -1) return 'retail';
  if (floor < 1) return 'parking';
  return TOWER_STACK[tower]?.find((r) => floor >= r.from && floor <= r.to)?.zone || 'retail';
}

// Headline numbers used across pages.
export const FACTS = {
  businessCenterM2: 17000,
  businessLobbyM2: 700,
  meetingRooms: 7,
  residentialM2: 15000,
  apartments: 156,
  courtyardM2: 2500,
  hotelRooms: 218,
  poolM: [25, 9],
};
