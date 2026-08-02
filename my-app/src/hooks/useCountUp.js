// Animate a number from 0 → `value` once the element scrolls into view (or
// immediately if `immediate` is true). Uses requestAnimationFrame with an
// ease-out cubic over `duration` ms. Returns the current display value (rounded
// to `decimals`). Used by the galaxy stat tiles so big distances "tick up".
//
// Re-runs the animation whenever `value` changes (e.g. SPA navigation between
// two galaxies reuses the same component instance) — the "already started"
// guard is reset on each value change, and an element already in the viewport
// is counted immediately without waiting for an IntersectionObserver crossing.
import { useEffect, useRef, useState } from "react";

export function useCountUp(value, { duration = 1100, decimals = 0, immediate = false } = {}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (value == null || isNaN(value)) return;
    startedRef.current = false;
    const node = ref.current;
    let raf = 0;
    const run = () => {
      startedRef.current = true;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
        setDisplay(value * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
        else setDisplay(value);
      };
      raf = requestAnimationFrame(tick);
    };
    if (immediate) { run(); return () => cancelAnimationFrame(raf); }
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const inView = rect.top < (window.innerHeight || 0) && rect.bottom > 0;
    if (inView) { run(); return () => cancelAnimationFrame(raf); }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !startedRef.current) run();
      });
    }, { threshold: 0.35 });
    io.observe(node);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration, immediate]);

  const rounded = decimals
    ? Number(display.toFixed(decimals))
    : Math.round(display);
  return { ref, value: rounded };
}