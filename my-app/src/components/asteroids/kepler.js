// Pure helpers for the heliocentric asteroid-orbit map. Converts NASA NEO
// lookup orbital elements (a, e, Ω, ω, M) into an SVG ellipse + the body's
// current position. No React, no deps.
//
// Convention: the Sun sits at one focus of the ellipse. In the orbital plane
// (perihelion along +x, focus at origin) the body is at (r·cosν, r·sinν) with
// true anomaly ν; we then rotate by the longitude of perihelion ϖ = Ω + ω to
// orient the whole thing on the sky (top-down ecliptic projection; inclination
// is ignored — fine for a schematic, NEOs span the ecliptic anyway).
//
// Split into two pieces so the map can draw each ellipse once and only move
// the position dot per frame: ellipseGeometry() (static) + dotPosition()
// (advances the mean anomaly by the body's real mean motion n = 2π/T).

// viewBox 520×520, Sun centred; 1 AU = 80 px (so 2.5 AU reaches 200 px).
export const VB = 520;
export const SUN_X = 260;
export const SUN_Y = 260;
export const AU_TO_PX = 80;

const DEG = Math.PI / 180;

// Solve Kepler's equation M = E − e·sinE for the eccentric anomaly E
// (Newton–Raphson). M and E in radians. Converges fast for NEOs (e < ~0.9).
export function solveKepler(M, e) {
  let E = M + e * Math.sin(M); // decent first guess
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

// True anomaly ν (rad) from eccentric anomaly E and eccentricity e.
export function trueAnomaly(E, e) {
  return 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2),
  );
}

// Mean motion n (rad/day) from orbital period (days). Falls back to Kepler's
// 3rd law from the semi-major axis (n = 2π / a^1.5, a in AU → period in years)
// when the feed doesn't supply a period.
export function meanMotion(el) {
  const T = +el.period;
  if (isFinite(T) && T > 0) return (2 * Math.PI) / T;
  const a = +el.a;
  if (isFinite(a) && a > 0) return (2 * Math.PI) / (a * Math.sqrt(a) * 365.25);
  return 0;
}

// Static ellipse geometry from orbital elements. `el` = { a, e, w, om }
// (a in AU, angles in degrees). Returns the ellipse centre, radii and rotation
// in viewBox coords. Sun at one focus; centre displaced by c = a·e away from
// perihelion.
export function ellipseGeometry(el, scale = AU_TO_PX) {
  const a = +el.a;
  const e = +el.e;
  if (!isFinite(a) || a <= 0 || !isFinite(e) || e < 0 || e >= 1) return null;

  const w = (+el.w || 0) * DEG;
  const om = (+el.om || 0) * DEG;
  const peri = om + w; // longitude of perihelion ϖ (rad)

  const c = a * e;
  const rx = a * scale;
  const ry = a * Math.sqrt(1 - e * e) * scale;
  const cx = SUN_X - c * scale * Math.cos(peri);
  const cy = SUN_Y - c * scale * Math.sin(peri);

  return { cx, cy, rx, ry, rotDeg: peri / DEG, a, e, peri };
}

// Current position of the body on its ellipse, given a mean anomaly M (rad).
// `el` needs a, e, w, om (angles in degrees). Returns viewBox coords.
export function dotPosition(el, M, scale = AU_TO_PX) {
  const a = +el.a;
  const e = +el.e;
  if (!isFinite(a) || a <= 0 || !isFinite(e) || e < 0 || e >= 1) return null;

  const w = (+el.w || 0) * DEG;
  const om = (+el.om || 0) * DEG;
  const peri = om + w;

  const E = solveKepler(M, e);
  const nu = trueAnomaly(E, e);
  const r = a * (1 - e * Math.cos(E)); // AU
  const px = r * Math.cos(nu);
  const py = r * Math.sin(nu);
  const dotX = SUN_X + (px * Math.cos(peri) - py * Math.sin(peri)) * scale;
  const dotY = SUN_Y + (px * Math.sin(peri) + py * Math.cos(peri)) * scale;
  return { dotX, dotY };
}

// One-shot geometry (ellipse + position at the epoch's mean anomaly) — kept for
// any caller that wants the full static picture in one call.
export function orbitGeometry(el, scale = AU_TO_PX) {
  const g = ellipseGeometry(el, scale);
  if (!g) return null;
  const ma = (+el.ma || 0) * DEG;
  const d = dotPosition(el, ma, scale);
  if (!d) return null;
  return { ...g, dotX: d.dotX, dotY: d.dotY };
}

// Approximate heliocentric position of a major planet, for drawing Earth/Mars
// as real bodies on the reference orbits. Uses the circular mean-longitude
// formula L = L0 + n·(JD − 2451545) (good to a degree or two — fine for a
// schematic dot; the asteroids themselves use full Kepler). `a_au` = semi-major
// axis in AU, L0/n in degrees (n = deg/day). Returns viewBox coords.
export function planetPosition(a_au, L0_deg, n_deg, jd, scale = AU_TO_PX) {
  const d = jd - 2451545.0;
  const L = ((L0_deg + n_deg * d) % 360 + 360) % 360 * DEG;
  return {
    x: SUN_X + a_au * scale * Math.cos(L),
    y: SUN_Y + a_au * scale * Math.sin(L),
  };
}

// J2000 mean longitudes + mean motions (deg/day) for the two reference planets.
export const EARTH = { a: 1.0, L0: 100.46, n: 0.9856474 };
export const MARS = { a: 1.524, L0: 355.43, n: 0.524020 };