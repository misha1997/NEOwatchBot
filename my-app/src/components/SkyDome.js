// Homepage sky-dome radar — polar alt/az plot of the naked-eye planets
// (from /api/planets) + the Sun & Moon (same endpoint, top-level `sun`/`moon`
// fields, Moon shown with its phase glyph) + the ISS (client-side TLE
// look-angles via satellite.js). Port of site/assets/dome.js. Objects below
// the horizon are hidden; planets/sun/moon refresh every 60 s, the ISS dot
// every 3 s, and all refetch on loc change.
import { useEffect, useRef, useState } from "react";
import * as satellite from "satellite.js";
import i18next from "../i18n";
import { useLoc } from "../context/LocationContext";
import { getPlanets, getTle } from "../lib/api";
import { PLANET_COLORS } from "../lib/constants";

const CX = 200, CY = 200, R_HOR = 180, R_ZEN = 30;
const ISS_COLOR = "var(--gold)";
const SUN_COLOR = "var(--gold)";

function altAzToXY(alt, az) {
  const r = R_ZEN + (R_HOR - R_ZEN) * (1 - alt / 90);
  const a = (az * Math.PI) / 180;
  return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
}
function dotRadius(mag) {
  if (mag == null) return 3;
  const r = 2.5 + (2 - mag) * 0.6;
  return Math.max(2, Math.min(6, r));
}
// phase 0..1 (0 = new, 0.5 = full, 1 = new) → phase emoji. Thresholds match
// the backend's MoonMarsAPI phase buckets so the glyph agrees with the
// /api/moon phase name shown elsewhere on the site.
function moonEmoji(phase) {
  if (phase == null) return "🌙";
  if (phase < 0.03 || phase >= 0.97) return "🌑";
  if (phase < 0.22) return "🌒";
  if (phase < 0.28) return "🌓";
  if (phase < 0.47) return "🌔";
  if (phase < 0.53) return "🌕";
  if (phase < 0.72) return "🌖";
  if (phase < 0.78) return "🌗";
  return "🌘";
}

// Topocentric alt/az (degrees) for an Earth-orbiting satrec from the
// observer's lat/lon at `date`. Returns null when SGP4 has no fix. Shared by
// the ISS dot and the visual-satellites scatter so they stay in sync.
function lookAngles(satrec, date, lat, lon) {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const gmst = satellite.gstime(date);
  const ecf = satellite.eciToEcf(pv.position, gmst);
  const site = {
    latitude: satellite.degreesToRadians(lat),
    longitude: satellite.degreesToRadians(lon),
    height: 0,
  };
  const look = satellite.ecfToLookAngles(site, ecf);
  return {
    alt: (look.elevation * 180) / Math.PI,
    az: (look.azimuth * 180) / Math.PI,
  };
}

