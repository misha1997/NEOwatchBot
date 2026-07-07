// Observer location, persisted in localStorage['neowatch.loc'] and shared across
// every page (mirrors the bot's Nominatim geocoding). saveLoc/clearLoc dispatch a
// `neowatch:loc` window event so imperative modules (SkyDome, SatMap) refetch.
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const KEY = "neowatch.loc";
export const DEFAULT_LOC = { lat: 50.45, lon: 30.52, label: "Київ, Україна" };

const LocationContext = createContext(null);

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function LocationProvider({ children }) {
  const [loc, setLoc] = useState(() => read());

  const saveLoc = useCallback((lat, lon, label) => {
    const v = { lat, lon, label };
    localStorage.setItem(KEY, JSON.stringify(v));
    setLoc(v);
    window.dispatchEvent(new CustomEvent("neowatch:loc"));
  }, []);

  const clearLoc = useCallback(() => {
    localStorage.removeItem(KEY);
    setLoc(null);
    window.dispatchEvent(new CustomEvent("neowatch:loc"));
  }, []);

  // Keep context in sync if another tab changes the location.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setLoc(read()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <LocationContext.Provider value={{ loc, saveLoc, clearLoc }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLoc() {
  return useContext(LocationContext);
}

// The label to show in loc-pills, falling back to the Kyiv default.
export function locLabel(loc) {
  return (loc && loc.label) || DEFAULT_LOC.label;
}

// The short city name (the part before the first comma in the label), or null
// when no location is set — callers fall back to the translated "Kyiv"
// (t("common.kyiv")) so the default city follows the UI language. Used to
// localize headings like "Найцікавіше над {{city}}" to the observer's city.
export function locCity(loc) {
  if (!loc || !loc.label) return null;
  return (loc.label.split(",")[0] || "").trim() || null;
}