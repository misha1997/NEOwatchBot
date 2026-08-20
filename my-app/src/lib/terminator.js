// Day/night terminator — subsolar point + night-hemisphere polygon, computed
// entirely client-side (no backend call, recomputes live every tick) from
// the standard public solar-position formulas (mean anomaly, equation of
// center, obliquity of the ecliptic — the same public-domain astronomy
// behind SunCalc-style libraries; reimplemented here, not pulled in as a
// dependency).

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;

function toDays(date) {
  return date.getTime() / DAY_MS - 0.5 + J1970 - J2000;
}

// { lat, lon } of the point on Earth where the Sun is directly overhead.
export function getSubsolarPoint(date = new Date()) {
  const d = toDays(date);
  const M = RAD * (357.5291 + 0.98560028 * d); // solar mean anomaly
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = RAD * 102.9372; // argument of perihelion
  const L = M + C + P + Math.PI; // ecliptic longitude
  const E = RAD * 23.4397; // obliquity of the ecliptic
  const dec = Math.asin(Math.sin(E) * Math.sin(L));
  const ra = Math.atan2(Math.sin(L) * Math.cos(E), Math.cos(L));

  const gmstDeg = (280.16 + 360.9856235 * d) % 360;
  const gmst = RAD * gmstDeg;
  const hourAngle = gmst - ra; // at longitude 0

  let lon = -(hourAngle / RAD);
  lon = (((lon + 180) % 360) + 360) % 360 - 180; // normalize to [-180, 180]

  return { lat: dec / RAD, lon };
}

// Closed [lat, lon] ring covering the night hemisphere, for L.polygon.
// At each longitude, the terminator latitude is where solar altitude = 0:
//   sin(lat)*sin(dec) + cos(lat)*cos(dec)*cos(lon-lon0) = 0
//   => tan(lat) = -cos(lon-lon0) / tan(dec)
// then the ring is closed by running along the currently-dark pole's
// latitude across the full longitude range.
export function getNightPolygon(date = new Date(), step = 2) {
  const { lat: subLat, lon: subLon } = getSubsolarPoint(date);
  const decRad = subLat * RAD;
  const lon0Rad = subLon * RAD;
  // tan(dec) -> 0 right at the equinoxes; nudge away from the singularity
  // rather than divide by exactly zero.
  const tanDec = Math.abs(decRad) < 1e-6 ? 1e-6 : Math.tan(decRad);

  const points = [];
  for (let lon = -180; lon <= 180; lon += step) {
    const lonRad = lon * RAD;
    const termLatRad = Math.atan(-Math.cos(lonRad - lon0Rad) / tanDec);
    points.push([termLatRad / RAD, lon]);
  }
  const nightPoleLat = subLat >= 0 ? -89.9 : 89.9;
  points.push([nightPoleLat, 180]);
  points.push([nightPoleLat, -180]);
  return points;
}
