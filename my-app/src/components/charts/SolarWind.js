// Solar-wind speed line chart (weather.html #chart-wind). Port of
// solarWindChart in space-weather.js.
import { useTranslation } from "react-i18next";
import ChartCanvas from "./ChartCanvas";
import { baseTimeScale } from "./chartUtils";
import { fmtTime } from "../../lib/format";

export default function SolarWind({ rows }) {
  const { t, i18n } = useTranslation();
  const kms = t("common.units.km_s");
  return (
    <ChartCanvas deps={[rows, i18n.language]} factory={() => {
      if (!rows || !rows.length) return null;
      return {
        type: "line",
        data: {
          datasets: [{
            data: rows.map((r) => ({ x: r[0], y: r[1] })),
            borderColor: "#4FD1C5", backgroundColor: "rgba(79,209,197,.18)",
            borderWidth: 1.6, pointRadius: 0, tension: 0.2, fill: true,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: (i) => fmtTime(i[0].parsed.x),
              label: (c) => c.parsed.y.toFixed(0) + " " + kms,
            } },
          },
          scales: {
            x: baseTimeScale(false),
            y: { grid: { color: "rgba(255,255,255,0.04)" },
              ticks: { callback: (v) => v + " " + kms } },
          },
        },
      };
    }} />
  );
}