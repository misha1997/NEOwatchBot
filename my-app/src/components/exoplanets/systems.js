// Curated exoplanet systems for the interactive orrery. Each system is a real
// star with its confirmed planets, using values from the NASA Exoplanet
// Archive / literature (rounded for display). The data is static on purpose —
// a system browser needs instant, reliable switching, and these famous
// systems don't change. Live TAP values are still used elsewhere on the page
// (counts, featured, catalog, scatter).
//
// Planet fields: id, name, a (semi-major axis, AU), r (radius, R⊕), p (period,
// days), eqt (equilibrium temp, K), habitability ("habitable"|"edge"|"hot"|
// "cold"|"unknown"), disc (discovery year), facility.
// Star fields: name, type (spectral class), teff (K), rR (Rsun), mM (Msun),
// lum (Lsun), dist (ly), color (display tint).

export const SYSTEMS = [
  {
    id: "trappist1",
    star: { name: "TRAPPIST-1", type: "M8V", teff: 2566, rR: 0.121, mM: 0.089, lum: 0.000553, dist: 39, color: "#FF8A4C" },
    planets: [
      { id: "b", a: 0.01154, r: 1.116, p: 1.510, eqt: 407, habitability: "hot", disc: 2016, facility: "TRAPPIST/Spitzer" },
      { id: "c", a: 0.01580, r: 1.097, p: 2.421, eqt: 342, habitability: "hot", disc: 2016, facility: "TRAPPIST/Spitzer" },
      { id: "d", a: 0.02227, r: 0.788, p: 4.049, eqt: 288, habitability: "edge", disc: 2016, facility: "TRAPPIST/Spitzer" },
      { id: "e", a: 0.02925, r: 0.920, p: 6.101, eqt: 251, habitability: "habitable", disc: 2017, facility: "Spitzer" },
      { id: "f", a: 0.03849, r: 1.045, p: 9.207, eqt: 219, habitability: "habitable", disc: 2017, facility: "Spitzer" },
      { id: "g", a: 0.04683, r: 1.129, p: 12.352, eqt: 199, habitability: "habitable", disc: 2017, facility: "Spitzer" },
      { id: "h", a: 0.06189, r: 0.755, p: 18.772, eqt: 173, habitability: "cold", disc: 2017, facility: "Spitzer" },
    ],
  },
  {
    id: "toi700",
    star: { name: "TOI-700", type: "M0V", teff: 3240, rR: 0.42, mM: 0.41, lum: 0.017, dist: 101, color: "#FFB25E" },
    planets: [
      { id: "b", a: 0.0644, r: 0.90, p: 9.98, eqt: 335, habitability: "hot", disc: 2020, facility: "TESS" },
      { id: "c", a: 0.0928, r: 2.65, p: 16.49, eqt: 276, habitability: "edge", disc: 2020, facility: "TESS" },
      { id: "e", a: 0.1340, r: 0.95, p: 27.81, eqt: 290, habitability: "edge", disc: 2023, facility: "TESS" },
      { id: "d", a: 0.1588, r: 1.19, p: 37.42, eqt: 269, habitability: "habitable", disc: 2020, facility: "TESS" },
    ],
  },
  {
    id: "kepler1649",
    star: { name: "Kepler-1649", type: "M4V", teff: 3240, rR: 0.23, mM: 0.197, lum: 0.0052, dist: 301, color: "#FF9C4D" },
    planets: [
      { id: "b", a: 0.0501, r: 1.02, p: 9.93, eqt: 232, habitability: "habitable", disc: 2020, facility: "Kepler" },
      { id: "c", a: 0.0827, r: 1.06, p: 19.50, eqt: 188, habitability: "habitable", disc: 2020, facility: "Kepler" },
    ],
  },
  {
    id: "proxima",
    star: { name: "Proxima Centauri", type: "M5.5Ve", teff: 3042, rR: 0.154, mM: 0.122, lum: 0.00155, dist: 4.24, color: "#FF7A3C" },
    planets: [
      { id: "d", a: 0.02895, r: 0.27, p: 5.12, eqt: 360, habitability: "hot", disc: 2022, facility: "ESPRESSO" },
      { id: "b", a: 0.04857, r: 1.07, p: 11.18, eqt: 234, habitability: "edge", disc: 2016, facility: "HARPS" },
      { id: "c", a: 1.49, r: null, p: 1928, eqt: 39, habitability: "cold", disc: null, facility: null },
    ],
  },
  {
    id: "kepler186",
    star: { name: "Kepler-186", type: "M1V", teff: 3755, rR: 0.52, mM: 0.48, lum: 0.056, dist: 564, color: "#FFC066" },
    planets: [
      { id: "b", a: 0.0343, r: 0.56, p: 3.886, eqt: 388, habitability: "hot", disc: 2014, facility: "Kepler" },
      { id: "c", a: 0.0454, r: 0.88, p: 7.267, eqt: 335, habitability: "hot", disc: 2014, facility: "Kepler" },
      { id: "d", a: 0.0638, r: 1.10, p: 12.72, eqt: 282, habitability: "edge", disc: 2014, facility: "Kepler" },
      { id: "e", a: 0.0906, r: 1.00, p: 22.40, eqt: 241, habitability: "habitable", disc: 2014, facility: "Kepler" },
      { id: "f", a: 0.432, r: 1.17, p: 129.9, eqt: 188, habitability: "habitable", disc: 2014, facility: "Kepler" },
    ],
  },
  {
    id: "k218",
    star: { name: "K2-18", type: "M2.8V", teff: 3505, rR: 0.41, mM: 0.36, lum: 0.0243, dist: 124, color: "#FF7E47" },
    planets: [
      { id: "c", a: 0.0593, r: 2.41, p: 8.96, eqt: 415, habitability: "hot", disc: 2015, facility: "K2" },
      { id: "b", a: 0.1591, r: 2.61, p: 32.94, eqt: 265, habitability: "habitable", disc: 2015, facility: "K2/Spitzer" },
    ],
  },
  {
    id: "peg51",
    star: { name: "51 Pegasi", type: "G2V", teff: 5799, rR: 1.20, mM: 1.11, lum: 1.47, dist: 50.9, color: "#FFE6A0" },
    planets: [
      { id: "b", name: "Dimidum", a: 0.0527, r: 13.5, p: 4.23, eqt: 1300, habitability: "hot", disc: 1995, facility: "ELODIE" },
    ],
  },
  {
    id: "gj1214",
    star: { name: "GJ 1214", type: "M4.5V", teff: 2940, rR: 0.216, mM: 0.176, lum: 0.00328, dist: 47.5, color: "#FF8347" },
    planets: [
      { id: "b", a: 0.0141, r: 2.85, p: 1.58, eqt: 596, habitability: "hot", disc: 2009, facility: "MEarth" },
    ],
  },
  {
    id: "solar",
    star: { name: "Sun", type: "G2V", teff: 5772, rR: 1.0, mM: 1.0, lum: 1.0, dist: 0, color: "#FFE9A8" },
    planets: [
      { id: "mercury", name: "Mercury", a: 0.387, r: 0.383, p: 88, eqt: 440, habitability: "hot", disc: null, facility: null },
      { id: "venus", name: "Venus", a: 0.723, r: 0.949, p: 225, eqt: 327, habitability: "hot", disc: null, facility: null },
      { id: "earth", name: "Earth", a: 1.0, r: 1.0, p: 365, eqt: 288, habitability: "habitable", disc: null, facility: null },
      { id: "mars", name: "Mars", a: 1.524, r: 0.532, p: 687, eqt: 210, habitability: "cold", disc: null, facility: null },
      { id: "jupiter", name: "Jupiter", a: 5.20, r: 11.21, p: 4333, eqt: 165, habitability: "cold", disc: null, facility: null },
      { id: "saturn", name: "Saturn", a: 9.54, r: 9.45, p: 10759, eqt: 134, habitability: "cold", disc: null, facility: null },
      { id: "uranus", name: "Uranus", a: 19.2, r: 4.01, p: 30687, eqt: 76, habitability: "cold", disc: null, facility: null },
      { id: "neptune", name: "Neptune", a: 30.05, r: 3.88, p: 60190, eqt: 72, habitability: "cold", disc: null, facility: null },
    ],
  },
];

