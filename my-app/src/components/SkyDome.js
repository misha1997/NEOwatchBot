// Homepage sky-dome radar — polar alt/az plot of the naked-eye planets
// (from /api/planets) + the ISS (client-side TLE look-angles via satellite.js).
// Port of site/assets/dome.js. Objects below the horizon are hidden; planets
// refresh every 60 s, the ISS dot every 3 s, and both refetch on loc change.
import { useEffect, useRef, useState } from "react";
import * as satellite from "satellite.js";
import i18next from "../i18n";
import { useLoc } from "../context/LocationContext";
import { getPlanets, getTle } from "../lib/api";
import { PLANET_COLORS } from "../lib/constants";

const CX = 200, CY = 200, R_HOR = 180, R_ZEN = 30;
const ISS_COLOR = "var(--gold)";

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

export default function SkyDome() {
  const { loc } = useLoc();
  const latLon = loc
    ? { lat: loc.lat, lon: loc.lon }
    : { lat: 50.45, lon: 30.52 };
  const satrecRef = useRef(null);
  const [planetDots, setPlanetDots] = useState([]);
  const [issDot, setIssDot] = useState(null);

  // Planets: fetch on loc change + refresh every 60 s.
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

  useEffect(() => {
    const tick = () => {
      const satrec = satrecRef.current;
      if (!satrec) return;
      const date = new Date();
      const pv = satellite.propagate(satrec, date);
      if (!pv || !pv.position || typeof pv.position === "boolean") return;
      const gmst = satellite.gstime(date);
      const ecf = satellite.eciToEcf(pv.position, gmst);
      const site = {
        latitude: satellite.degreesToRadians(latLon.lat),
        longitude: satellite.degreesToRadians(latLon.lon),
        height: 0,
      };
      const look = satellite.ecfToLookAngles(site, ecf);
      const elev = (look.elevation * 180) / Math.PI;
      if (elev <= 1) { setIssDot(null); return; }
      const az = (look.azimuth * 180) / Math.PI;
      const xy = altAzToXY(elev, az);
      setIssDot({ x: xy.x, y: xy.y, r: 4.5, color: ISS_COLOR, label: i18next.t("nav.iss"), sub: elev.toFixed(0) + "°" });
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [latLon.lat, latLon.lon]);

  const dots = [...planetDots, ...(issDot ? [issDot] : [])];

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
            return (
              <g key={i} className="obj-dot" style={{ color: d.color }}>
                <circle cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r} fill="currentColor" />
                <text className="obj-label" x={lx.toFixed(1)} y={(d.y + 4).toFixed(1)}
                  fill={d.color} textAnchor={d.x > CX ? "start" : "end"}>
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