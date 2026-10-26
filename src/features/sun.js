// Solar position for the sunlight study (after the SunCalc formulas, accurate to ~1° —
// plenty for showing how light falls across the towers through the day and the year).
const rad = Math.PI / 180;
const dayMs = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const obliquity = rad * 23.4397;

const toDays = (date) => date.valueOf() / dayMs - 0.5 + J1970 - J2000;

function sunCoords(d) {
  const M = rad * (357.5291 + 0.98560028 * d);
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + rad * 102.9372 + Math.PI;
  return {
    dec: Math.asin(Math.sin(obliquity) * Math.sin(L)),
    ra: Math.atan2(Math.sin(L) * Math.cos(obliquity), Math.cos(L)),
  };
}

// Returns { altitude, bearing } in radians. Bearing is clockwise from true north.
export function sunPosition(date, lat, lng) {
  const phi = rad * lat;
  const d = toDays(date);
  const { dec, ra } = sunCoords(d);
  const H = rad * (280.16 + 360.9856235 * d) + rad * lng - ra;
  const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azimuthFromSouth = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { altitude, bearing: (azimuthFromSouth + Math.PI) % (2 * Math.PI) };
}

// Local wall-clock time in a fixed-offset zone (Georgia is UTC+4 all year) → Date.
export function zonedDate(year, month, day, minutes, utcOffsetHours) {
  return new Date(Date.UTC(year, month, day, 0, minutes) - utcOffsetHours * 3600000);
}

// Sunrise/sunset as minutes after local midnight, found by scanning the day.
export function sunTimes(year, month, day, lat, lng, utcOffsetHours) {
  const horizon = -0.833 * rad;
  let rise = null;
  let set = null;
  let prev = sunPosition(zonedDate(year, month, day, 0, utcOffsetHours), lat, lng).altitude;
  for (let m = 5; m <= 1440; m += 5) {
    const alt = sunPosition(zonedDate(year, month, day, m, utcOffsetHours), lat, lng).altitude;
    if (prev < horizon && alt >= horizon) rise = m - 5 + (5 * (horizon - prev)) / (alt - prev);
    if (prev >= horizon && alt < horizon) set = m - 5 + (5 * (prev - horizon)) / (prev - alt);
    prev = alt;
  }
  return { rise, set };
}

export const fmtClock = (minutes) => {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
