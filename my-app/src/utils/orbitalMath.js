// Orbital math utilities for calculating planet positions

const DEG_TO_RAD = Math.PI / 180;

/**
 * Solve Kepler's equation M = E - e * sin(E) for E (Eccentric anomaly)
 */
export function solveKepler(M, e) {
  let E = M;
  const tolerance = 1e-6;
  const maxIter = 30;
  for (let i = 0; i < maxIter; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tolerance) break;
  }
  return E;
}

/**
 * Calculate the heliocentric coordinates of a body
 * @param {Object} orbit - Orbital elements {a, e, i, N, w, M0, n} (angles in degrees)
 * @param {number} daysSinceJ2000 - Days since J2000 epoch
 * @returns {Object} {x, y, z} in AU
 */
export function calculatePosition(orbit, daysSinceJ2000) {
  if (orbit.a === 0) return { x: 0, y: 0, z: 0 }; // Sun

  // Mean anomaly at time t
  let M = (orbit.M0 + orbit.n * daysSinceJ2000) % 360;
  if (M < 0) M += 360;
  M = M * DEG_TO_RAD;

  const e = orbit.e;
  const a = orbit.a;
  
  // Eccentric anomaly
  const E = solveKepler(M, e);

  // Heliocentric coordinates in the orbital plane
  const x_prime = a * (Math.cos(E) - e);
  const y_prime = a * Math.sqrt(1 - e * e) * Math.sin(E);

  // Convert angular elements to radians
  const N = orbit.N * DEG_TO_RAD; // Longitude of ascending node
  const w = orbit.w * DEG_TO_RAD; // Argument of periapsis
  const i = orbit.i * DEG_TO_RAD; // Inclination

  // Rotation to ecliptic coordinates
  const cosw = Math.cos(w);
  const sinw = Math.sin(w);
  const cosN = Math.cos(N);
  const sinN = Math.sin(N);
  const cosi = Math.cos(i);
  const sini = Math.sin(i);

  // Important: Three.js uses Y-up, so we map Z (ecliptic) to Y (Three.js up)
  const x = (cosN * cosw - sinN * sinw * cosi) * x_prime + (-cosN * sinw - sinN * cosw * cosi) * y_prime;
  const z_ecl = (sinN * cosw + cosN * sinw * cosi) * x_prime + (-sinN * sinw + cosN * cosw * cosi) * y_prime; // Normally y in math
  const y_ecl = (sinw * sini) * x_prime + (cosw * sini) * y_prime; // Normally z in math

  // We return mapped to Three.js coordinates (X, Y, Z) where Y is up
  return { x: x, y: y_ecl, z: -z_ecl }; // Negate Z because right-handed vs left-handed
}

/**
 * Calculates days since J2000 epoch
 * @param {Date} date
 */
export function getDaysSinceJ2000(date) {
  const J2000 = new Date(Date.UTC(2000, 0, 1, 12, 0, 0));
  return (date.getTime() - J2000.getTime()) / (1000 * 60 * 60 * 24);
}

export function scaleDistance(distanceAu, isRealistic) {
  if (isRealistic) return distanceAu * 100; // 1 AU = 100 units
  
  if (distanceAu === 0) return 0;
  // Linear scale for true proportions (instead of power 0.6)
  return distanceAu * 60; 
}

export function scaleMoonDistance(distanceAu, isRealistic, parentRadiusVisual) {
  if (isRealistic) return distanceAu * 100;
  
  if (distanceAu === 0) return 0;
  // Scale moon distance relative to the parent's visual radius
  const visualDist = (distanceAu * 1500) + (parentRadiusVisual * 1.5);
  return visualDist;
}

export function scaleRadius(radiusKm, isRealistic, isStar = false) {
  if (isRealistic) {
    return Math.max((radiusKm / 149597870) * 100, 0.05); 
  }
  
  const earthRadius = 6371.0;
  const normalized = radiusKm / earthRadius;
  
  if (isStar) {
    return Math.pow(normalized, 0.4) * 3; // Sun is larger but proportional
  }
  
  return Math.pow(normalized, 0.6) * 1.2; // Planets scale slightly more realistically
}
