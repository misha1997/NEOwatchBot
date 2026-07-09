import { useEffect, useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLoc } from "../context/LocationContext";
import { useLang } from "../context/LanguageContext";
import { getConstellationDetails } from "../lib/constellation_details";
import "../styles/constellations.css";

const CX = 750;
const CY = 280;
const R_HOR = 250;
const R_ZEN = 10;

// Coordinate transformations: RA/Dec (equatorial) -> Alt/Az (horizontal)
function getJulianDate(date) {
  return (date.getTime() / 86400000) + 2440587.5;
}

function getLST(date, lonDeg) {
  const jd = getJulianDate(date);
  const d = jd - 2451545.0;
  let gst = 280.46061837 + 360.98564736629 * d;
  let lst = gst + lonDeg;
  lst = lst % 360;
  if (lst < 0) lst += 360;
  return lst;
}

function raDecToAltAz(raDeg, decDeg, latDeg, lonDeg, date) {
  const lst = getLST(date, lonDeg);
  let ha = lst - raDeg;
  if (ha < 0) ha += 360;

  const haRad = (ha * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const latRad = (latDeg * Math.PI) / 180;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altRad = Math.asin(sinAlt);
  const altDeg = (altRad * 180) / Math.PI;

  const y = -Math.sin(haRad) * Math.cos(decRad);
  const x = Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad);
  let azRad = Math.atan2(y, x);
  let azDeg = (azRad * 180) / Math.PI;
  if (azDeg < 0) azDeg += 360;

  return { alt: altDeg, az: azDeg };
}

// Convert Alt/Az to polar screen coordinates (Zenith in center, Horizon as R_HOR circle)
function altAzToXY(alt, az) {
  const r = R_ZEN + (R_HOR - R_ZEN) * (1 - alt / 90);
  const a = (az * Math.PI) / 180;
  return {
    x: CX + r * Math.sin(a),
    y: CY - r * Math.cos(a)
  };
}

function dotRadius(mag) {
  if (mag == null) return 2;
  const r = 2.5 + (2.5 - mag) * 0.6;
  return Math.max(1.1, Math.min(5.5, r));
}

