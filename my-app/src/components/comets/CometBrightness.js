// Comet brightness curve (comets.html #brightness SVG). Static chart — the
// magnitude polyline, threshold line, axis labels and "now" marker. The
// numeric now/peak/trend values live in the page (fed by /api/comets).
import { useTranslation } from "react-i18next";

export default function CometBrightness() {
  const { t } = useTranslation();
  const w = t("comets.chart.weeksShort");
  return (
    <svg viewBox="0 0 600 240" xmlns="http://www.w3.org/2000/svg">
      <line className="mag-threshold" x1="42" y1="108.4" x2="584" y2="108.4" />
      <polyline points="42.0,176.7 69.1,163.3 96.2,145.9 123.3,124.9 150.4,101.9 177.5,79.2 204.6,60.0 231.7,47.0 258.8,42.4 285.9,47.0 313.0,60.0 340.1,79.2 367.2,101.9 394.3,124.9 421.4,145.9 448.5,163.3 475.6,176.7 502.7,186.2 529.8,192.4 556.9,196.3 584.0,198.5"
        fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" />
      <text className="mag-axis" x="36" y="32.2" textAnchor="end">3m</text>
      <text className="mag-axis" x="36" y="85.0" textAnchor="end">5m</text>
      <text className="mag-axis" x="36" y="137.8" textAnchor="end">7m</text>
      <text className="mag-axis" x="36" y="190.6" textAnchor="end">9m</text>
      <text className="mag-axis" x="42.0" y="234" textAnchor="middle">-8{w}</text>
      <text className="mag-axis" x="150.4" y="234" textAnchor="middle">-4{w}</text>
      <text className="mag-axis" x="258.8" y="234" textAnchor="middle">+0{w}</text>
      <text className="mag-axis" x="367.2" y="234" textAnchor="middle">+4{w}</text>
      <text className="mag-axis" x="475.6" y="234" textAnchor="middle">+8{w}</text>
      <text className="mag-axis" x="584.0" y="234" textAnchor="middle">+12{w}</text>
      <line className="mag-now" x1="258.8" y1="16" x2="258.8" y2="214" />
      <text className="comet-label strong" x="258.8" y="12" textAnchor="middle">{t("comets.chart.now")}</text>
      <circle cx="258.8" cy="42.4" r="4" fill="var(--teal)" />
    </svg>
  );
}