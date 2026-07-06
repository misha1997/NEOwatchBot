// Live satellite map — Leaflet + satellite.js (TLE propagation in the
// browser). Port of site/assets/sat-map.js. The browser propagates each
// satellite's TLE itself every second, so markers move in real time with no
// per-frame API calls. Click a marker for a popup (name, NORAD id, altitude,
// velocity, subpoint).
//
// Imperative by design: Leaflet mutates the DOM directly, so the map is built
// once in a mount effect and exposed to the parent through a ref handle
// (addGroup/removeGroup/setFollow/redrawTrack + the live `sats` array). This
// faithfully reproduces the legacy NEOwatch.SatMap.create() API.
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import * as satellite from "satellite.js";
import i18next from "../i18n";
import { getTle, getTleGroups } from "../lib/api";

const TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTR = "© OpenStreetMap © CARTO · TLE: Celestrak";

function propagate(satrec, date) {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  if (!geo) return null;
  const v = pv.velocity || {};
  const vel = Math.sqrt((v.x || 0) ** 2 + (v.y || 0) ** 2 + (v.z || 0) ** 2);
  return {
    lat: satellite.degreesLat(geo.latitude),
    lon: satellite.degreesLong(geo.longitude),
    alt: geo.height, // km
    vel, // km/s
  };
}

function fmtLatLon(lat, lon) {
  return (
    Math.abs(lat).toFixed(2) + "°" + (lat >= 0 ? i18next.t("common.compass.N") : i18next.t("common.compass.S")) + " · " +
    Math.abs(lon).toFixed(2) + "°" + (lon >= 0 ? i18next.t("common.compass.E") : i18next.t("common.compass.W"))
  );
}

function popupHtml(sat, p) {
  const row = (k, vv) =>
    '<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;margin:2px 0">' +
    '<span style="color:var(--text-dim)">' + k + '</span><span>' + vv + "</span></div>";
  return (
    '<div style="font-family:var(--font-mono,monospace);min-width:200px">' +
    '<div style="color:' + sat.color + ';font-weight:600;margin-bottom:4px">' + sat.name + "</div>" +
    '<div style="color:#000;font-size:11px;margin-bottom:8px">' +
    sat.groupLabel + " · NORAD " + sat.norad + "</div>" +
    row(i18next.t("sat.popup.altitude"), p.alt.toFixed(1) + " " + i18next.t("common.units.km")) +
    row(i18next.t("sat.popup.velocity"), p.vel.toFixed(2) + " " + i18next.t("common.units.km_s")) +
    row(i18next.t("sat.popup.subpoint"), fmtLatLon(p.lat, p.lon)) +
    row(i18next.t("sat.popup.updated"), new Date().toLocaleTimeString(i18next.language === "en" ? "en-US" : "uk-UA")) +
    "</div>"
  );
}

function splitAntimeridian(pts) {
  const segs = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    if (cur.length && Math.abs(pts[i][1] - cur[cur.length - 1][1]) > 180) {
      segs.push(cur); cur = [];
    }
    cur.push(pts[i]);
  }
  if (cur.length) segs.push(cur);
  return segs;
}

