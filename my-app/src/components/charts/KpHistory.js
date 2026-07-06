// Kp 7-day history bar chart (weather.html #chart-kp-history). Port of
// kpHistoryChart in space-weather.js. Each bar coloured by its Kp value.
import { useTranslation } from "react-i18next";
import ChartCanvas from "./ChartCanvas";
import { baseTimeScale } from "./chartUtils";
import { kpColor, fmtDay } from "../../lib/format";

export default function KpHistory({ rows }) {
  const { t, i18n } = useTranslation();
  return (
    <ChartCanvas deps={[rows, i18n.language]} factory={() => {
      if (!rows || !rows.length) return null;
      const kp = t("weather.chart.kp");
      return {
        type: "bar",
        data: {
          datasets: [{
            data: rows.map((r) => ({ x: r[0], y: r[1] })),
            backgroundColor: rows.map((r) => kpColor(r[1])),
            borderWidth: 0, barPercentage: 0.85, categoryPercentage: 0.9,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: (i) => fmtDay(i[0].parsed.x),
              label: (c) => kp + " " + c.parsed.y.toFixed(1),
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