// Hero system diagram (illustrative TOI-700 system). Static SVG showing the
// host star, three planet orbits, the habitable zone ring and labelled
// planets — a visual anchor for the page. Each planet dot is clickable and
// opens a detail popup anchored to the dot (voyager orbit-stage pattern):
// the popup lives inside the stage, the diagram stays visible behind it.
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { fmtNum } from "../../lib/format";

// Planet geometry (1:1 with the template SVG) + illustrative parameters shown
// in the popup. Period/teq only filled where the template gives them
// (TOI-700 d/e); the others stay null so the popup omits them honestly.
const PLANETS = [
  { id: "b", r: 78,    dr: 3.5, color: "var(--text-dim)", rad: "0.90", x: 293.1, y: 126.7,
    planet: { name: "TOI-700 b", host: "TOI-700 (M-карлик)", host_en: "TOI-700 (M dwarf)",
              radius: 0.90, period: null, distance_ly: 101, teq: null,
              st_teff: null, st_mass: null, disc_year: null, facility: null,
              confirmed: true, habitability: "unknown" } },
  { id: "c", r: 93.6,  dr: 6.9, color: "var(--coral)",    rad: "2.65", x: 352.1, y: 213.8,
    planet: { name: "TOI-700 c", host: "TOI-700 (M-карлик)", host_en: "TOI-700 (M dwarf)",
              radius: 2.65, period: null, distance_ly: 101, teq: null,
              st_teff: null, st_mass: null, disc_year: null, facility: null,
              confirmed: true, habitability: "unknown" } },
  { id: "d", r: 123.9, dr: 3.5, color: "var(--teal)",    rad: "1.19", x: 270.8, y: 321.0,
    planet: { name: "TOI-700 d", host: "TOI-700 (M-карлик)", host_en: "TOI-700 (M dwarf)",
              radius: 1.19, period: 37.4, distance_ly: 101, teq: 300,
              st_teff: 3240, st_mass: 0.21, disc_year: 2020, facility: "TESS",
              confirmed: true, habitability: "habitable" } },
  { id: "e", r: 111.9, dr: 3.5, color: "var(--gold)",    rad: "0.95", x: 154.9, y: 235.9,
    planet: { name: "TOI-700 e", host: "TOI-700 (M-карлик)", host_en: "TOI-700 (M dwarf)",
              radius: 0.95, period: 7.9, distance_ly: 101, teq: 340,
              st_teff: 3240, st_mass: 0.21, disc_year: 2023, facility: "TESS",
              confirmed: true, habitability: "edge" } },
];

function Row({ label, val }) {
  if (val == null || val === "") return null;
  return (
    <div className="dl-row"><span className="lbl">{label}</span><span className="val">{val}</span></div>
  );
}