// Habitable zone (AU) from stellar luminosity — the eqt≈180–310 K annulus
// (eqt = 278·(L/a²)^¼, albedo ~0). Returns [aInner, aOuter].
export function habitableZone(lum) {
  const s = Math.sqrt(lum || 0);
  return [s * 0.804, s * 2.388]; // eqt 310 K, 180 K
}

// Log-scaled orbit-radius mapper for a system: maps planet semi-major axes
// (AU) to pixel radii within [R_MIN, R_MAX], spreading close-in planets apart
// so they don't pile on the star. The same mapper is reused for the HZ ring so
// everything stays on one scale.
export function makeOrbitMapper(planets, R_MIN = 34, R_MAX = 172) {
  const as = planets.map((p) => p.a).filter((a) => a > 0);
  const lo = Math.log(Math.min(...as));
  const hi = Math.log(Math.max(...as));
  const span = hi - lo || 1;
  return (a) => {
    if (!a || a <= 0) return R_MIN;
    const t = (Math.log(a) - lo) / span;
    return R_MIN + (R_MAX - R_MIN) * Math.max(0, Math.min(1, t));
  };
}

// Angular speed (rad/s) for a planet of period p (days). True Keplerian
// (ω ∝ 1/p) makes outer planets nearly static for systems with a huge period
// spread (Neptune vs Mercury), so we clamp to a visible window: a ~10 d planet
// completes an orbit in ~6 s; nothing spins faster than ~2 s, nothing slower
// than ~45 s. Keeps the orrery lively without being dizzying.
export function angularSpeed(p) {
  const BASE = 10.5;
  return Math.max(0.14, Math.min(3.0, BASE / Math.max(p || 1, 0.5)));
}