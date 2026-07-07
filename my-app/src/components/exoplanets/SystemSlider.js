// Star-system slider for the exoplanets orrery: active system centered, prev/
// next arrows on the edges, swipe/drag to browse. Sits directly under the
// exo-stage. Selecting a system (arrow or chip click) auto-scrolls it to the
// center; the track is also draggable (mouse + touch) to peek at neighbors.
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { SYSTEMS } from "./systems";

export default function SystemSlider({ systemId, onSelect }) {
  const { t } = useTranslation();
  const trackRef = useRef(null);
  const chipRefs = useRef({});
  // Drag state: we manually set scrollLeft while the pointer is down so the
  // track follows the finger/cursor (native overflow scroll only reacts to
  // touch, not mouse). `moved` suppresses the chip click that would otherwise
  // fire after a drag that ended on a chip.
  const drag = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false });

  // Auto-scroll the active chip to the center whenever the selection changes.
  // Use viewport-relative rects (el.offsetLeft is relative to offsetParent,
  // which is NOT the track here, so it gave a wrong target and the scroll
  // never landed).
  useEffect(() => {
    const el = chipRefs.current[systemId];
    const track = trackRef.current;
    if (!el || !track) return;
    const tRect = track.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    // chip's current offset from the track's visible left edge, in absolute
    // scroll space:
    const offset = track.scrollLeft + (eRect.left - tRect.left);
    const target = offset - (track.clientWidth - eRect.width) / 2;
    track.scrollTo({ left: target, behavior: "smooth" });
  }, [systemId]);

  const step = (dir) => {
    const idx = SYSTEMS.findIndex((s) => s.id === systemId);
    if (idx < 0) return;
    onSelect(SYSTEMS[(idx + dir + SYSTEMS.length) % SYSTEMS.length].id);
  };

  const onDown = (e) => {
    const track = trackRef.current;
    if (!track) return;
    drag.current = { down: true, startX: e.clientX, scrollLeft: track.scrollLeft, moved: false };
  };
  const onMove = (e) => {
    if (!drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 5) drag.current.moved = true;
    const track = trackRef.current;
    if (track) track.scrollLeft = drag.current.scrollLeft - dx;
  };
  const onUp = () => { drag.current.down = false; };

  const pickChip = (id) => {
    if (drag.current.moved) { drag.current.moved = false; return; } // was a drag, not a click
    onSelect(id);
  };

  return (
    <div className="exo-slider">
      <button type="button" className="exo-arrow" onClick={() => step(-1)}
              aria-label={t("exoplanets.systems.prev")} title={t("exoplanets.systems.prev")}>‹</button>
      <div className="exo-slider-track" ref={trackRef}
           onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
           onPointerCancel={onUp}>
        {SYSTEMS.map((s) => (
          <button type="button" key={s.id}
                  ref={(el) => { chipRefs.current[s.id] = el; }}
                  className={"exo-chip" + (s.id === systemId ? " active" : "")}
                  onClick={() => pickChip(s.id)}>
            {t("exoplanets.systems." + s.id + ".name")}
          </button>
        ))}
      </div>
      <button type="button" className="exo-arrow" onClick={() => step(1)}
              aria-label={t("exoplanets.systems.next")} title={t("exoplanets.systems.next")}>›</button>
    </div>
  );
}