// Day/night terminator map — Leaflet + the client-side subsolar-point math in
// lib/terminator.js (no backend call; recomputes every tick so it stays live
// without polling). Same CARTO dark basemap as SatMap.js/DarkSkyMap.js, a
// semi-transparent night-hemisphere polygon, a small Sun marker at the
// subsolar point, and the observer's own location marker (from `loc`).
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import L from "leaflet";
import { getSubsolarPoint, getNightPolygon } from "../lib/terminator";

const BASE_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const BASE_TILE_ATTR = "© OpenStreetMap © CARTO";
const KYIV = [50.45, 30.52];
const TICK_MS = 60000; // subsolar point moves ~0.25°/min — a minute is plenty

const EarthTerminatorMap = forwardRef(function EarthTerminatorMap({ loc }, ref) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const nightRef = useRef(null);
  const sunRef = useRef(null);
  const locMarkerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    invalidateSize: () => { if (mapRef.current) mapRef.current.invalidateSize(); },
  }), []);

  useEffect(() => {
    const container = elRef.current;
    if (!container) return;
    let alive = true;
    const map = L.map(container, {
      worldCopyJump: true,
      zoomControl: true,
      minZoom: 1,
      maxZoom: 6,
      zoomSnap: 0.5,
    }).setView([15, 10], 2);

    L.tileLayer(BASE_TILE_URL, { attribution: BASE_TILE_ATTR, subdomains: "abcd", maxZoom: 6 }).addTo(map);

    const sunIcon = L.divIcon({
      className: "earth-sun-marker",
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#FFD37A;box-shadow:0 0 14px 4px rgba(255,211,122,.65)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    function draw() {
      if (!alive) return;
      const sun = getSubsolarPoint();
      const ring = getNightPolygon();
      if (nightRef.current) map.removeLayer(nightRef.current);
      nightRef.current = L.polygon(ring, {
        color: "transparent",
        fillColor: "#05060f",
        fillOpacity: 0.55,
        stroke: false,
      }).addTo(map);
      if (!sunRef.current) {
        sunRef.current = L.marker([sun.lat, sun.lon], { icon: sunIcon, interactive: false }).addTo(map);
      } else {
        sunRef.current.setLatLng([sun.lat, sun.lon]);
      }
    }

    draw();
    const id = setInterval(draw, TICK_MS);

    mapRef.current = map;
    return () => {
      alive = false;
      clearInterval(id);
      map.remove();
      mapRef.current = null;
      nightRef.current = null;
      sunRef.current = null;
      locMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loc || loc.lat == null) return;
    if (!locMarkerRef.current) {
      locMarkerRef.current = L.circleMarker([loc.lat, loc.lon], {
        radius: 6, weight: 2, color: "#fff", fillColor: "#4FD1C5", fillOpacity: 1,
      }).addTo(map);
    } else {
      locMarkerRef.current.setLatLng([loc.lat, loc.lon]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc && loc.lat, loc && loc.lon]);

  return <div ref={elRef} className="earth-terminator-map" style={{ width: "100%", height: "100%" }} />;
});

EarthTerminatorMap.defaultProps = { loc: { lat: KYIV[0], lon: KYIV[1] } };

export default EarthTerminatorMap;
