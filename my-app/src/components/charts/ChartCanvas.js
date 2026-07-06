// Generic Chart.js wrapper for the space-weather charts. `factory` returns a
// Chart.js config (or null to skip); the chart is (re)built whenever `deps`
// change. Chart.js v4 auto-build registers all controllers/elements globally.
// Port of the setupChartTheme + per-chart `new Chart(el, …)` calls in
// space-weather.js.
import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

export default function ChartCanvas({ factory, deps = [], height }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    // Theme defaults (space-weather.js setupChartTheme).
    Chart.defaults.color = "#8B90AC";
    Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
    Chart.defaults.font.family = "ui-monospace, 'JetBrains Mono', monospace";
    Chart.defaults.font.size = 11;

    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const cfg = factory();
    if (!cfg) return;
    chartRef.current = new Chart(ref.current, cfg);

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return <canvas ref={ref} style={height ? { height } : undefined} />;
}