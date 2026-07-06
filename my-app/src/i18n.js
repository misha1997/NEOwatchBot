// i18next init (synchronous, before first render so there is no language flash).
// The active language is owned by LanguageContext, which calls
// i18next.changeLanguage() on switch. Importing this module has the side effect
// of initialising i18next with the stored/detected language.
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import uk from "./i18n/uk.json";
import en from "./i18n/en.json";

const KEY = "neowatch.lang";
export const DEFAULT_LANG = "uk";
export const LANGS = ["uk", "en"];

// First-visit detection: browser language. uk/ru → Ukrainian, else English.
export function detectLang() {
  try {
    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("uk") || nav.startsWith("ru")) return "uk";
  } catch { /* navigator unavailable */ }
  return "en";
}

export function readLang() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "uk" || v === "en") return v;
  } catch { /* localStorage unavailable */ }
  return detectLang();
}

let initialised = false;
export function initI18n(initialLang) {
  if (initialised) return i18next;
  i18next.use(initReactI18next).init({
    resources: { uk: { translation: uk }, en: { translation: en } },
    lng: initialLang || readLang(),
    fallbackLng: DEFAULT_LANG,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  initialised = true;
  return i18next;
}

// Initialise eagerly at module load so the very first render uses the right lang.
initI18n(readLang());

export default i18next;