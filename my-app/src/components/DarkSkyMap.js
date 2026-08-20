// Light-pollution map — Leaflet + the free David Lorenz Light Pollution Atlas
// tile overlay (djlorenz.github.io/astronomy/lp), on the same CARTO dark
// basemap used by SatMap.js. One base layer, one overlay, a marker for the
// observer's saved location, and a click-anywhere popup: reads the zone at
// the clicked point (lib/lightPollution.js, client-side, no backend) and
// draws a small inline-SVG bar chart of that point's light pollution across
// every year the atlas publishes (2016-2025), styled with a single-hue
// ordinal ramp validated for this dark surface (see TIER_COLORS).
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import L from "leaflet";
import i18next from "../i18n";
import { getZoneAtPoint, getTrendAtPoint, TIER_COLORS, LP_YEARS } from "../lib/lightPollution";

const BASE_TILE_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const BASE_TILE_ATTR = "© OpenStreetMap © CARTO";

// Same tile grid as lib/lightPollution.js (native zoom 6 — the atlas's own
// config claims 8, but z=7/8 404 everywhere; see that file's note — tileSize
// 1024, zoomOffset -2) so the visual overlay and the click-to-read pixel
// sample always agree, and so this layer doesn't request tiles that don't
// exist (Leaflet would otherwise silently paint the 404s as black patches).
const LP_YEAR = 2025;
const LP_TILE_URL = `https://djlorenz.github.io/astronomy/image_tiles/tiles${LP_YEAR}/tile_{z}_{x}_{y}.png`;
const LP_ERROR_TILE = `https://djlorenz.github.io/astronomy/image_tiles/tiles${LP_YEAR}/black.png`;
const LP_ATTR =
  'Light pollution: <a href="https://djlorenz.github.io/astronomy/lp/" target="_blank" rel="noopener">David Lorenz — Light Pollution Atlas</a>';

const KYIV = [50.45, 30.52];

// Small inline-SVG line chart (not Chart.js — the popup content is raw HTML
// Leaflet drops into the DOM, so a chart-library canvas would need awkward
// manual lifecycle management there; SVG markup just works). One series, no
// legend needed (the tier badge above names it). The line itself stays a
// single neutral color — only the entity ("light pollution here") — while
// each point is filled by its own tier, reusing the exact same encoding as
// the page legend. X spacing is proportional to the actual year, not evenly
// indexed, since the atlas's years aren't evenly spaced (2016, 2020, then
// yearly) — an evenly-spaced line would misrepresent the real gaps. Native
// <title> elements give a per-point hover tooltip for free.
function trendSvg(trend) {
  const W = 224, H = 66, PAD_L = 8, PAD_R = 8, PAD_B = 14, PAD_T = 8;
  const years = trend.map((d) => d.year);
  const yLo = years[0], yHi = years[years.length - 1];
  const ySpan = Math.max(yHi - yLo, 1);
  const logs = trend.filter((d) => d.lpi != null).map((d) => Math.log10(Math.max(d.lpi, 0.005)));
  const lo = logs.length ? Math.min(...logs) : 0;
  const hi = logs.length ? Math.max(...logs) : 1;
  const span = Math.max(hi - lo, 0.15); // keep a near-flat trend from dividing by ~0
  const plotH = H - PAD_T - PAD_B;
  const plotW = W - PAD_L - PAD_R;

  const pts = trend.map((d) => {
    const x = PAD_L + ((d.year - yLo) / ySpan) * plotW;
    if (d.lpi == null) return { x, y: null, d };
    const lg = Math.log10(Math.max(d.lpi, 0.005));
    const frac = Math.max(0, Math.min(1, (lg - lo) / span));
    const y = PAD_T + (1 - frac) * plotH;
    return { x, y, d };
  });

  const known = pts.filter((p) => p.y != null);
  const line = known.length > 1
    ? '<polyline points="' + known.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ") +
      '" fill="none" stroke="#D6AC34" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
    : "";

  let dots = "";
  pts.forEach((p) => {
    const labelY = H - 3;
    dots += '<text x="' + p.x.toFixed(1) + '" y="' + labelY +
      '" font-size="8.5" fill="#8B90AC" text-anchor="middle">\'' + String(p.d.year).slice(2) + "</text>";
    if (p.y == null) return;
    const color = TIER_COLORS[p.d.tier] || "#8B90AC";
    const tip = p.d.year + ": " + p.d.zone + " (LPI ≈ " + p.d.lpi.toFixed(2) + ")";
    dots += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) +
      '" r="3.5" fill="' + color + '" stroke="#0a0c14" stroke-width="1.5"><title>' + tip + "</title></circle>";
  });

  return (
    '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H +
    '" style="display:block;font-family:var(--font-mono,monospace)">' +
    '<line x1="' + PAD_L + '" y1="' + (H - PAD_B) + '" x2="' + (W - PAD_R) + '" y2="' + (H - PAD_B) +
    '" stroke="#2c2c2a" stroke-width="1"/>' +
    line + dots +
    "</svg>"
  );
}