export default function SkyDome() {
  const { loc } = useLoc();
  const latLon = loc
    ? { lat: loc.lat, lon: loc.lon }
    : { lat: 50.45, lon: 30.52 };
  const satrecRef = useRef(null);
  const visualSatsRef = useRef([]);
  const [planetDots, setPlanetDots] = useState([]);
  const [sunDot, setSunDot] = useState(null);
  const [moonDot, setMoonDot] = useState(null);
  const [satDots, setSatDots] = useState([]);
  const [issDot, setIssDot] = useState(null);

  // Planets (+ Sun/Moon): fetch on loc change + refresh every 60 s.
  useEffect(() => {
    let alive = true;
    const load = () =>
      getPlanets(latLon).then((d) => {
        if (!alive) return;
        const dots = ((d && d.items) || [])
          .filter((p) => p.alt > 1)
          .map((p) => {
            const xy = altAzToXY(p.alt, p.az);
            return {
              x: xy.x, y: xy.y, r: dotRadius(p.mag),
              color: PLANET_COLORS[p.name_key] || "var(--text)",
              label: p.name, sub: p.alt.toFixed(0) + "°",
            };
          });
        setPlanetDots(dots);

        const s = d && d.sun;
        if (s && s.alt > 1) {
          const xy = altAzToXY(s.alt, s.az);
          setSunDot({ x: xy.x, y: xy.y, r: 5, color: SUN_COLOR,
                      label: s.name, sub: s.alt.toFixed(0) + "°" });
        } else setSunDot(null);

        const m = d && d.moon;
        if (m && m.alt > 1) {
          const xy = altAzToXY(m.alt, m.az);
          setMoonDot({ x: xy.x, y: xy.y, glyph: moonEmoji(m.phase),
                       label: m.name, sub: m.alt.toFixed(0) + "°" });
        } else setMoonDot(null);
      }).catch(() => {});
    load();
    const id = setInterval(load, 60000);
    return () => { alive = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latLon.lat, latLon.lon]);

  // ISS TLE: load once (and on loc change), then propagate every 3 s.
  useEffect(() => {
    let alive = true;
    getTle("iss", 1)
      .then((d) => {
        if (!alive) return;
        const it = ((d && d.items) || [])[0];
        if (it) satrecRef.current = satellite.twoline2satrec(it.tle1, it.tle2);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Bright naked-eye satellites (Celestrak "visual" group — the same source
  // the /satellites page maps). TLE is loc-independent, so load once; the
  // ISS (NORAD 25544) is skipped because it has its own dedicated dot below.
  useEffect(() => {
    let alive = true;
    getTle("visual", 200)
      .then((d) => {
        if (!alive) return;
        const recs = ((d && d.items) || [])
          .filter((it) => it.norad_id !== 25544)
          .map((it) => {
            try {
              return { satrec: satellite.twoline2satrec(it.tle1, it.tle2), name: it.name };
            } catch (e) { return null; }
          })
          .filter(Boolean);
        if (alive) visualSatsRef.current = recs;
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // ISS dot + visual-satellite scatter: recompute every 3 s for the observer.
  useEffect(() => {
    const tick = () => {
      const date = new Date();

      // ISS
      const issRec = satrecRef.current;
      if (issRec) {
        const la = lookAngles(issRec, date, latLon.lat, latLon.lon);
        if (!la || la.alt <= 1) setIssDot(null);
        else {
          const xy = altAzToXY(la.alt, la.az);
          setIssDot({ x: xy.x, y: xy.y, r: 4.5, color: ISS_COLOR,
                      label: i18next.t("nav.iss"), sub: la.alt.toFixed(0) + "°" });
        }
      }

      // Visible satellites above the horizon. Keep the highest dozen so the
      // small dome stays readable; they render as faint unlabeled dots behind
      // the named objects.
      const recs = visualSatsRef.current;
      if (recs.length) {
        const out = [];
        for (const s of recs) {
          const la = lookAngles(s.satrec, date, latLon.lat, latLon.lon);
          if (!la || la.alt <= 5) continue;
          const xy = altAzToXY(la.alt, la.az);
          out.push({ x: xy.x, y: xy.y, r: 2.4, kind: "sat", elev: la.alt,
                     label: s.name, sub: la.alt.toFixed(0) + "°" });
        }
        out.sort((a, b) => b.elev - a.elev);
        setSatDots(out.slice(0, 12));
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [latLon.lat, latLon.lon]);

  const dots = [
    ...satDots,
    ...planetDots,
    ...(sunDot ? [sunDot] : []),
    ...(moonDot ? [moonDot] : []),
    ...(issDot ? [issDot] : []),
  ];

  return (
    <div className="dome-wrap" aria-hidden="true">
      <svg viewBox="0 0 400 400">
        <circle className="dome-ring" cx="200" cy="200" r="180" />
        <circle className="dome-ring" cx="200" cy="200" r="130" />
        <circle className="dome-ring" cx="200" cy="200" r="80" />
        <circle className="dome-ring" cx="200" cy="200" r="30" />
        <line className="dome-radial" x1="200" y1="20" x2="200" y2="380" />
        <line className="dome-radial" x1="20" y1="200" x2="380" y2="200" />
        <line className="dome-radial" x1="73" y1="73" x2="327" y2="327" />
        <line className="dome-radial" x1="327" y1="73" x2="73" y2="327" />
        <text className="dome-cardinal" x="196" y="14" textAnchor="middle">{i18next.t("sky.dome.N")}</text>
        <text className="dome-cardinal" x="196" y="394" textAnchor="middle">{i18next.t("sky.dome.S")}</text>
        <text className="dome-cardinal" x="388" y="204" textAnchor="end">{i18next.t("sky.dome.E")}</text>
        <text className="dome-cardinal" x="12" y="204">{i18next.t("sky.dome.W")}</text>
        <text className="dome-label" x="200" y="70" textAnchor="middle">30°</text>
        <text className="dome-label" x="200" y="120" textAnchor="middle">60°</text>
        <text className="dome-label" x="200" y="170" textAnchor="middle">{i18next.t("sky.dome.zenith")}</text>
        <g id="dome-objects">
          {dots.map((d, i) => {
            const lx = d.x > CX ? d.x + 8 : d.x - 8;
            const anchor = d.x > CX ? "start" : "end";
            // Background satellites: small faint dot + a label in the same
            // dim color, offset to the side like the other object labels.
            if (d.kind === "sat") {
              return (
                <g key={i} className="dome-sat-grp">
                  <circle className="dome-sat" cx={d.x.toFixed(1)}
                    cy={d.y.toFixed(1)} r={d.r} />
                  <text className="dome-sat-label" x={lx.toFixed(1)}
                    y={(d.y + 3.5).toFixed(1)} textAnchor={anchor}>
                    {d.label}{d.sub ? " " + d.sub : ""}
                  </text>
                </g>
              );
            }
            // Moon: render the phase emoji as a glyph at its position instead
            // of a plain dot, so the dome shows the current phase at a glance.
            if (d.glyph) {
              return (
                <g key={i} className="obj-dot dome-moon">
                  <text className="dome-glyph" x={(d.x - 7).toFixed(1)}
                    y={(d.y + 6).toFixed(1)} aria-hidden="true">{d.glyph}</text>
                  <text className="obj-label" x={lx.toFixed(1)} y={(d.y + 4).toFixed(1)}
                    fill="var(--text)" textAnchor={anchor}>
                    {d.label}{d.sub ? " " + d.sub : ""}
                  </text>
                </g>
              );
            }
            return (
              <g key={i} className="obj-dot" style={{ color: d.color }}>
                {/* Sun: faint corona ring around the disk */}
                {d === sunDot && (
                  <circle cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r + 3}
                    fill="none" stroke={d.color} strokeOpacity="0.3" strokeWidth="1" />
                )}
                <circle cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r} fill="currentColor" />
                <text className="obj-label" x={lx.toFixed(1)} y={(d.y + 4).toFixed(1)}
                  fill={d.color} textAnchor={anchor}>
                  {d.label}{d.sub ? " " + d.sub : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}