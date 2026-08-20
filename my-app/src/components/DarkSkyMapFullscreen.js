// Fullscreen modal for DarkSkyMap — same chrome as SatMapFullscreen.js
// (constellations.css .cfm-* classes), simplified: no chip bar, since the
// dark-sky map has a single static overlay rather than toggleable groups.
import { useEffect, useRef } from "react";
import DarkSkyMap from "./DarkSkyMap";
import "../styles/constellations.css";

export default function DarkSkyMapFullscreen({ loc, lang, onClose }) {
  const mapRef = useRef(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    // The map mounts at display:none-ish zero layout during the modal's own
    // transition on some browsers; nudge Leaflet once it has real size.
    const id = setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 60);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      clearTimeout(id);
    };
  }, [onClose]);

  return (
    <div className="cfm-fullscreen-wrap" style={{ display: "flex", flexDirection: "column" }} role="dialog" aria-modal="true" aria-label={lang === "en" ? "Dark sky map" : "Карта темного неба"}>
      <div className="cfm-top-bar">
        <div className="cfm-top-bar-left">
          <div className="cfm-title">{lang === "en" ? "Dark sky map" : "Карта темного неба"}</div>
        </div>
        <button className="cfm-btn cfm-btn-close" onClick={onClose} aria-label={lang === "en" ? "Close" : "Закрити"}>✕</button>
      </div>

      <div className="sat-map-fs-body" style={{ flex: 1, position: "relative" }}>
        <DarkSkyMap ref={mapRef} loc={loc} />
      </div>
    </div>
  );
}
