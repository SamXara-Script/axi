// DEMO INVENTORY — generated, not live data. The shapes, sizes and price levels follow public
// listings on axistowers.ge (e.g. a 114.5 m² three-bedroom on floor 12 at ~5,935 ₾/m², a 42.5 m²
// unit on floor 25, a 78.4 m² two-bedroom on floor 31; offices around 102 ₾/m² a month), but every
// unit, price and status below is illustrative. Replace `UNITS` with the sales system's feed.
//
// Prices are in GEL (lari). Apartments are for sale; offices are to let (rent per month).

function rng(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

// Apartment types per stack position on a typical floor of the Stone Tower.
const APARTMENT_TYPES = {
  A: { rooms: 3, area: 114.5, living: 29.1, baths: 2, faces: 'SE', plan: 'bed3', corner: true },
  B: { rooms: 2, area: 78.4, living: 24.6, baths: 1, faces: 'SW', plan: 'bed2' },
  C: { rooms: 1, area: 58.2, living: 21.4, baths: 1, faces: 'NW', plan: 'bed1' },
  D: { rooms: 0, area: 42.5, living: 26.8, baths: 1, faces: 'N', plan: 'studio' },
  E: { rooms: 2, area: 86.3, living: 26.2, baths: 2, faces: 'NE', plan: 'bed2', corner: true },
};
const PENTHOUSE_TYPES = {
  P1: { rooms: 4, area: 212.6, living: 58.4, baths: 3, faces: 'S', plan: 'penthouse', corner: true },
  P2: { rooms: 3, area: 168.9, living: 44.7, baths: 2, faces: 'N', plan: 'bed3', corner: true },
};

function apartments() {
  const rand = rng(1717);
  const list = [];
  for (let floor = 4; floor <= 37; floor++) {
    const types = floor >= 35 ? PENTHOUSE_TYPES : APARTMENT_TYPES;
    for (const [letter, t] of Object.entries(types)) {
      const perM2 = Math.round((5600 + (floor - 4) * 42) * (t.corner ? 1.04 : 1) * (t.rooms === 4 ? 1.12 : 1) / 10) * 10;
      const r = rand();
      const status = r < 0.7 ? 'sold' : r < 0.82 ? 'reserved' : 'available';
      list.push({
        id: `${floor}${letter}`,
        kind: 'apartment',
        tower: 'stone',
        floor,
        letter,
        rooms: t.rooms,
        area: t.area,
        living: t.living,
        baths: t.baths,
        faces: t.faces,
        plan: t.plan,
        perM2,
        price: Math.round((perM2 * t.area) / 100) * 100,
        status,
      });
    }
  }
  return list;
}

function offices() {
  const rand = rng(4049);
  const list = [];
  const sizes = [
    [148.2, 96.4, 61.8, 210.5],
    [114.5, 182.7, 74.3],
    [305.0, 128.6],
    [88.9, 142.1, 57.4, 176.2],
  ];
  let count = 0;
  for (let floor = 4; floor <= 18 && count < 49; floor++) {
    const row = sizes[floor % sizes.length];
    row.forEach((area, i) => {
      if (count >= 49) return;
      count++;
      const perM2 = Math.round(96 + (floor - 4) * 1.4 + (area < 80 ? 6 : 0));
      list.push({
        id: `O-${floor}${String.fromCharCode(65 + i)}`,
        kind: 'office',
        tower: 'glass',
        floor,
        letter: String.fromCharCode(65 + i),
        area,
        faces: ['N', 'E', 'S', 'W'][(floor + i) % 4],
        plan: 'office',
        perM2,
        rent: Math.round(perM2 * area),
        status: rand() < 0.88 ? 'available' : 'leased',
      });
    });
  }
  return list;
}

export const UNITS = [...apartments(), ...offices()];
export const IS_DEMO = true;
