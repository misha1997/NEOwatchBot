// Active UI language, persisted in localStorage['neowatch.lang']. Mirrors
// LocationContext: a single source of truth that drives i18next. setLang() also
// dispatches a `neowatch:lang` window event so imperative modules (SatMap popup
// formatters, SkyDome cardinals) can react, and keeps other tabs in sync via the
// `storage` event.
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import i18next, { DEFAULT_LANG, readLang } from "../i18n";

const KEY = "neowatch.lang";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => readLang());

  const apply = useCallback((next) => {
    document.documentElement.lang = next;
    i18next.changeLanguage(next);
    window.dispatchEvent(new CustomEvent("neowatch:lang", { detail: next }));
  }, []);

  const setLang = useCallback((next) => {
    if (next !== "uk" && next !== "en") return;
    localStorage.setItem(KEY, next);
    setLangState(next);
    apply(next);
  }, [apply]);

  // On mount, sync i18next + <html lang> to the resolved language.
  useEffect(() => {
    apply(lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cross-tab sync: another tab changed the language.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) {
        const next = readLang();
        setLangState(next);
        apply(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [apply]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext) || { lang: DEFAULT_LANG, setLang: () => {} };
}

export function currentLang() {
  return i18next.language || DEFAULT_LANG;
}