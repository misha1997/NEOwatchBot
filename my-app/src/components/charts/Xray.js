// GOES X-ray flux line chart (weather.html #chart-xray). Port of xrayChart in
// space-weather.js. Logarithmic Y axis labelled by flare class (A/B/C/M/X).
import { useTranslation } from "react-i18next";
import ChartCanvas from "./ChartCanvas";
import { baseTimeScale } from "./chartUtils";
import { fmtTime } from "../../lib/format";

const CLS = { "1e-8": "A", "1e-7": "B", "1e-6": "C", "1e-5": "M", "1e-4": "X" };

export default function Xray({ rows }) {
  const { t, i18n } = useTranslation();
  return (
    <ChartCanvas deps={[rows, i18n.language]} factory={() => {
      if (!rows || !rows.length) return null;
      const flux = t("weather.chart.flux");
      const wm2 = t("common.units.wm2");
      return {
        type: "line",
        data: {
          datasets: [{
            data: rows.map((r) => ({ x: r[0], y: r[1] })),
            borderColor: "#FFA94D", backgroundColor: "rgba(255,169,77,.15)",
            borderWidth: 1.4, pointRadius: 0, tension: 0.15, fill: true,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: (i) => fmtTime(i[0].parsed.x),
              label: (c) => flux + " " + c.parsed.y.toExponential(1) + " " + wm2,
            } },
          },
          scales: {
            x: baseTimeScale(false),
            y: {
              type: "logarithmic", min: 1e-9, max: 1e-3,
              grid: { color: "rgba(255,255,255,0.04)" },
              ticks: { callback: (v) => CLS[String(v)] || Number(v).toExponential(0) },
            },
          },
        },
      };
    }} />
  );
}