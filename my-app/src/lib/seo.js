// Client-side route → i18n name map (mirrors web/seo.py ROUTES on the server).
// The server injects per-route meta for non-JS crawlers; this map drives the
// client `useSeo` hook so SPA navigation also updates <title>/description/
// canonical/OG for the live tab and for Googlebot's JS-render pass.
//
// Keys are URL paths without a leading slash ("" === home).
export const ROUTES = {
  "": "home",
  iss: "iss",
  satellites: "satellites",
  weather: "weather",
  sky: "sky",
  constellations: "constellations",
  mast: "mast",
  meteors: "meteors",
  asteroids: "asteroids",
  events: "events",
  launches: "launches",
  deep: "deep",
  voyager: "voyager",
  comets: "comets",
  exoplanets: "exoplanets",
  // /rtl-sdr and /community are kept on disk but unlinked — omitted so
  // nameForPath() falls back to "404" for them. Re-add to restore.
};

// Absolute site origin for canonical/og:url. Must match web/seo.py SITE_URL.
export const SITE_URL = "https://orbitlight.space";

export function nameForPath(pathname) {
  const p = pathname === "/" ? "" : pathname.replace(/^\/+/, "").replace(/\/+$/, "");
  return ROUTES[p] || "404";
}