// Reveal-on-scroll: returns a ref + an `in` boolean that flips true once the
// element enters the viewport. Pairs with the `.reveal` CSS class (opacity 0,
// translateY(14px) → .reveal.in { opacity 1; transform none }). One-shot per
// mount: once visible it stays visible.
import { useEffect, useRef, useState } from "react";

export function useReveal({ threshold = 0.15, once = true } = {}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") { setShown(true); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once) {
          setShown(false);
        }
      });
    }, { threshold });
    io.observe(node);
    return () => io.disconnect();
  }, [threshold, once]);

  return { ref, shown };
}