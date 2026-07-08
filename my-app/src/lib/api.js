// Thin fetch wrappers for the /api/* endpoints. Mirrors the data hooks in the
// legacy site/assets/app.js — each function returns parsed JSON or null on
// error (callers treat null as "keep placeholder / show nothing").
const API = "/api";

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

// Build "?lat&lon" from a location object (or empty when unset → Kyiv default
// is applied server-side).
export function locParams(loc) {
  if (!loc) return "";
  const p = new URLSearchParams();
  p.set("lat", loc.lat);
  p.set("lon", loc.lon);
  return "?" + p.toString();
}

// Combine a base query string (e.g. "?lat=..&lon=..") with the optional language
// override. Endpoints that don't declare `lang` simply ignore the extra param.
function withLang(base, lang) {
  if (!lang) return base || "";
  const sep = base && base.includes("?") ? "&" : "?";
  return (base || "") + sep + "lang=" + lang;
}

// Language-neutral endpoints (key-based / numeric data; the frontend localizes
// status text itself via i18next).
export const getWeather = (loc) => fetchJSON(API + "/weather" + locParams(loc));
export const getWeatherSeries = () => fetchJSON(API + "/weather/series");
export const getLaunches = () => fetchJSON(API + "/launches");
export const getIssCrew = (lang) => fetchJSON(API + "/iss/crew" + withLang("", lang));
export const getMars = () => fetchJSON(API + "/mars");
export const getApod = (lang) => fetchJSON(API + "/apod" + withLang("", lang));
export const getDebris = () => fetchJSON(API + "/debris");
export const getGrb = (limit = 12) => fetchJSON(API + "/grb?limit=" + limit);
export const getVoyager = () => fetchJSON(API + "/voyager");
export const getGeocode = (q) => fetchJSON(API + "/geocode?q=" + encodeURIComponent(q));
export const getReverseGeocode = (lat, lon) =>
  fetchJSON(API + "/geocode/reverse?lat=" + lat + "&lon=" + lon);
export const getIpGeo = () => fetchJSON(API + "/geo/ip");

// Localized endpoints — the backend returns text in `lang` (uk by default).
export const getIssPasses = (loc, lang) =>
  fetchJSON(API + "/iss/passes" + withLang(locParams(loc), lang));
export const getIssNow = (lang) => fetchJSON(API + "/iss/now" + withLang("", lang));
export const getSky = (loc, lang) =>
  fetchJSON(API + "/sky" + withLang(locParams(loc), lang));
export const getPlanets = (loc, lang) =>
  fetchJSON(API + "/planets" + withLang(locParams(loc), lang));
export const getMoon = (lang) => fetchJSON(API + "/moon" + withLang("", lang));
export const getNeo = (lang) => fetchJSON(API + "/neo" + withLang("", lang));
export const getMeteors = (lang) => fetchJSON(API + "/meteors" + withLang("", lang));
export const getEvents = (lang) => fetchJSON(API + "/events" + withLang("", lang));
export const getComets = (lang) => fetchJSON(API + "/comets" + withLang("", lang));
// Language-neutral (numeric) NASA Exoplanet Archive data.
export const getExoplanets = () => fetchJSON(API + "/exoplanets");
export const getTle = (group, limit = 300, lang) =>
  fetchJSON(API + "/tle?group=" + group + "&limit=" + limit + (lang ? "&lang=" + lang : ""));
export const getTleGroups = (lang) => fetchJSON(API + "/tle/groups" + withLang("", lang));

// Feedback form (footer modal). Returns {ok:true} on success; on failure
// throws with .status so the modal can map 503 → "service unavailable" etc.
export async function sendFeedback({ name, email, message }) {
  const r = await fetch(API + "/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, message }),
  });
  let data = null;
  try { data = await r.json(); } catch (_) { /* empty body */ }
  if (!r.ok) {
    const err = new Error("feedback " + r.status);
    err.status = r.status;
    err.error = data && data.error;
    throw err;
  }
  return data || { ok: true };
}

// Pass fetchJSON through for ad-hoc use.
export { fetchJSON };