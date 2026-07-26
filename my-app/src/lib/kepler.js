// Keplerian-orbit helpers shared by the Jupiter mini-map (Jupiter.js) and the
// fullscreen PixiJS viewer (JupiterMoonSystemFullscreen.js).
//
// The JPL mean-elements feed used by services/jupiter.py gives each moon's
// semi-major axis a, eccentricity e, mean anomaly M0, inclination i and period
// P — but NOT the argument of perihelion ω (which orients the ellipse in the
// orbital plane). So:
//   - the eccentricity and the Kepler speed variation (fast at perihelion, slow
//     at aphelion — 2nd law) are REAL;
//   - the perihelion direction is a deterministic pseudo-orientation derived
//     from the moon's name (stable across renders/sessions);
//   - nearly-circular moons (e < 0.001) get ω = 0 and skip the Newton solve, so
//     they keep the same phase as the old uniform circular model and cost no
//     more than a pair of cos/sin per frame.
// Inclination is still ignored (orbits drawn face-on in a single plane).

// FNV-1a hash of a name → a stable angle in [0, 2π). Used as a synthetic
// argument of perihelion for eccentric moons.
export function perihelionArg(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ((h % 360000) / 360000) * Math.PI * 2;
}

// Reusable output buffer for the hot per-frame loops. Safe because each caller
// reads [0]/[1] immediately before the next call (single-threaded JS).
const _out = [0, 0];

// Fast in-place Kepler position, designed for the per-frame rAF/ticker loops
// where allocation matters. Reads the semi-major axis from `m.r` (world units)
// and the orbital elements (m0_deg, period_d, e, omega, sgn) directly off the
// moon object — no wrapper object, no result array allocated when `out` is
// reused. Jupiter sits at the focus (cx, cy); y is flipped (screen up = -y).
// `sgn` = +1 prograde / -1 retrograde. e < 0.001 ⇒ uniform circle (true anomaly
// = mean anomaly, no Newton solve). Newton has an early exit once |f| < 1e-5.
export function keplerXY(m, totalDays, cx, cy, out) {
  const o = out || _out;
  const e = m.e || 0;
  const circular = e < 0.001;
  const n = (Math.PI * 2) / m.period_d; // mean motion, rad/day
  let M = (m.m0_deg * Math.PI) / 180 + n * totalDays; // mean anomaly
  // wrap M to [0, 2π) without a (possibly negative) modulo branch
  M -= Math.floor(M / (Math.PI * 2)) * (Math.PI * 2);

  let E = M;
  let sinE = Math.sin(E);
  let cosE = Math.cos(E);
  if (!circular) {
    // Newton: E <- E - (E - e·sinE - M) / (1 - e·cosE). Early exit on convergence.
    for (let i = 0; i < 6; i++) {
      const f = E - e * sinE - M;
      if (Math.abs(f) < 1e-5) break;
      E -= f / (1 - e * cosE);
      sinE = Math.sin(E);
      cosE = Math.cos(E);
    }
  }

  const denom = 1 - e * cosE;
  const r = m.r * (1 - e * cosE); // distance from the focus
  // true anomaly ν. For e ≈ 0, ν = M (uniform motion).
  const nu = circular
    ? M
    : Math.atan2((Math.sqrt(1 - e * e) * sinE) / denom, (cosE - e) / denom);
  const ang = m.sgn * (nu + (m.omega || 0));
  o[0] = cx + r * Math.cos(ang);
  o[1] = cy - r * Math.sin(ang);
  return o;
}

// Geometry of the orbit ellipse itself (for drawing the ring), with the planet
// at the focus (cx, cy). Returns the ellipse centre, the semi-axes (in the same
// world units as R) and the screen rotation angle (radians) that aligns the
// major axis with the perihelion direction. For e = 0 this is a circle of
// radius R centred at (cx, cy) with no rotation.
export function orbitEllipse(elem, cx, cy) {
  const e = elem.e || 0;
  const R = elem.R;
  const B = R * Math.sqrt(Math.max(0, 1 - e * e)); // semi-minor axis
  const c = R * e; // focus-to-centre distance
  const w = elem.omega || 0;
  // Centre lies toward aphelion (math direction ω+π) from the focus. Screen y
  // is flipped, so centre_y = cy + c·sin(ω).
  const ecx = cx - c * Math.cos(w);
  const ecy = cy + c * Math.sin(w);
  return { ecx, ecy, rx: R, ry: B, rot: -w }; // screen rotation = -ω (y-down)
}