function loadingHtml() {
  return '<div style="font-family:var(--font-mono,monospace);font-size:12px;min-width:180px">' +
    i18next.t("darksky.popup.loading") + "</div>";
}

function pointPopupHtml(zoneNow, trend) {
  const t = i18next.t.bind(i18next);
  if (!zoneNow) {
    return '<div style="font-family:var(--font-mono,monospace);font-size:12px;min-width:180px">' +
      t("darksky.card.zoneUnknown") + "</div>";
  }
  const color = TIER_COLORS[zoneNow.tier] || "#8B90AC";
  return (
    '<div style="font-family:var(--font-mono,monospace);min-width:236px">' +
    '<div style="font-weight:600;color:' + color + ';margin-bottom:2px">' + t("darksky.tier." + zoneNow.tier) + "</div>" +
    '<div style="font-size:11px;color:#8B90AC;margin-bottom:8px">Zone ' + zoneNow.zone + " · " + t("darksky.popup.lpi", { n: zoneNow.lpi.toFixed(2) }) + "</div>" +
    trendSvg(trend) +
    '<div style="font-size:10px;color:#8B90AC;margin-top:4px">' +
    t("darksky.popup.trend", { from: LP_YEARS[0], to: LP_YEARS[LP_YEARS.length - 1] }) +
    "</div></div>"
  );
}

const DarkSkyMap = forwardRef(function DarkSkyMap({ loc }, ref) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    invalidateSize: () => { if (mapRef.current) mapRef.current.invalidateSize(); },
  }), []);

  useEffect(() => {
    const container = elRef.current;
    if (!container) return;
    let alive = true;
    const start = loc && loc.lat != null ? [loc.lat, loc.lon] : KYIV;
    const map = L.map(container, {
      worldCopyJump: true,
      zoomControl: true,
      minZoom: 2,
      maxZoom: 10,
      zoomSnap: 0.5,
    }).setView(start, 6);

    L.tileLayer(BASE_TILE_URL, { attribution: BASE_TILE_ATTR, subdomains: "abcd", maxZoom: 10 }).addTo(map);
    L.tileLayer(LP_TILE_URL, {
      minZoom: 2,
      // The atlas's own config says 8; real deepest zoom with actual tiles
      // is 6 (z=7/8 404 everywhere — see lib/lightPollution.js). Keeping
      // this in sync with that file's TILE_ZOOM avoids black 404 patches.
      maxNativeZoom: 6,
      maxZoom: 19,
      tileSize: 1024,
      zoomOffset: -2,
      opacity: 0.55,
      errorTileUrl: LP_ERROR_TILE,
      attribution: LP_ATTR,
    }).addTo(map);

    function showPointInfo(lat, lon, latlng) {
      const popup = L.popup({ maxWidth: 260, className: "darksky-popup" })
        .setLatLng(latlng)
        .setContent(loadingHtml())
        .openOn(map);
      Promise.all([getZoneAtPoint(lat, lon), getTrendAtPoint(lat, lon)]).then(([zoneNow, trend]) => {
        if (!alive || map.hasLayer(popup) === false) return;
        popup.setContent(pointPopupHtml(zoneNow, trend));
      });
    }

    map.on("click", (e) => showPointInfo(e.latlng.lat, e.latlng.lng, e.latlng));

    markerRef.current = L.circleMarker(start, {
      radius: 7, weight: 2, color: "#fff", fillColor: "#E8B94D", fillOpacity: 1,
    }).addTo(map);
    markerRef.current.on("click", () => {
      const p = markerRef.current.getLatLng();
      showPointInfo(p.lat, p.lng, p);
    });

    mapRef.current = map;
    return () => {
      alive = false;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loc || loc.lat == null) return;
    map.setView([loc.lat, loc.lon], Math.max(map.getZoom(), 6), { animate: true });
    if (markerRef.current) markerRef.current.setLatLng([loc.lat, loc.lon]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc && loc.lat, loc && loc.lon]);

  return <div ref={elRef} className="dark-sky-map" style={{ width: "100%", height: "100%" }} />;
});

export default DarkSkyMap;