export default function ExoSystem() {
  const { t, i18n } = useTranslation();
  const [sel, setSel] = useState(null);
  const [pos, setPos] = useState(null);
  const stageRef = useRef(null);
  const cx = 260, cy = 197.6;

  const active = PLANETS.find((p) => p.id === sel);

  // Convert the selected dot's viewBox coords (520×380) to pixel coords within
  // the stage, so the popup anchors to the dot. Recompute on resize while open.
  const measure = () => {
    if (!sel || !stageRef.current) { setPos(null); return; }
    const p = PLANETS.find((x) => x.id === sel);
    if (!p) { setPos(null); return; }
    const w = stageRef.current.clientWidth || 460;
    const h = stageRef.current.clientHeight || (w * 380 / 520);
    const px = (p.x / 520) * w;
    const py = (p.y / 380) * h;
    const half = 120;
    const left = w < half * 2 ? w / 2 : Math.max(half, Math.min(w - half, px));
    setPos({ left, top: py, below: py < 90 });
  };
  useLayoutEffect(measure, [sel]);
  useEffect(() => {
    if (!sel) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sel]);

  const K = t("exoplanets.detail.units.teq");
  const Msun = t("exoplanets.detail.units.stMass");
  const R = t("exoplanets.radiusUnit");
  const D = t("exoplanets.periodUnit");
  const LY = t("exoplanets.lyUnit");

  return (
    <div className="exo-wrap">
      <div className="exo-stage" ref={stageRef}>
        <svg viewBox="0 0 520 380" xmlns="http://www.w3.org/2000/svg" role="img"
             aria-label={t("exoplanets.diagram.starLabel")}>
          {/* habitable zone halo */}
          <circle cx={cx} cy={cy} r={143.9} fill="var(--teal)" opacity=".10" />
          <circle cx={cx} cy={cy} r={101.8} fill="var(--panel)" />
          {/* orbits */}
          {PLANETS.map((p) => (
            <circle key={p.id} className="exo-orbit" cx={cx} cy={cy} r={p.r} />
          ))}
          {/* host star */}
          <circle cx={cx} cy={cy} r={9} fill="#FFB25E" />
          <circle cx={cx} cy={cy} r={15} fill="none" stroke="#FFB25E" strokeOpacity=".3" />
          {/* planets — clickable */}
          {PLANETS.map((p) => {
            const on = sel === p.id;
            return (
              <g key={p.id}
                 className={"exo-dot-btn" + (on ? " selected" : "")}
                 role="button" tabIndex={0}
                 aria-label={"TOI-700 " + p.id}
                 aria-expanded={on}
                 onClick={(e) => { e.stopPropagation(); setSel(on ? null : p.id); }}
                 onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(on ? null : p.id); } }}>
                <circle cx={p.x} cy={p.y} r={16} fill="transparent" />
                {on && <circle cx={p.x} cy={p.y} r={p.dr + 4} fill="none" stroke={p.color} strokeOpacity=".7" strokeWidth="1.5" />}
                <circle cx={p.x} cy={p.y} r={p.dr} fill={p.color} className="obj-dot" />
                <text className="exo-label"
                  x={p.id === "e" ? p.x - 9 : p.x + 11}
                  y={p.y + 4}
                  textAnchor={p.id === "e" ? "end" : "start"}
                  fill={p.color === "var(--text-dim)" ? "var(--text-dim)" : p.color}>
                  TOI-700 {p.id} · {p.rad} R⊕
                </text>
              </g>
            );
          })}
          <text className="exo-label strong" x={cx} y={45.7} textAnchor="middle">
            {t("exoplanets.diagram.hzLabel")}
          </text>
          <text className="exo-label" x={cx} y={375.5} textAnchor="middle">
            {t("exoplanets.diagram.starLabel")}
          </text>
        </svg>

        {active && pos && (() => {
          const p = active.planet;
          const host = i18n.language === "en" ? p.host_en : p.host;
          const habiKey = p.habitability || "unknown";
          const blurb = t("exoplanets.detail.blurb." + habiKey, { defaultValue: "" });
          const habiLabel = t("exoplanets.feat." + habiKey, { defaultValue: "—" });
          return (
            <div className={"oi-pop exo-pop" + (pos.below ? " below" : "")}
                 style={{ left: pos.left, top: pos.top }} role="dialog"
                 onClick={(e) => e.stopPropagation()}>
              <div className="oi-card">
                <div className="oi-head">
                  <span className={"oi-probe " + (p.confirmed ? "v2" : "v1")}>
                    {p.confirmed ? t("exoplanets.catalog.confirmed") : t("exoplanets.catalog.candidate")}
                  </span>
                  <span className="oi-tag">{p.name}</span>
                  <button type="button" className="oi-close" onClick={() => setSel(null)} aria-label={t("exoplanets.detail.close")}>×</button>
                </div>
                <div className="exo-pop-rows">
                  <Row label={t("exoplanets.detail.host")} val={host} />
                  <Row label={t("exoplanets.detail.radius")} val={p.radius != null ? fmtNum(p.radius, 2) + " " + R : null} />
                  <Row label={t("exoplanets.detail.period")} val={p.period != null ? fmtNum(p.period, 2) + " " + D : null} />
                  <Row label={t("exoplanets.detail.distance")} val={p.distance_ly != null ? p.distance_ly + " " + LY : null} />
                  <Row label={t("exoplanets.detail.teq")} val={p.teq != null ? fmtNum(p.teq, 0) + " " + K : null} />
                  <Row label={t("exoplanets.detail.stTeff")} val={p.st_teff != null ? fmtNum(p.st_teff, 0) + " " + K : null} />
                  <Row label={t("exoplanets.detail.stMass")} val={p.st_mass != null ? fmtNum(p.st_mass, 2) + " " + Msun : null} />
                  <Row label={t("exoplanets.detail.discYear")} val={p.disc_year != null ? String(p.disc_year) : null} />
                  <Row label={t("exoplanets.detail.facility")} val={p.facility || null} />
                  <Row label={t("exoplanets.detail.habitability")} val={habiLabel} />
                </div>
                {blurb && <p className="oi-desc">{blurb}</p>}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}