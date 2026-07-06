// Shared Chart.js axis scale factory for the space-weather charts (linear
// time axis formatted as HH:MM or DD.MM HH:MM). Port of baseTimeScale in
// space-weather.js.
import { fmtTime } from "../../lib/format";

export function baseTimeScale(withDate) {
  return {
    type: "linear",
    ticks: {
      maxRotation: 0, autoSkip: true, maxTicksLimit: 6,
      callback: (v) => fmtTime(v, withDate),
    },
    grid: { color: "rgba(255,255,255,0.04)" },
  };
}