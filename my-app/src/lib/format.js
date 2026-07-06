// Formatting helpers ported from site/assets/app.js (fmtNum, pad2,
// formatLaunchDt, fmt, fmtLatLon, genitiveConst, trendLabel, compass bits).
// Language-aware: translatable outputs go through i18next so they follow the
// active language (see context/LanguageContext.js).
import i18next from "../i18n";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function fmtNum(n, digits) {
  if (n === null || n === undefined || n === "") return "—";
  return Number(n).toFixed(digits == null ? 0 : digits);
}

export function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

// Launch net timestamp (seconds) → "5 лип · 22:14" (matches formatLaunchDt).
export function formatLaunchDt(ts) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  return d.getDate() + " " + i18next.t("common.months." + MONTH_KEYS[d.getMonth()]) + " · " + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

// Large integer → "1 234" (grouped; locale follows the active language).
export function fmtInt(n) {
  if (n === null || n === undefined) return "—";
  const locale = i18next.language === "en" ? "en-US" : "uk-UA";
  return Number(n).toLocaleString(locale);
}

// Lat/lon → "50.45°Пн · 30.52°Сх" (sat-map / iss-now).
export function fmtLatLon(lat, lon) {
  const c = i18next.t.bind(i18next);
  return (
    Math.abs(lat).toFixed(2) + "°" + (lat >= 0 ? c("common.compass.N") : c("common.compass.S")) + " · " +
    Math.abs(lon).toFixed(2) + "°" + (lon >= 0 ? c("common.compass.E") : c("common.compass.W"))
  );
}

// Kp value → dashboard gauge color (G-scale inspired). space-weather.js.
export function kpColor(kp) {
  return kp >= 7 ? "#FF6B4A" : kp >= 6 ? "#FFA94D" : kp >= 5 ? "#E8B94D" : "#4FD1C5";
}

// Genitive case for the few constellations shown on comets.html; fall back to
// the nominative form so the line still reads sensibly. Ukrainian-only grammar —
// in English the nominative name is returned unchanged. (app.js genitiveConst)
const GENITIVE = {
  "Візничий": "Візника", "Стрілець": "Стрільця", "Кассіопея": "Кассіопеї",
  "Терези": "Терезів", "Лев": "Лева", "Діва": "Діви", "Близнята": "Близнят",
  "Оріон": "Оріона", "Велика Ведмедиця": "Великої Ведмедиці",
  "Мала Ведмедиця": "Малої Ведмедиці",
};
export function genitiveConst(name) {
  if (!name) return "—";
  if (i18next.language !== "uk") return name;
  return GENITIVE[name] || name;
}

export function trendLabel(t) {
  if (t === "brightening") return i18next.t("common.trend.up");
  if (t === "fading") return i18next.t("common.trend.down");
  return i18next.t("common.trend.stable");
}

// "за N дн." / "сьогодні" helpers used by events.html, meteors.html.
export function daysUntilTxt(n) {
  if (n === 0) return i18next.t("common.days.today");
  return i18next.t("common.days.in_n", { n });
}
export function daysTxt(n) {
  if (n === 0) return i18next.t("common.days.peakToday");
  if (n === 1) return i18next.t("common.days.peakTomorrow");
  return i18next.t("common.days.peakIn", { n });
}

// fmtTime / fmtDay for the space-weather charts (epoch ms → "HH:MM" / "DD.MM HH:MM").
export function fmtTime(ms, withDate) {
  const d = new Date(ms);
  const hm = pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  if (!withDate) return hm;
  return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + " " + hm;
}
export function fmtDay(ms) {
  const d = new Date(ms);
  return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1);
}