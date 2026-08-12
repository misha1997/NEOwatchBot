import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SatMap from "./SatMap";
import "../styles/constellations.css";

export default function SatMapFullscreen({ active, groups, toggle, count, lang, onClose }) {
  const { t } = useTranslation();
  const mapRef = useRef(null);

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Use a default limit for fullscreen (can be larger, e.g. 1000)
  const [fsCount, setFsCount] = useState(null);
  const countTxt = fsCount == null ? t("satellites.loading") : t("satellites.onMap", { n: fsCount });

  // Get only the active keys for the initial load
  const activeKeys = Object.keys(active).filter(k => active[k]);

  return (
    <div className="cfm-fullscreen-wrap" style={{ display: 'flex', flexDirection: 'column' }} role="dialog" aria-modal="true" aria-label={lang === "en" ? "Satellites Map" : "Карта супутників"}>
      <div className="cfm-top-bar" style={{ zIndex: 10 }}>
        <div className="cfm-top-bar-left">
          <div className="cfm-title">{lang === "en" ? "Satellites Map" : "Карта супутників"}</div>
        </div>
        <button className="cfm-btn cfm-btn-close" onClick={onClose} aria-label={lang === "en" ? "Close" : "Закрити"}>✕</button>
      </div>
      
      <div className="sat-map-fs-body" style={{ flex: 1, position: 'relative' }}>
        <SatMap ref={mapRef} groups={activeKeys} limit={1000} lang={lang}
                onReady={(n) => setFsCount(n)}
                onCount={(n) => setFsCount(n)} />
      </div>
      
      <div className="sat-controls" style={{ background: '#0a0c14', padding: '16px', borderTop: '1px solid var(--border)', zIndex: 10 }}>
        {(groups || []).map((g) => {
          const isActive = active[g.key];
          return (
            <button type="button" key={g.key}
              className={"chip" + (isActive ? " on" : "")}
              style={{ color: isActive ? g.color : "" }}
              onClick={() => {
                toggle(g);
                if (mapRef.current) {
                  if (isActive) {
                    mapRef.current.removeGroup(g.key);
                  } else {
                    mapRef.current.addGroup(g.key);
                  }
                }
              }}>
              <span className="swatch" style={{ background: g.color }} />
              {g.icon ? g.icon + " " : ""}{g.label}
            </button>
          );
        })}
        <span className="count">{countTxt}</span>
      </div>
    </div>
  );
}