const SatMap = forwardRef(function SatMap(
  { groups = ["iss"], limit = 300, follow = false, track = false, lang, onReady, onCount, onTick },
  ref
) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const satsRef = useRef([]);
  const groupMetaRef = useRef({});
  const trackLayerRef = useRef(null);
  const footprintRef = useRef(null);
  const followRef = useRef(follow);
  const followTickRef = useRef(0);
  const tickIdRef = useRef(null);
  const trackIdRef = useRef(null);
  const readyRef = useRef(false);
  // Latest callbacks/flags kept in refs so the mount effect sees fresh values.
  const cbRef = useRef({ onReady, onCount, onTick, track });
  cbRef.current = { onReady, onCount, onTick, track };
  const methodsRef = useRef({});

  useImperativeHandle(ref, () => ({
    get sats() { return satsRef.current; },
    addGroup: (k) => methodsRef.current.addGroup ? methodsRef.current.addGroup(k) : Promise.resolve(),
    removeGroup: (k) => methodsRef.current.removeGroup && methodsRef.current.removeGroup(k),
    setFollow: (v) => { followRef.current = !!v; },
    redrawTrack: () => methodsRef.current.redrawTrack && methodsRef.current.redrawTrack(),
  }), []);

  useEffect(() => {
    const container = elRef.current;
    if (!container) return;
    const map = L.map(container, {
      preferCanvas: true,
      worldCopyJump: true,
      zoomControl: true,
      minZoom: 2,
      maxZoom: 8,
      zoomSnap: 0.5,
    }).setView([30, 30], 3);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: "abcd", maxZoom: 8 }).addTo(map);
    mapRef.current = map;
    let alive = true; // flipped false on cleanup so late async callbacks bail

    map.on("dragstart zoomstart", () => { followRef.current = false; });

    const sats = satsRef.current;

    getTleGroups(lang).then((list) => {
      if (!alive) return;
      list.forEach((g) => { groupMetaRef.current[g.key] = g; });
    }).catch(() => {});

    function emitCount() {
      if (cbRef.current.onCount) cbRef.current.onCount(sats.length);
    }

    function loadGroup(key) {
      return getTle(key, limit, lang).then((data) => {
        if (!alive) return; // map may have been torn down (StrictMode remount / unmount)
        const color = (data.color || (groupMetaRef.current[key] || {}).color) || "#E8B94D";
        (data.items || []).forEach((it) => {
          let satrec;
          try { satrec = satellite.twoline2satrec(it.tle1, it.tle2); } catch (e) { return; }
          if (!satrec) return;
          const marker = L.circleMarker([0, 0], {
            radius: key === "iss" ? 6 : 3.5,
            color, weight: 1, fillColor: color, fillOpacity: 0.9, interactive: true,
          });
          marker.addTo(map);
          marker.bindPopup("", { maxWidth: 280 });
          marker.on("popupopen", (e) => {
            const sat = e.target._neosat;
            if (!sat) return;
            const p = propagate(sat.satrec, new Date());
            if (p) e.target.setPopupContent(popupHtml(sat, p));
          });
          sats.push({
            satrec, name: it.name, norad: it.norad_id,
            group: key, groupLabel: data.label, marker, color,
          });
        });
        if (!readyRef.current && sats.length) {
          readyRef.current = true;
          if (cbRef.current.onReady) cbRef.current.onReady(sats.length);
        }
        emitCount();
        return data;
      });
    }

    function drawTrack() {
      if (!alive || !cbRef.current.track || !sats.length) return;
      const sat = sats[0];
      if (trackLayerRef.current) { map.removeLayer(trackLayerRef.current); trackLayerRef.current = null; }
      if (footprintRef.current) { map.removeLayer(footprintRef.current); footprintRef.current = null; }
      const pts = [];
      const start = new Date();
      for (let off = 0; off <= 95 * 60; off += 90) {
        const p = propagate(sat.satrec, new Date(start.getTime() + off * 1000));
        if (p) pts.push([p.lat, p.lon]);
      }
      const segments = splitAntimeridian(pts);
      trackLayerRef.current = L.polyline(segments.length > 1 ? segments : pts, {
        color: sat.color, weight: 1, opacity: 0.5, dashArray: "4 4",
      }).addTo(map);
      const now = propagate(sat.satrec, new Date());
      if (now) {
        const radiusKm = Math.max(900, Math.sqrt(now.alt) * 950);
        footprintRef.current = L.circle([now.lat, now.lon], {
          radius: radiusKm * 1000, color: sat.color, weight: 1,
          opacity: 0.35, fillOpacity: 0.06,
        }).addTo(map);
      }
    }

    function tick() {
      if (!alive) return;
      const date = new Date();
      let firstMoved = null;
      for (const s of sats) {
        const p = propagate(s.satrec, date);
        if (!p) continue;
        s.marker.setLatLng([p.lat, p.lon]);
        s.marker._neosat = s;
        s._last = p;
        if (!firstMoved) firstMoved = s;
      }
      if (followRef.current && firstMoved && firstMoved._last && (++followTickRef.current % 3 === 0)) {
        map.panTo([firstMoved._last.lat, firstMoved._last.lon], { animate: true, duration: 1.2 });
      }
      if (cbRef.current.onTick && firstMoved) {
        cbRef.current.onTick(firstMoved._last, sats);
      }
    }

    // Expose imperative methods to the parent (via the methodsRef the handle reads).
    methodsRef.current = {
      addGroup: (key) => { if (!alive) return Promise.resolve(); return loadGroup(key).then(() => { tick(); }); },
      removeGroup: (key) => {
        if (!alive) return;
        for (let i = sats.length - 1; i >= 0; i--) {
          if (sats[i].group === key) { map.removeLayer(sats[i].marker); sats.splice(i, 1); }
        }
        emitCount();
      },
      redrawTrack: drawTrack,
    };

    // Kick off: load all requested groups, then animate.
    Promise.all(groups.map(loadGroup)).then(() => {
      if (!alive) return;
      tick();
      tickIdRef.current = setInterval(tick, 1000);
      if (cbRef.current.track) { drawTrack(); trackIdRef.current = setInterval(drawTrack, 60000); }
      if (cbRef.current.onReady && !readyRef.current) cbRef.current.onReady(sats.length);
    }).catch((e) => { console.warn("sat-map load:", e); });

    return () => {
      alive = false;
      if (tickIdRef.current) clearInterval(tickIdRef.current);
      if (trackIdRef.current) clearInterval(trackIdRef.current);
      tickIdRef.current = null;
      trackIdRef.current = null;
      map.remove();
      mapRef.current = null;
      sats.length = 0;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={elRef} className="sat-map" style={{ width: "100%", height: "100%" }} />;
});

export default SatMap;