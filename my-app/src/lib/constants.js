// Shared constants: nav links, status-label maps, satellite-group color map,
// and the status texts ported from app.js / space-weather.js. Status labels go
// through i18next so they follow the active UI language.
import i18next from "../i18n";

// Header nav: a flat list of top-level entries. Each entry is either a
// single link ({name,label,end}) or a dropdown group ({label, items:[…]}).
// `name` is the i18n route name (key into lib/seo.js SLUGS); the actual URL is
// built per-language via pathFor(name, lang) in Header, so the same nav data
// serves both /ua/ and /en/. Grouped thematically so all pages fit compactly
// behind 4 dropdowns. `disabled` entries are display-only (no route yet).
export const NAV_GROUPS = [
  { name: "home", labelKey: "nav.home", end: true },
  { labelKey: "nav.sky_group", items: [
    { name: "sky", labelKey: "nav.sky" },
    { name: "constellations", labelKey: "nav.constellations" },
    { name: "meteors", labelKey: "nav.meteors" },
    { name: "events", labelKey: "nav.events" },
  ]},
  { labelKey: "nav.orbit_group", items: [
    { name: "iss", labelKey: "nav.iss" },
    { name: "satellites", labelKey: "nav.satellites" },
    { name: "launches", labelKey: "nav.launches" },
    { name: "news", labelKey: "nav.news" },
  ]},
  { labelKey: "nav.planetarium", items: [
    { name: "planetarium", labelKey: "nav.planetariumHub", end: true },
    { name: "mars", labelKey: "nav.mars" },
    { name: "mercury", labelKey: "nav.mercury" },
    { name: "venus", labelKey: "nav.venus", disabled: true },
    { name: "earth", labelKey: "nav.earth", disabled: true },
    { name: "jupiter", labelKey: "nav.jupiter" },
    { name: "saturn", labelKey: "nav.saturn", disabled: true },
    { name: "uranus", labelKey: "nav.uranus", disabled: true },
    { name: "neptune", labelKey: "nav.neptune", disabled: true },
  ]},
  { labelKey: "nav.bodies_group", items: [
    { name: "asteroids", labelKey: "nav.asteroids" },
    { name: "comets", labelKey: "nav.comets" },
    { name: "exoplanets", labelKey: "nav.exoplanets" },
    { name: "mast", labelKey: "nav.mast" },
    { name: "deep", labelKey: "nav.deep" },
    { name: "voyager", labelKey: "nav.voyager" },
    { name: "gallery", labelKey: "nav.gallery" },
  ]},
  // { labelKey: "nav.sunradio_group", items: [
  //   { name: "weather", labelKey: "nav.weather" },
  //   { name: "rtl", labelKey: "nav.rtl" },
  // ]},
  { name: "weather", labelKey: "nav.weather" },
  // { name: "community", labelKey: "nav.community" },
];

export const BOT_URL = "https://t.me/NEOwatchBot";

// Launch Library 2 status id → (label, pillClass). Mirrors web/data.py _LAUNCH_STATUS.
export const LAUNCH_STATUS_BY_CLASS = {
  gold: "Go", teal: "Success", coral: "Failure",
};
export function launchPillClass(l) {
  return l.status_class ? "pill " + l.status_class : "pill";
}

// Space-weather status texts (space-weather.js). Keys match the backend's
// xray_status_key / aurora.status_key; labels resolve via i18next.
export const xrayStatus = (key) =>
  key ? i18next.t("weather.xray." + key, { defaultValue: "—" }) : "—";

export const auroraStatus = (key) =>
  key ? i18next.t("weather.aurora." + key, { defaultValue: "—" }) : "—";

// Homepage weather card footers (app.js fillWeather).
export const solarWindFoot = (s) =>
  i18next.t(s < 400 ? "weather.windFoot.calm"
    : s < 500 ? "weather.windFoot.moderate"
    : "weather.windFoot.fast");

export const bzFoot = (bz) =>
  i18next.t(bz > -5 ? "weather.bzFoot.calm"
    : bz > -10 ? "weather.bzFoot.south"
    : "weather.bzFoot.open");

// Back-compat aliases (legacy object form) for any caller still indexing by key.
export const XRAY_STATUS = new Proxy({}, { get: (_, k) => xrayStatus(k) });
export const AURORA_STATUS = new Proxy({}, { get: (_, k) => auroraStatus(k) });
export const SOLAR_WIND_FOOT = solarWindFoot;
export const BZ_FOOT = bzFoot;

// Planet dot colours for the sky-dome (dome.js COLORS).
export const PLANET_COLORS = {
  mercury: "var(--gold)", venus: "var(--gold)", mars: "var(--coral)",
  jupiter: "var(--teal)", saturn: "var(--gold)",
  uranus: "var(--text-dim)", neptune: "var(--text-dim)",
};

// X-ray class → display color (space-weather.js fillCurrent).
export function xrayColor(cls) {
  return cls === "X" ? "#FF6B4A" : cls === "M" ? "#FFA94D"
    : cls === "C" ? "#E8B94D" : "#4FD1C5";
}