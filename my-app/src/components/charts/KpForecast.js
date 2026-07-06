// Kp 3-day forecast line chart (weather.html #chart-kp-forecast). Port of
// kpForecastChart in space-weather.js. Observed points (r[2] true) as a solid
// gold line, predicted points as a dashed teal line.
import { useTranslation } from "react-i18next";
import ChartCanvas from "./ChartCanvas";
import { baseTimeScale } from "./chartUtils";
import { fmtTime } from "../../lib/format";

export default function KpForecast({ rows }) {
  const { t, i18n } = useTranslation();
  return (
    <ChartCanvas deps={[rows, i18n.language]} factory={() => {
      if (!rows || !rows.length) return null;
      const obs = rows.filter((r) => r[2]).map((r) => ({ x: r[0], y: r[1] }));
      const pred = rows.filter((r) => !r[2]).map((r) => ({ x: r[0], y: r[1] }));
      return {
        type: "line",
        data: {
          datasets: [
            { data: obs, label: t("weather.chart.observed"), borderColor: "#E8B94D",
              backgroundColor: "rgba(232,185,77,.15)", borderWidth: 2, pointRadius: 0,
              tension: 0.25, fill: false },
            { data: pred, label: t("weather.chart.forecast"), borderColor: "#4FD1C5",
              backgroundColor: "rgba(79,209,197,.12)", borderWidth: 2, borderDash: [4, 4],
              pointRadius: 0, tension: 0.25, fill: false },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, labels: { boxWidth: 12, boxHeight: 12 } },
            tooltip: { callbacks: {
              title: (i) => fmtTime(i[0].parsed.x, true),
              label: (c) => c.dataset.label + ": Kp " + c.parsed.y.toFixed(1),
            } },
          },
          scales: {
            x: baseTimeScale(true),
            y: { min: 0, max: 9, grid: { color: "rgba(255,255,255,0.04)" } },
          },
        },
      };
    }} />
  );
}