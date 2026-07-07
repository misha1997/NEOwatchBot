// Hero system diagram (illustrative TOI-700 system). Static SVG showing the
// host star, three planet orbits, the habitable zone ring and labelled
// planets — a visual anchor for the page. Live data lives in the cards and
// table, not here (the archive doesn't expose per-system orbital geometry in
// a small, stable way).
import { useTranslation } from "react-i18next";

// Planet dots: [orbitRadius, dotRadius, color, labelAnchor, labelDy]
const PLANETS = [
  { r: 78,  dr: 3.5, color: "var(--text-dim)", id: "b", rad: "0.90", x: 293.1, y: 126.7 },
  { r: 93.6, dr: 6.9, color: "var(--coral)",    id: "c", rad: "2.65", x: 352.1, y: 213.8 },
  { r: 123.9, dr: 3.5, color: "var(--teal)",    id: "d", rad: "1.19", x: 270.8, y: 321.0 },
  { r: 111.9, dr: 3.5, color: "var(--gold)",    id: "e", rad: "0.95", x: 154.9, y: 235.9 },
];

export default function ExoSystem() {
  const { t } = useTranslation();
  const cx = 260, cy = 197.6;
  return (
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
      {/* planets */}
      {PLANETS.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={p.y} r={p.dr} fill={p.color} className="obj-dot" />
          <text className="exo-label"
            x={p.id === "e" ? p.x - 9 : p.x + 11}
            y={p.y + 4}
            textAnchor={p.id === "e" ? "end" : "start"}
            fill={p.color === "var(--text-dim)" ? "var(--text-dim)" : p.color}>
            TOI-700 {p.id} · {p.rad} R⊕
          </text>
        </g>
      ))}
      <text className="exo-label strong" x={cx} y={45.7} textAnchor="middle">
        {t("exoplanets.diagram.hzLabel")}
      </text>
      <text className="exo-label" x={cx} y={375.5} textAnchor="middle">
        {t("exoplanets.diagram.starLabel")}
      </text>
    </svg>
  );
}