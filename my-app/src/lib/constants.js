// Shared constants: nav links, status-label maps, satellite-group color map,
// and the status texts ported from app.js / space-weather.js. Status labels go
// through i18next so they follow the active UI language.
import i18next from "../i18n";

// Header nav: a flat list of top-level entries. Each entry is either a
// single link ({to,label,end}) or a dropdown group ({label, items:[…]}).
// Grouped thematically so all 14 pages fit compactly behind 4 dropdowns.
export const NAV_GROUPS = [
  { to: "/", labelKey: "nav.home", end: true },
  { labelKey: "nav.sky_group", items: [
    { to: "/sky", labelKey: "nav.sky" },
    { to: "/constellations", labelKey: "nav.constellations" },
    { to: "/meteors", labelKey: "nav.meteors" },
    { to: "/events", labelKey: "nav.events" },
  ]},
  { labelKey: "nav.orbit_group", items: [
    { to: "/iss", labelKey: "nav.iss" },
    { to: "/satellites", labelKey: "nav.satellites" },
    { to: "/launches", labelKey: "nav.launches" },
  ]},
  { labelKey: "nav.bodies_group", items: [
    { to: "/asteroids", labelKey: "nav.asteroids" },
    { to: "/comets", labelKey: "nav.comets" },
    { to: "/exoplanets", labelKey: "nav.exoplanets" },
    { to: "/mast", labelKey: "nav.mast" },
    { to: "/deep", labelKey: "nav.deep" },
    { to: "/voyager", labelKey: "nav.voyager" },
    { to: "/gallery", labelKey: "nav.gallery" },
  ]},
  // { labelKey: "nav.sunradio_group", items: [
  //   { to: "/weather", labelKey: "nav.weather" },
  //   { to: "/rtl-sdr", labelKey: "nav.rtl" },
  // ]},
  { to: "/weather", labelKey: "nav.weather" },
  // { to: "/community", labelKey: "nav.community" },
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