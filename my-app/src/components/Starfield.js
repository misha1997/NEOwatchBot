// Fixed full-viewport twinkling starfield (port of site/assets/starfield.js).
// Renders a single <canvas id="starfield"> behind everything (z-index:0).
import { useEffect, useRef } from "react";

export default function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    let raf;
    let stars = [];
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
      const n = Math.min(160, Math.floor(window.innerWidth / 9));
      stars = [];
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          r: Math.random() * 1.3 + 0.2,
          s: Math.random() * 0.6 + 0.15,
          p: Math.random() * Math.PI * 2,
        });
      }
    }
    resize();
    window.addEventListener("resize", resize);

    function draw(t) {
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        const alpha = reduced ? 0.5 : (Math.sin((t / 1400) * st.s + st.p) * 0.35 + 0.55);
        ctx.beginPath();
        ctx.fillStyle = "rgba(237,238,245," + alpha.toFixed(2) + ")";
        ctx.arc(st.x, st.y, st.r, 0, 7);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas id="starfield" ref={ref} />;
}