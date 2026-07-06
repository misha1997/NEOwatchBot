// Comets orbit diagram (comets.html .orbit-card). Sun/Earth at center with
// the four comet orbits; toggle buttons show/hide each comet group (app.js
// wireCometToggles). Header live-name/coords come from /api/comets `brightest`.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { fmtNum } from "../../lib/format";

// Static SVG diagram labels. Proper-noun designations have an English form
// (matches the backend `designation_en` in services/comets.py); pick by lang so
// the EN mode does not show Cyrillic comet names in the diagram.
const COMETS = [
  { id: "c2025r4", color: "var(--teal)", label: "C/2025 R4 (Borёва)", labelEn: "C/2025 R4 (Boreva)", dist: "2.1" },
  { id: "p29", color: "var(--gold)", label: "29P/Schwassmann–Wachmann", labelEn: "29P/Schwassmann–Wachmann", dist: "6.0" },
  { id: "c2026f3", color: "#B98FE8", label: "C/2026 F3", labelEn: "C/2026 F3", dist: "4.4" },
  { id: "p67", color: "var(--coral)", label: "67P/Чурюмова–Герасименко", labelEn: "67P/Churyumov–Gerasimenko", dist: "3.2" },
];

export default function CometOrbit({ b }) {
  const { t, i18n } = useTranslation();
  const en = i18n.language === "en";
  const lbl = (c) => (en ? c.labelEn : c.label);
  const [active, setActive] = useState({ c2025r4: true, p29: true, c2026f3: true, p67: true });
  const toggle = (id) => setActive((a) => ({ ...a, [id]: !a[id] }));
  const liveName = b ? t("comets.prefix") + " " + b.designation : t("comets.fallbackName");
  const coords = b
    ? t("comets.coordsFallback", {
        sun: fmtNum(b.distance_sun_au, 1),
        earth: fmtNum(b.distance_earth_au, 1),
        peri: b.days_to_perihelion != null ? b.days_to_perihelion : "—",
      })
    : t("comets.coordsFallback", { sun: "1.4", earth: "2.1", peri: "72" });
  const au = t("common.units.ao");
  return (
    <div className="orbit-card">
      <div className="orbit-head">
        <div className="live"><span className="dot live" /> <span id="orbit-live-name">{liveName}</span></div>
        <span className="coords" id="orbit-coords">{coords}</span>
      </div>
      <div className="orbit-toolbar">
        <div className="comet-toggles" id="comet-toggles">
          {COMETS.map((c) => (
            <button type="button" key={c.id}
              className={"comet-toggle-btn" + (active[c.id] ? " active" : "")}
              data-comet={c.id} style={{ "--c": c.color }}
              onClick={() => toggle(c.id)}>
              <span className="sw" />{lbl(c)}
            </button>
          ))}
        </div>
      </div>
      <div className="orbit-wrap" id="orbit-wrap">
        <svg id="orbit-svg" viewBox="-10 100 620 210" xmlns="http://www.w3.org/2000/svg">
          <circle className="comet-scale-ring" cx="168.0" cy="208.0" r="20" />
          <circle cx="168.0" cy="208.0" r="6" fill="var(--gold)" />
          <circle cx="168.0" cy="208.0" r="11" fill="none" stroke="var(--gold)" strokeOpacity=".3" />
          <text className="comet-label" x="168.0" y="242.0" textAnchor="middle">{t("comets.chart.earthAu")}</text>

          <g className={"comet-item" + (active.c2025r4 ? "" : " is-hidden")} data-comet="c2025r4">
            <ellipse className="comet-ellipse" cx="365.5" cy="208.0" rx="210.0" ry="71.4" style={{ stroke: "var(--teal)", strokeOpacity: 0.4 }} />
            <line x1="183.6" y1="243.7" x2="199.7" y2="267.5" stroke="var(--teal)" strokeWidth="3" strokeLinecap="round" opacity=".55" />
            <circle cx="183.6" cy="243.7" r="6" fill="var(--teal)" className="obj-dot" />
            <text className="comet-label strong" x="173.6" y="247.2" textAnchor="end" fill="var(--teal)">{lbl(COMETS[0])} · {COMETS[0].dist} {au}</text>
          </g>

          <g className={"comet-item" + (active.p29 ? "" : " is-hidden")} data-comet="p29">
            <ellipse className="comet-ellipse" cx="198.6" cy="208.0" rx="78.0" ry="71.8" style={{ stroke: "var(--gold)", strokeOpacity: 0.4 }} />
            <circle cx="258.3" cy="254.1" r="4" fill="var(--gold)" className="obj-dot" />
            <text className="comet-label" x="268.3" y="257.6" textAnchor="start" fill="var(--gold)">{lbl(COMETS[1])} · {COMETS[1].dist} {au}</text>
          </g>

          <g className={"comet-item" + (active.c2026f3 ? "" : " is-hidden")} data-comet="c2026f3">
            <ellipse className="comet-ellipse" cx="312.0" cy="208.0" rx="150.0" ry="42.0" style={{ stroke: "#B98FE8", strokeOpacity: 0.4 }} />
            <circle cx="260.7" cy="168.5" r="4" fill="#B98FE8" className="obj-dot" />
            <text className="comet-label" x="250.7" y="172.0" textAnchor="end" fill="#B98FE8">{lbl(COMETS[2])} · {COMETS[2].dist} {au}</text>
          </g>

          <g className={"comet-item" + (active.p67 ? "" : " is-hidden")} data-comet="p67">
            <ellipse className="comet-ellipse" cx="199.2" cy="208.0" rx="52.0" ry="41.6" style={{ stroke: "var(--coral)", strokeOpacity: 0.4 }} />
            <circle cx="225.2" cy="172.0" r="4" fill="var(--coral)" className="obj-dot" />
            <text className="comet-label" x="235.2" y="175.5" textAnchor="start" fill="var(--coral)">{lbl(COMETS[3])} · {COMETS[3].dist} {au}</text>
          </g>
        </svg>
      </div>
    </div>
  );
}