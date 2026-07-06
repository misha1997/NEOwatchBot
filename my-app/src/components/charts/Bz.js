// Bz magnetic-field line chart (weather.html #chart-bz). Port of bzChart in
// space-weather.js. Each segment is coloured by sign — coral when south
// (negative, "opens" the magnetosphere), teal when north.
import { useTranslation } from "react-i18next";
import ChartCanvas from "./ChartCanvas";
import { baseTimeScale } from "./chartUtils";
import { fmtTime } from "../../lib/format";

export default function Bz({ rows }) {
  const { t, i18n } = useTranslation();
  const nt = t("common.units.nt");
  return (
    <ChartCanvas deps={[rows, i18n.language]} factory={() => {
      if (!rows || !rows.length) return null;
      return {
        type: "line",
        data: {
          datasets: [{
            data: rows.map((r) => ({ x: r[0], y: r[1] })),
            borderColor: "#E8B94D", borderWidth: 1.6, pointRadius: 0,
            tension: 0.2, fill: false,
            segment: { borderColor: (c) => c.p1.parsed.y < 0 ? "#FF6B4A" : "#4FD1C5" },
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: (i) => fmtTime(i[0].parsed.x),
              label: (c) => (c.parsed.y > 0 ? "+" : "") + c.parsed.y.toFixed(1) + " " + nt,
            } },
          },
          scales: {
            x: baseTimeScale(false),
            y: { grid: { color: "rgba(255,255,255,0.04)" },
              ticks: { callback: (v) => v + " " + nt } },
          },
        },
      };
    }} />
  );
}