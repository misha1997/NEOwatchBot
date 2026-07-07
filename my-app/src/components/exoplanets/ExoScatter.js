// Radius vs orbital-period scatter, plotted live from the exoplanet API
// payload. Period axis is logarithmic (0.5–1000 d); radius axis is
// square-root scaled up to 14 R⊕ so the small Earth-like planets the page
// cares about stay visible next to the hot Jupiters.
import { useTranslation } from "react-i18next";

const W = 600, H = 280;
const PAD_L = 44, PAD_R = 16, PAD_B = 30, PAD_T = 16;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const PERIOD_MIN = 0.5, PERIOD_MAX = 1000;   // days
const R_MAX = 14;                              // Earth radii

const Y_TICKS = [0, 2, 4, 8, 12];
const X_TICKS = [1, 10, 100];

function x(period) {
  const l = (Math.log10(period) - Math.log10(PERIOD_MIN)) /
            (Math.log10(PERIOD_MAX) - Math.log10(PERIOD_MIN));
  return PAD_L + l * PLOT_W;
}
function y(r) {
  // square-root scale so 1 R⊕ is visible next to 12 R⊕
  const s = Math.sqrt(Math.max(0, r)) / Math.sqrt(R_MAX);
  return PAD_T + (1 - s) * PLOT_H;
}

function dotR(r) {
  // radius 4–10 px, sqrt-scaled
  return 4 + (Math.sqrt(Math.min(r, R_MAX)) / Math.sqrt(R_MAX)) * 6;
}

export default function ExoScatter({ points = [] }) {
  const { t } = useTranslation();
  const grid = Y_TICKS.map((v) => y(v));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img"
         aria-label={t("exoplanets.scatter.title")}>
      {/* horizontal gridlines + y-axis labels */}
      {Y_TICKS.map((v, i) => (
        <g key={v}>
          <line className="exo-gridline" x1={PAD_L} y1={grid[i]} x2={W - PAD_R} y2={grid[i]} />
          <text className="exo-axis" x={PAD_L - 6} y={grid[i] + 3} textAnchor="end">{v}R⊕</text>
        </g>
      ))}
      {/* x-axis labels */}
      {X_TICKS.map((v) => (
        <text key={v} className="exo-axis" x={x(v)} y={H - PAD_B + 18} textAnchor="middle">{v}д</text>
      ))}
      {/* data points */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(Math.max(PERIOD_MIN, Math.min(PERIOD_MAX, p.period)))}
                  cy={y(Math.max(0, Math.min(R_MAX, p.radius)))}
                  r={dotR(p.radius)}
                  fill={p.confirmed ? "var(--teal)" : "var(--gold)"}
                  opacity=".85" className="obj-dot" />
        </g>
      ))}
    </svg>
  );
}