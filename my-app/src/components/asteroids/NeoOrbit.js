// Asteroid orbit "radar" (asteroids.html hero SVG). Earth at center, LD rings
// out to 12 LD, Moon at 1 LD. Live asteroid dots positioned by renderNeoOrbit.
// Golden-angle spread around the dial; hazardous → coral, else gold.
import { useTranslation } from "react-i18next";

const CX = 280, CY = 280, R1 = 18.2, R_MAX = 217.8;

export default function NeoOrbit({ items = [] }) {
  const { t } = useTranslation();
  const shown = (items || []).slice(0, 8);
  const dots = [];
  shown.forEach((a, i) => {
    if (a.distance_ld == null) return;
    const ld = Math.max(0.15, Math.min(a.distance_ld, 12));
    let r = R1 + ((ld - 1) / 11) * (R_MAX - R1);
    if (r < 8) r = 8;
    const ang = i * 2.39996 + 0.6;
    const x = CX + r * Math.cos(ang);
    const y = CY + r * Math.sin(ang);
    const color = a.hazardous ? "var(--coral)" : "var(--gold)";
    const dotR = 3.5 + Math.min((a.diameter_max || 0) / 120, 4.5);
    const anchor = x >= CX ? "start" : "end";
    const lx = x + (anchor === "start" ? 9 : -9);
    const name = String(a.name || "").replace(/[()]/g, "");
    const label = name + " · " + a.distance_ld + " " + t("common.units.ld");
    dots.push(
      <g key={i}>
        <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={dotR.toFixed(1)} fill={color} className="obj-dot" />
        <text className="obj-label" x={lx.toFixed(1)} y={(y + 3).toFixed(1)}
          textAnchor={anchor} fill={color}>{label}</text>
      </g>
    );
  });
  return (
    <svg viewBox="0 0 560 560" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle className="dome-ring" cx="280" cy="280" r="18.2" />
      <circle className="dome-ring" cx="280" cy="280" r="54.5" />
      <circle className="dome-ring" cx="280" cy="280" r="108.9" />
      <circle className="dome-ring" cx="280" cy="280" r="163.4" />
      <circle className="dome-ring" cx="280" cy="280" r="217.8" />
      <circle cx="280" cy="280" r="18.2" fill="none" stroke="var(--teal)" strokeOpacity=".45" strokeDasharray="3 4" />
      <circle cx="280" cy="280" r="7" fill="#4FD1C5" />
      <circle cx="280" cy="280" r="13" fill="none" stroke="var(--teal)" strokeOpacity=".3" />
      <text className="dome-label" x="280" y="257.8" textAnchor="middle">1 LD</text>
      <text className="dome-label" x="280" y="221.5" textAnchor="middle">3 LD</text>
      <text className="dome-label" x="280" y="167.1" textAnchor="middle">6 LD</text>
      <text className="dome-label" x="280" y="112.6" textAnchor="middle">9 LD</text>
      <text className="dome-label" x="280" y="58.2" textAnchor="middle">12 LD</text>
      <text className="dome-label" x="300.9" y="261.2" textAnchor="start" fill="var(--teal)">{t("asteroids.orbit.moon")}</text>
      <text className="dome-label" x="280" y="304" textAnchor="middle" fill="var(--teal)">{t("asteroids.orbit.earth")}</text>
      <g id="neo-orbit-objects">{dots}</g>
    </svg>
  );
}