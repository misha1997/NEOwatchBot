// City-picker modal + geolocation auto-detect (port of app.js openPicker /
// renderResults / detectLoc / injectDetectButtons). Exposed via a context so
// any page's <LocationPill/> can open it without prop drilling.
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLoc } from "../context/LocationContext";
import { getGeocode, getReverseGeocode } from "../lib/api";

const PickerCtx = createContext(null);
export const usePicker = () => useContext(PickerCtx);

export function PickerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectErr, setDetectErr] = useState(false);
  const { saveLoc } = useLoc();

  const close = useCallback(() => setOpen(false), []);

  // Request geolocation directly — does NOT open the modal. On success it
  // saves the location and closes any modal that happened to be open. On
  // failure (blocked / unavailable / timeout) it opens the modal so the user
  // can type a city manually, surfacing the error inline.
  const requestDetect = useCallback(() => {
    if (!navigator.geolocation) { setDetectErr(true); setOpen(true); return; }
    setDetecting(true);
    setDetectErr(false);
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude, lon = pos.coords.longitude;
      getReverseGeocode(lat, lon)
        .then((d) => {
          const label = d && d.label ? d.label
            : (lat.toFixed(2) + "°, " + lon.toFixed(2) + "°");
          saveLoc(lat, lon, label);
          setDetecting(false);
          close();
        })
        .catch(() => {
          saveLoc(lat, lon, lat.toFixed(2) + "°, " + lon.toFixed(2) + "°");
          setDetecting(false);
          close();
        });
    }, () => { setDetecting(false); setDetectErr(true); setOpen(true); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }, [saveLoc, close]);

  const openPicker = useCallback(() => { setDetectErr(false); setOpen(true); }, []);

  return (
    <PickerCtx.Provider value={{ open, openPicker, close, requestDetect, detecting, detectErr }}>
      {children}
      {open && <LocationPickerModal />}
    </PickerCtx.Provider>
  );
}

function LocationPickerModal() {
  const { close, detecting, detectErr } = usePicker();
  const { saveLoc } = useLoc();
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      getGeocode(trimmed).then(setResults).catch(() => setResults([]));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q]);

  const choose = (it) => {
    saveLoc(parseFloat(it.lat), parseFloat(it.lon), it.short_name + ", " + it.country);
    close();
  };

  return (
    <div className="loc-picker" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="loc-picker-card">
        <div className="lp-head">
          <span className="lp-ic" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </span>
          <div className="lp-titles">
            <div className="lp-title">{t("picker.title")}</div>
            <div className="lp-sub">OrbitLight</div>
          </div>
          <button type="button" className="lp-close" onClick={close} aria-label={t("picker.close")} title={t("picker.close")}>×</button>
        </div>
        <div className="lp-search">
          <span className="lp-mag" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input type="text" autoFocus placeholder={t("picker.placeholder")} autoComplete="off"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="lp-results">
          {detecting ? (
            <div className="lp-note detect">{t("picker.detecting")}</div>
          ) : detectErr ? (
            <div className="lp-note err">{t("picker.detectFail")}</div>
          ) : results.length === 0 ? (
            <div className="lp-note">{t("picker.hint")}</div>
          ) : results.map((it) => {
            const sub = [it.state, it.country].filter(Boolean).join(", ");
            return (
              <button key={it.lat + "," + it.lon} className="lp-res" onClick={() => choose(it)}>
                <span className="lr-name">{it.short_name}</span>
                <span className="lr-sub">{sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}