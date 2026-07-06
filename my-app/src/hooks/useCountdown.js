// useCountdown — ticks once a second, returning d/h/m/s remaining until `ts`
// (unix seconds). Drives the launch countdown clocks (app.js tickCountdowns).
import { useEffect, useState } from "react";
import { pad2 } from "../lib/format";

export function useCountdown(ts) {
  const [diff, setDiff] = useState(() => Math.max(0, (ts || 0) - Math.floor(Date.now() / 1000)));
  useEffect(() => {
    setDiff(Math.max(0, (ts || 0) - Math.floor(Date.now() / 1000)));
    const id = setInterval(() => {
      setDiff(Math.max(0, (ts || 0) - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [ts]);

  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  return { d, h, m, s, pad2 };
}