// Voyager trajectory diagram (voyager.html hero SVG). Static JSX — Sun at
// center, planetary orbits, heliopause ring, and the V1 (gold, north) /
// V2 (teal, south) trajectories with milestone dots. No live data.
//
// Milestone dots are clickable: a popup anchored at the dot (like the
// satellite markers on the Satellites map) shows the probe, the event tag
// and a short description. The shared start dot (Sun) carries the launch story.
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { useTranslation } from "react-i18next";

const GOLD = "var(--gold)";
const TEAL = "var(--teal)";

// id → which probe's color/label to use; coordinates come from the original SVG.
const NODES = [
  { id: "start",      x: 166.4, y: 260.0, probe: "v1", year: "1977", label: "start" },
  { id: "v1_jupiter", x: 211.5, y: 202.3, probe: "v1", year: "1979", label: "jupiter" },
  { id: "v1_saturn",  x: 227.9, y: 181.3, probe: "v1", year: "1980", label: "saturn" },
  { id: "v1_helio",   x: 320.1, y: 63.3,  probe: "v1", year: "2012", label: "helio" },
  { id: "v1_now",     x: 365.1, y: 5.6,   probe: "v1", year: "2026", label: null, au: "166" },
  { id: "v2_jupiter", x: 220.8, y: 309.0, probe: "v2", year: "1979", label: "jupiter" },
  { id: "v2_saturn",  x: 240.6, y: 326.8, probe: "v2", year: "1981", label: "saturn" },
  { id: "v2_uranus",  x: 265.3, y: 349.1, probe: "v2", year: "1986", label: "uranus" },
  { id: "v2_neptune", x: 280.2, y: 362.4, probe: "v2", year: "1989", label: "neptune" },
  { id: "v2_helio",   x: 351.9, y: 427.0, probe: "v2", year: "2018", label: "helio" },
  { id: "v2_now",     x: 384.0, y: 456.0, probe: "v2", year: "2026", label: null, au: "139" },
];

export default function OrbitMap() {
  const { t } = useTranslation();
  const [sel, setSel] = useState(null);
  const [pos, setPos] = useState(null);
  const stageRef = useRef(null);

  const color = (p) => (p === "v1" ? GOLD : TEAL);
  const tag = (n) =>
    n.label ? n.year + " · " + t("voyager.orbitMap." + n.label)
            : n.year + " · " + t("voyager.orbitMap.nowAu", { au: n.au });
  const active = NODES.find((n) => n.id === sel);

  // Convert the selected dot's viewBox coords to pixel coords within the stage,
  // so the popup can be anchored to the dot. Recompute on resize while open.
  const measure = () => {
    if (!sel || !stageRef.current) { setPos(null); return; }
    const n = NODES.find((x) => x.id === sel);
    if (!n) { setPos(null); return; }
    const w = stageRef.current.clientWidth || 460;
    const h = stageRef.current.clientHeight || w;
    const px = (n.x / 520) * w;
    const py = (n.y / 520) * h;
    const half = 120; // approx popup half-width for horizontal clamping
    const left = w < half * 2 ? w / 2 : Math.max(half, Math.min(w - half, px));
    setPos({ left, top: py, below: py < 90 });
  };
  useLayoutEffect(measure, [sel]);
  useEffect(() => {
    if (!sel) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sel]);

  return (
    <div className="orbit-wrap">
      <div className="orbit-stage" ref={stageRef}>
        <svg viewBox="0 0 520 520" xmlns="http://www.w3.org/2000/svg">
          <circle className="orbit-ring" cx="166.4" cy="260.0" r="33.3" />
          <circle className="orbit-ring" cx="166.4" cy="260.0" r="73.2" />
          <circle className="orbit-ring" cx="166.4" cy="260.0" r="99.8" />
          <circle className="orbit-ring" cx="166.4" cy="260.0" r="133.1" />
          <circle className="orbit-ring" cx="166.4" cy="260.0" r="153.1" />
          <circle className="orbit-ring helio" cx="166.4" cy="260.0" r="249.6" />
          <text className="orbit-label" x="166.4" y="520" textAnchor="middle" fill="var(--coral)">{t("voyager.orbitMap.helioLabel")}</text>
          <circle cx="166.4" cy="260.0" r="6" fill="var(--gold)" />
          <circle cx="166.4" cy="260.0" r="11" fill="none" stroke="var(--gold)" strokeOpacity=".3" />
          <line className="v1-path" x1="166.4" y1="260.0" x2="365.1" y2="5.6" />
          <line className="v2-path" x1="166.4" y1="260.0" x2="384.0" y2="456.0" />
          {NODES.map((n) => {
            const c = color(n.probe);
            const on = sel === n.id;
            return (
              <g key={n.id} className={"v-node" + (on ? " active" : "")}
                onClick={(e) => { e.stopPropagation(); setSel(on ? null : n.id); }}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(on ? null : n.id); } }}>
                <circle cx={n.x} cy={n.y} r="11" fill="transparent" />
                <circle className="v-dot" cx={n.x} cy={n.y} r={on ? 4.6 : 3.6} fill={c} />
                {on && <circle className="v-ring" cx={n.x} cy={n.y} r="8" fill="none" stroke={c} strokeWidth="1.5" />}
                <text className="v-tag" x={n.x + 10} y={n.y - 6} textAnchor="start" fill={c}>{tag(n)}</text>
              </g>
            );
          })}
        </svg>

        {active && pos && (
          <div className={"oi-pop" + (pos.below ? " below" : "")} style={{ left: pos.left, top: pos.top }} role="dialog">
            <div className="oi-card">
              <div className="oi-head">
                <span className={"oi-probe " + active.probe}>{t("voyager.orbitMap.probe." + active.probe)}</span>
                <span className="oi-tag">{tag(active)}</span>
                <button type="button" className="oi-close" onClick={() => setSel(null)} aria-label="×">×</button>
              </div>
              <p className="oi-desc">{t("voyager.orbitMap.milestones." + active.id)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}