// Coordinate formatters (Stellarium style)
function formatRA(raDeg) {
  const raHours = raDeg / 15;
  const h = Math.floor(raHours);
  const m = Math.floor((raHours - h) * 60);
  const s = Math.floor(((raHours - h) * 60 - m) * 60);
  return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

// Format Dec with sign and minutes/seconds
function formatDec(decDeg) {
  const sign = decDeg >= 0 ? "+" : "-";
  const absDec = Math.abs(decDeg);
  const d = Math.floor(absDec);
  const m = Math.floor((absDec - d) * 60);
  const s = Math.floor(((absDec - d) * 60 - m) * 60);
  return `${sign}${d.toString().padStart(2, "0")}° ${m.toString().padStart(2, "0")}' ${s.toString().padStart(2, "0")}"`;
}

function formatAlt(altDeg) {
  const sign = altDeg >= 0 ? "+" : "-";
  const absAlt = Math.abs(altDeg);
  const d = Math.floor(absAlt);
  const m = Math.floor((absAlt - d) * 60);
  return `${sign}${d.toString().padStart(2, "0")}° ${m.toString().padStart(2, "0")}'`;
}

function formatAz(azDeg) {
  const d = Math.floor(azDeg);
  const m = Math.floor((azDeg - d) * 60);
  return `${d.toString().padStart(3, "0")}° ${m.toString().padStart(2, "0")}'`;
}

// Map season key to a mock date representation for season picker
function getSeasonDate(season) {
  const current = new Date();
  if (!season) return current;

  const year = current.getFullYear();
  switch (season) {
    case "winter":
      return new Date(year, 0, 15, 22, 0, 0);
    case "spring":
      return new Date(year, 3, 15, 22, 0, 0);
    case "summer":
      return new Date(year, 6, 15, 22, 0, 0);
    case "autumn":
      return new Date(year, 9, 15, 22, 0, 0);
    default:
      return current;
  }
}

export default function Constellations() {
  const { t } = useTranslation();
  const { loc } = useLoc();
  const { lang } = useLang();

  const latLon = useMemo(() => {
    return loc ? { lat: loc.lat, lon: loc.lon } : { lat: 50.45, lon: 30.52 };
  }, [loc]);

  // States
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeConst, setActiveConst] = useState("UMa");
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [hoveredObj, setHoveredObj] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [geoInfo, setGeoInfo] = useState(null);

  // Pan & Zoom States (Zoom default 3.0, allow deep zoom up to 60.0)
  const [zoom, setZoom] = useState(3.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const svgRef = useRef(null);
  const dragStart = useRef({ x: 0, y: 0 });

  // Automatically determine season on load based on current month
  const [seasonFilter, setSeasonFilter] = useState(() => {
    const month = new Date().getMonth();
    const seasonsNorth = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
    return seasonsNorth[month];
  });

  // Set document title
  useEffect(() => {
    document.title = t("title.constellations") || "Сузір'я — OrbitLight";
  }, [t]);

  // Load celestial data once
  useEffect(() => {
    setLoading(true);
    fetch("/data/celestial_data.json")
      .then((res) => res.json())
      .then((jsonData) => {
        setData(jsonData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load celestial data:", err);
        setLoading(false);
      });
  }, []);

  // Set up wheel event listener with passive: false to prevent browser default page scrolling
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoom((prevZoom) => {
        const nextZoom = prevZoom * zoomFactor;
        return Math.max(1.0, Math.min(60.0, nextZoom));
      });
    };

    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      svg.removeEventListener("wheel", handleWheel);
    };
  }, [loading]);

  // Update live clock every minute when no season override is selected
  useEffect(() => {
    if (seasonFilter) return;
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, [seasonFilter]);

  // Sync date and status message when season or geolocation selection changes
  useEffect(() => {
    const nextDate = getSeasonDate(seasonFilter);
    setCurrentTime(nextDate);

    if (geoInfo) {
      setStatusMsg(
        lang === "en"
          ? `Your location: ${geoInfo.lat}, ${geoInfo.lon} (${geoInfo.hemi} hemisphere). Showing constellations best visible now.`
          : `Твоя позиція: ${geoInfo.lat}, ${geoInfo.lon} (${geoInfo.hemi} півкуля). Показано сузір'я, які найкраще видно зараз.`
      );
    } else if (seasonFilter) {
      const seasonNames = {
        winter: lang === "en" ? "winter" : "зимові",
        spring: lang === "en" ? "spring" : "весняні",
        summer: lang === "en" ? "summer" : "літні",
        autumn: lang === "en" ? "autumn" : "осінні"
      };
      setStatusMsg(
        lang === "en"
          ? `Showing ${seasonNames[seasonFilter]} constellations — golden stars on the map below.`
          : `Показано ${seasonNames[seasonFilter]} сузір'я — золоті зірки на карті нижче.`
      );
    } else {
      setStatusMsg(
        lang === "en"
          ? "Golden stars on the map below highlight constellations best visible in the selected season."
          : "Золоті зірки на карті нижче — сузір'я, які найкраще видно у вибрану пору року."
      );
    }
  }, [seasonFilter, geoInfo, lang]);

  // Calculate Level of Detail (LOD) magnitude threshold based on zoom level
  const magCutoff = useMemo(() => {
    if (zoom < 3.0) return 4.7; // Faint stars hidden
    if (zoom < 5.0) return 5.2; // Medium stars visible
    if (zoom < 8.0) return 5.7; // Fainter stars visible
    if (zoom < 12.0) return 6.1; // Faint stars visible
    return 6.5; // Show all stars up to 6.5 when deeply zoomed in
  }, [zoom]);

  // Calculate coordinates projection on the fly
  const projectedSky = useMemo(() => {
    if (!data) return { stars: [], constellations: [] };

    // 1. Project constellations
    const constellations = data.constellations.map((c) => {
      const centerLoc = raDecToAltAz(c.ra, c.dec, latLon.lat, latLon.lon, currentTime);
      const xyCenter = altAzToXY(centerLoc.alt, centerLoc.az);

      const projectedLines = c.lines.map((line) => {
        return line.map((pt) => {
          const ptLoc = raDecToAltAz(pt[0], pt[1], latLon.lat, latLon.lon, currentTime);
          return altAzToXY(ptLoc.alt, ptLoc.az);
        });
      });

      const details = getConstellationDetails(c.id, lang);
      const isSeason = seasonFilter ? details.seasonKey === seasonFilter : false;

      return {
        ...c,
        details,
        isSeason,
        x: xyCenter.x,
        y: xyCenter.y,
        alt: centerLoc.alt,
        az: centerLoc.az,
        lines: projectedLines
      };
    });

    // 2. Project stars
    const stars = data.stars.map((s) => {
      const starLoc = raDecToAltAz(s.ra, s.dec, latLon.lat, latLon.lon, currentTime);
      const xy = altAzToXY(starLoc.alt, starLoc.az);
      return {
        ...s,
        x: xy.x,
        y: xy.y,
        alt: starLoc.alt,
        az: starLoc.az
      };
    });

    return { stars, constellations };
  }, [data, latLon, currentTime, seasonFilter, lang]);

  // Filter stars/constellations around the horizon to avoid space clutter
  const visibleStars = useMemo(() => {
    return projectedSky.stars.filter((s) => s.alt > -12 && s.mag <= magCutoff);
  }, [projectedSky.stars, magCutoff]);

  const visibleConstellations = useMemo(() => {
    return projectedSky.constellations.filter((c) => c.alt > -12);
  }, [projectedSky.constellations]);

  // Handle geolocation auto-trigger
  const handleAutoGeolocate = () => {
    if (!navigator.geolocation) {
      setGeoInfo(null);
      setStatusMsg(lang === "en" ? "Geolocation not supported by browser." : "Геолокація не підтримується браузером.");
      return;
    }
    setGeoInfo(null);
    setStatusMsg(lang === "en" ? "Acquiring location..." : "Визначаємо місцезнаходження...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        
        // Automatically determine season based on location hemisphere and current month
        const month = new Date().getMonth();
        const seasonsNorth = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
        let sk = seasonsNorth[month];
        if (lat < 0) {
          const flip = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };
          sk = flip[sk];
        }
        setSeasonFilter(sk);
        
        const hemi = lat >= 0 ? (lang === "en" ? "Northern" : "північній") : (lang === "en" ? "Southern" : "південній");
        setGeoInfo({
          lat: lat.toFixed(1),
          lon: lon.toFixed(1),
          hemi: hemi
        });
      },
      (err) => {
        setGeoInfo(null);
        setStatusMsg(
          lang === "en"
            ? `Geolocation failed: ${err.message}. Select season manually.`
            : `Не вдалося отримати геолокацію (${err.message}) — обери сезон вручну кнопками вище.`
        );
      }
    );
  };

  // Manual season picker selection
  const handleSelectSeason = (s) => {
    setGeoInfo(null); // Clear geolocation message
    setSeasonFilter(seasonFilter === s ? null : s);
  };

  // Drag-to-pan handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    };
  };

  const handleMouseMoveMap = (e) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(3.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(60.0, prev * 1.3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(1.0, prev * 0.75));
  };

  // Handle mouse movements for tooltip positioning
  const handleMouseMoveTooltip = (e, type, obj) => {
    setHoveredObj({
      type,
      data: obj,
      x: e.clientX + 15,
      y: e.clientY + 15
    });
  };

  const handleMouseLeaveTooltip = () => {
    setHoveredObj(null);
  };

  // Constellation pills list
  const popularConstList = [
    { id: "UMa", season: "spring", uk: "Велика Ведмедиця", en: "Ursa Major" },
    { id: "Cas", season: "autumn", uk: "Кассіопея", en: "Cassiopeia" },
    { id: "Ori", season: "winter", uk: "Оріон", en: "Orion" },
    { id: "Cyg", season: "summer", uk: "Лебідь", en: "Cygnus" },
    { id: "Leo", season: "spring", uk: "Лев", en: "Leo" },
    { id: "Sco", season: "summer", uk: "Скорпіон", en: "Scorpius" },
    { id: "Lyr", season: "summer", uk: "Ліра", en: "Lyra" },
    { id: "And", season: "autumn", uk: "Андромеда", en: "Andromeda" }
  ];

  // Tooltip translations HUD labels
  const hudLabels = useMemo(() => {
    return lang === "en" ? {
      bayer: "Bayer designation",
      catalog: "Catalog number",
      mag: "Apparent Magnitude",
      constellation: "Constellation",
      radec: "RA / Dec (J2000)",
      altaz: "Alt / Az (apparent)"
    } : {
      bayer: "Позначення Байєра",
      catalog: "Номер каталогу",
      mag: "Видима зоряна величина",
      constellation: "Сузір'я",
      radec: "Пряме піднес. / Схилення",
      altaz: "Висота / Азимут"
    };
  }, [lang]);

  return (
    <>
      {/* Stellarium HUD Tooltip */}
      {hoveredObj && (
        <div
          className="const-tooltip show"
          style={{ left: hoveredObj.x, top: hoveredObj.y, padding: "12px 14px", minWidth: 260 }}
        >
          {hoveredObj.type === "const" ? (
            <>
              <div className="tt-name" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.15)", paddingBottom: 6, marginBottom: 6 }}>
                {hoveredObj.data.uk} ({hoveredObj.data.la})
              </div>
              <div className="tt-sub" style={{ marginBottom: 4 }}>
                {lang === "en" ? "Brightest: " : "Найяскравіша: "} <strong>{hoveredObj.data.details.star}</strong> · {hoveredObj.data.details.season}
              </div>
              <div className="tt-myth" style={{ marginTop: 6, fontSize: "11px", lineHeight: "1.4", opacity: 0.9 }}>
                {hoveredObj.data.details.myth}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div className="tt-name" style={{ fontSize: "14px", fontWeight: "bold", borderBottom: "1px solid rgba(255,255,255,0.15)", paddingBottom: "6px", marginBottom: "6px", color: "#FFC873" }}>
                {hoveredObj.data.name || hoveredObj.data.bayer || `HIP ${hoveredObj.data.id}`}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "4px 8px", fontSize: "11px", color: "var(--text-light)", fontFamily: "var(--font-mono)" }}>
                <span style={{ color: "var(--text-dim)" }}>{hudLabels.bayer}:</span>
                <span style={{ fontWeight: "500" }}>{hoveredObj.data.bayer || "—"}</span>
                
                <span style={{ color: "var(--text-dim)" }}>{hudLabels.catalog}:</span>
                <span>HIP {hoveredObj.data.id}</span>
                
                <span style={{ color: "var(--text-dim)" }}>{hudLabels.mag}:</span>
                <span style={{ color: "#FFC873", fontWeight: "bold" }}>{hoveredObj.data.mag.toFixed(2)}m</span>
                
                <span style={{ color: "var(--text-dim)" }}>{hudLabels.constellation}:</span>
                <span>
                  {(() => {
                    const cInfo = data?.constellations.find((c) => c.id === hoveredObj.data.const);
                    return cInfo ? (lang === "en" ? cInfo.name : cInfo.uk) : (hoveredObj.data.const || "—");
                  })()}
                </span>
                
                <span style={{ color: "var(--text-dim)" }}>{hudLabels.radec}:</span>
                <span>{formatRA(hoveredObj.data.ra)} / {formatDec(hoveredObj.data.dec)}</span>
                
                <span style={{ color: "var(--text-dim)" }}>{hudLabels.altaz}:</span>
                <span style={{ color: hoveredObj.data.alt >= 0 ? "#50e3c2" : "#ff5a5f" }}>
                  {formatAlt(hoveredObj.data.alt)} / {formatAz(hoveredObj.data.az)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hero section */}
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">{t("constellations.hero.eyebrow") || "Інтерактивно · клікни на будь-яке сузір'я"}</div>
          <h1 className="hero-title">
            {lang === "en" ? (
              <>Find <span className="accent">constellations</span><br />in the night sky</>
            ) : (
              <>Впізнай <span className="accent">сузір'я</span><br />на нічному небі</>
            )}
          </h1>
          <p className="hero-sub" style={{ maxWidth: 640 }}>
            {lang === "en"
              ? "The eight most famous constellations of the northern sky — with their shape, brightest star, and origin myth. Click on a figure or button below to select."
              : "Вісім найвідоміших сузір'їв північного неба — з їхньою формою, головною зорею та міфом походження. Клікай на фігуру або на назву внизу, щоб дізнатись більше."}
          </p>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          {/* Controls Panel (Compliant with templates/constellations.html) */}
          <div className="geo-panel">
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              {lang === "en" ? "Sky tonight" : "Небо саме зараз"}
            </div>
            <div className="geo-row">
              <button className="btn primary" onClick={handleAutoGeolocate}>
                📍 {lang === "en" ? "Show my sky" : "Показати моє небо"}
              </button>
              <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                {lang === "en" ? "or select season manually:" : "або обери сезон вручну:"}
              </span>
              {["winter", "spring", "summer", "autumn"].map((s) => (
                <span
                  key={s}
                  className={`filter-pill ${seasonFilter === s ? "on" : ""}`}
                  data-season={s}
                  onClick={() => handleSelectSeason(s)}
                >
                  {s === "winter" ? (lang === "en" ? "Winter" : "Зима") :
                   s === "spring" ? (lang === "en" ? "Spring" : "Весна") :
                   s === "summer" ? (lang === "en" ? "Summer" : "Літо") :
                   (lang === "en" ? "Autumn" : "Осінь")}
                </span>
              ))}
            </div>
            <div 
              className={`geo-status ${
                statusMsg.includes("Не вдалося") || statusMsg.includes("failed") 
                  ? "err" 
                  : (seasonFilter || geoInfo ? "ok" : "")
              }`} 
              id="geoStatus"
            >
              {statusMsg}
            </div>
          </div>

          {/* Interactive Celestial Map */}
          <div className="card constellation-map-wrap">
            {/* Zoom / Reset overlay buttons */}
            <div
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                zIndex: 10
              }}
            >
              <button
                className="btn ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: 18, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={handleZoomIn}
                title={lang === "en" ? "Zoom In" : "Збільшити"}
              >
                +
              </button>
              <button
                className="btn ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: 18, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={handleZoomOut}
                title={lang === "en" ? "Zoom Out" : "Зменшити"}
              >
                -
              </button>
              <button
                className="btn ghost"
                style={{ width: 36, height: 36, padding: 0, fontSize: 18, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}
                onClick={handleResetView}
                title={lang === "en" ? "Reset View" : "Скинути вигляд"}
              >
                ↺
              </button>
            </div>

            {loading ? (
              <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="k">{t("common.loading") || "Завантаження зоряного каталогу..."}</div>
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox="0 0 1500 560"
                xmlns="http://www.w3.org/2000/svg"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMoveMap}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Apply zoom transform centered at CX, CY (750, 280), followed by translation offset */}
                <g transform={`translate(${panOffset.x}, ${panOffset.y}) translate(${CX}, ${CY}) scale(${zoom}) translate(${-CX}, ${-CY})`}>
                  
                  {/* Outer space background dome */}
                  <circle
                    cx={CX}
                    cy={CY}
                    r={R_HOR}
                    fill="rgba(6, 12, 24, 0.82)"
                    stroke="var(--border)"
                    strokeWidth={(2 / zoom).toFixed(2)}
                  />

                  {/* Grid Lines (Altitude Rings) */}
                  <circle className="sky-grid-line" cx={CX} cy={CY} r={170} fill="none" strokeWidth={(0.8 / zoom).toFixed(2)} />
                  <circle className="sky-grid-line" cx={CX} cy={CY} r={90} fill="none" strokeWidth={(0.8 / zoom).toFixed(2)} />
                  <circle className="sky-grid-line" cx={CX} cy={CY} r={R_ZEN} fill="none" strokeWidth={(0.8 / zoom).toFixed(2)} />

                  {/* Cardinal lines */}
                  <line className="sky-grid-line" x1={CX} y1={CY - R_HOR} x2={CX} y2={CY + R_HOR} strokeWidth={(0.8 / zoom).toFixed(2)} />
                  <line className="sky-grid-line" x1={CX - R_HOR} y1={CY} x2={CX + R_HOR} y2={CY} strokeWidth={(0.8 / zoom).toFixed(2)} />
                  
                  {/* Diagonal grid lines */}
                  <line className="sky-grid-line" x1={CX - 176} y1={CY - 176} x2={CX + 176} y2={CY + 176} strokeWidth={(0.8 / zoom).toFixed(2)} />
                  <line className="sky-grid-line" x1={CX + 176} y1={CY - 176} x2={CX - 176} y2={CY + 176} strokeWidth={(0.8 / zoom).toFixed(2)} />

                  {/* Cardinal Direction Labels */}
                  <text className="sky-axis" x={CX} y={CY - R_HOR - 8} textAnchor="middle" style={{ fontSize: (13 / zoom).toFixed(2) }}>N</text>
                  <text className="sky-axis" x={CX} y={CY + R_HOR + 16} textAnchor="middle" style={{ fontSize: (13 / zoom).toFixed(2) }}>S</text>
                  <text className="sky-axis" x={CX - R_HOR - 8} y={CY + 4} textAnchor="end" style={{ fontSize: (13 / zoom).toFixed(2) }}>E</text>
                  <text className="sky-axis" x={CX + R_HOR + 8} y={CY + 4} textAnchor="start" style={{ fontSize: (13 / zoom).toFixed(2) }}>W</text>

                  <text className="sky-axis" x={CX} y={CY - 174} textAnchor="middle" style={{ fontSize: (10 / zoom).toFixed(2) }}>30°</text>
                  <text className="sky-axis" x={CX} y={CY - 94} textAnchor="middle" style={{ fontSize: (10 / zoom).toFixed(2) }}>60°</text>
                  <text className="sky-axis" x={CX} y={CY - 14} textAnchor="middle" style={{ fontSize: (10 / zoom).toFixed(2) }}>{lang === "en" ? "Zenith" : "Зеніт"}</text>

                  {/* Background Stars with hit area to easily hover every single star */}
                  {visibleStars
                    .filter((s) => !s.const || s.mag > 4.0)
                    .map((s) => (
                      <g key={`star-${s.id}`}>
                        <circle
                          className="bg-star twinkle"
                          cx={s.x.toFixed(1)}
                          cy={s.y.toFixed(1)}
                          r={(dotRadius(s.mag) / zoom).toFixed(2)}
                          opacity={s.alt >= 0 ? (0.22 + (5.5 - s.mag) * 0.12).toFixed(2) : 0.08}
                          style={{ animationDelay: `${(s.id % 20) * 0.2}s` }}
                        />
                        {/* Overlay hit area for easier hover */}
                        <circle
                          className="const-hit"
                          cx={s.x.toFixed(1)}
                          cy={s.y.toFixed(1)}
                          r={(10 / zoom).toFixed(2)}
                          onMouseMove={(e) => handleMouseMoveTooltip(e, "star", s)}
                          onMouseLeave={handleMouseLeaveTooltip}
                        />
                      </g>
                  ))}

                  {/* Constellation Groups (Lines + Major Stars + Labels) */}
                  {visibleConstellations.map((c) => {
                    const isActive = activeConst === c.id;
                    const isInSeason = c.isSeason;

                    return (
                      <g
                        key={`const-group-${c.id}`}
                        className={`const-group ${isActive ? "active" : ""} ${isInSeason ? "in-season" : ""}`}
                        onClick={() => setActiveConst(c.id)}
                        onMouseMove={(e) => handleMouseMoveTooltip(e, "const", c)}
                        onMouseLeave={handleMouseLeaveTooltip}
                        opacity={c.alt >= 0 ? 1 : 0.4}
                      >
                        {/* Constellation Lines */}
                        {c.lines.map((line, idx) => (
                          <path
                            key={`line-${idx}`}
                            className="const-line"
                            style={{ strokeWidth: (1.1 / zoom).toFixed(2) }}
                            d={`M ${line.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" L ")}`}
                          />
                        ))}

                        {/* Major stars that belong to this constellation */}
                        {visibleStars
                          .filter((s) => s.const === c.id)
                          .map((s) => (
                            <g key={`major-star-${s.id}`}>
                              <circle
                                  className={`const-star ${s.mag <= 2.2 ? "bright" : ""}`}
                                  cx={s.x.toFixed(1)}
                                  cy={s.y.toFixed(1)}
                                  r={(dotRadius(s.mag) / zoom).toFixed(2)}
                              />
                              {/* Overlay hit area for easier hover (prevent bubbling to const group) */}
                              <circle
                                className="const-hit"
                                cx={s.x.toFixed(1)}
                                cy={s.y.toFixed(1)}
                                r={(12 / zoom).toFixed(2)}
                                onMouseMove={(e) => {
                                  e.stopPropagation();
                                  handleMouseMoveTooltip(e, "star", s);
                                }}
                                onMouseLeave={handleMouseLeaveTooltip}
                              />
                            </g>
                        ))}

                        {/* Constellation label at center */}
                        {c.x && c.y && (
                          <text
                            className="const-label"
                            x={c.x.toFixed(1)}
                            y={c.y.toFixed(1)}
                            style={{ fontSize: (10.5 / zoom).toFixed(2) }}
                          >
                            {lang === "en" ? c.name : c.uk}
                          </text>
                        )}
                      </g>
                    );
                  })}

                </g>
              </svg>
            )}
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 10, textAlign: "center" }}>
              {lang === "en"
                ? "Azimuthal projection: center is Zenith, outer ring is Horizon. Stellarium HUD mode active. Drag to pan, scroll/pinch or use buttons in the corner to zoom. Hover over stars for advanced info."
                : "Азимутальна проекція: центр — Зеніт, зовнішнє коло — Горизонт. Режим інформаційного табло Stellarium активний. Перетягуй карту для руху, використовуй кнопки чи коліщатко для масштабування. Наведи на зорю для детальної інфо."}
            </p>
          </div>

          {/* Quick picker pills */}
          <div className="const-pills" style={{ justifyContent: "center" }}>
            {popularConstList.map((p) => {
              const isActive = activeConst === p.id;
              const isInSeason = seasonFilter ? p.season === seasonFilter : false;

              return (
                <button
                  key={p.id}
                  className={`const-pill ${isActive ? "active" : ""} ${isInSeason ? "in-season" : ""}`}
                  onClick={() => setActiveConst(p.id)}
                >
                  {lang === "en" ? p.en : p.uk}
                  <span className="seasonbadge">●</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
