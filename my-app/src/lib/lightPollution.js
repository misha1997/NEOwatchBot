// Reads the David Lorenz Light Pollution Atlas tiles (djlorenz.github.io) —
// same free XYZ tiles used as the map overlay in DarkSkyMap.js — to estimate
// the light-pollution "zone" at one exact lat/lon, entirely client-side (no
// backend involved). CORS is open on GitHub Pages, so we can fetch the raw
// tile PNG, draw it to an off-screen canvas and read the pixel directly.
//
// The atlas's own color-scale page (djlorenz.github.io/astronomy/lp/colors.html)
// explicitly says not to conflate its "zones" with the (subjective) Bortle
// scale, so this reports the atlas's own zone code + a plain-language tier,
// never a fabricated Bortle number.
//
// Tile grid: native zoom 6, tileSize 1024 (see DarkSkyMap.js for the same
// constants used as the Leaflet overlay). A 1024px tile at zoom 6 covers
// exactly the same world-pixel grid as a standard 256px tile at zoom 8
// (256 * 2^8 === 1024 * 2^6), so plain Web Mercator math at that combined
// scale gives the tile index + in-tile pixel offset directly.
//
// NOTE: the atlas's own overlay page (djlorenz.github.io/astronomy/lp/overlay/
// dark.html) advertises `maxNativeZoom: 8`, but that's stale — probed against
// tile_{z}_{x}_{y}.png for 7 cities worldwide, z=7 and z=8 404 unconditionally
// (every x/y, every year 2016-2025); z=6 is the actual deepest zoom with real
// tiles. Leaflet's own display layer silently falls back to `errorTileUrl` on
// a 404 (so the map just shows a black patch there instead of erroring), but
// a plain fetch() has no such fallback, so this must target the zoom that
// really exists rather than the one the config claims.
//
// The atlas also publishes the same tile set for several past years, which
// getTrendAtPoint() samples to show how a point's light pollution has grown.

const TILE_ZOOM = 6;
const TILE_SIZE = 1024;
const TILE_URL = (year, x, y) =>
  `https://djlorenz.github.io/astronomy/image_tiles/tiles${year}/tile_${TILE_ZOOM}_${x}_${y}.png`;

// Years the atlas publishes as a full tile set (djlorenz.github.io/astronomy/lp/overlay/dark.html).
export const LP_YEARS = [2016, 2020, 2022, 2023, 2024, 2025];
const LATEST_YEAR = LP_YEARS[LP_YEARS.length - 1];

// Zone → RGB, sampled directly from the atlas's own legend (colorbar.png) —
// exact pixel values, not eyeballed. `tier` buckets the 15 zones into 5
// plain-language categories for the verdict card. `lpi` is the Light
// Pollution Index lower bound for that zone (artificial ÷ natural sky
// brightness — also straight off the atlas's legend), used as a numeric
// proxy for the "how has it changed over time" trend chart.
export const ZONES = [
  { zone: "0", rgb: [0, 0, 0], tier: "excellent", lpi: 0.005 },
  { zone: "1a", rgb: [34, 34, 34], tier: "excellent", lpi: 0.01 },
  { zone: "1b", rgb: [66, 66, 66], tier: "excellent", lpi: 0.06 },
  { zone: "2a", rgb: [20, 47, 114], tier: "excellent", lpi: 0.11 },
  { zone: "2b", rgb: [33, 84, 216], tier: "excellent", lpi: 0.19 },
  { zone: "3a", rgb: [15, 87, 20], tier: "good", lpi: 0.33 },
  { zone: "3b", rgb: [31, 161, 42], tier: "good", lpi: 0.58 },
  { zone: "4a", rgb: [110, 100, 30], tier: "moderate", lpi: 1.0 },
  { zone: "4b", rgb: [184, 166, 37], tier: "moderate", lpi: 1.73 },
  { zone: "5a", rgb: [191, 100, 30], tier: "bright", lpi: 3.0 },
  { zone: "5b", rgb: [253, 150, 80], tier: "bright", lpi: 5.2 },
  { zone: "6a", rgb: [251, 90, 73], tier: "poor", lpi: 9.0 },
  { zone: "6b", rgb: [251, 153, 138], tier: "poor", lpi: 15.59 },
  { zone: "7a", rgb: [160, 160, 160], tier: "poor", lpi: 27.0 },
  { zone: "7b", rgb: [242, 242, 242], tier: "poor", lpi: 46.77 },
];

// Tier display colors — a single-hue (amber), lightness-monotone ordinal
// ramp validated for the site's dark surface (#090A14) with the dataviz
// skill's validator (`--ordinal --mode dark`): lightness steps
// [0.40, 0.565, 0.665, 0.762, 0.837], all single-hue (12° spread), all
// adjacent gaps >= 0.06 L, low end clears 2:1 contrast. The darkest/most
// muted step is "excellent" (recedes — good news, no need to alarm) and the
// brightest/most saturated step is "poor" (pops — draws the eye to it).
// This replaces 5 arbitrary hand-picked hues that failed CVD separation.
export const TIER_COLORS = {
  excellent: "#5A431F",
  good: "#8A7248",
  moderate: "#B08F3E",
  bright: "#D6AC34",
  poor: "#F5C232",
};

function nearestZone(rgb) {
  let best = null;
  let bestDist = Infinity;
  for (const z of ZONES) {
    const d =
      (rgb[0] - z.rgb[0]) ** 2 + (rgb[1] - z.rgb[1]) ** 2 + (rgb[2] - z.rgb[2]) ** 2;
    if (d < bestDist) { bestDist = d; best = z; }
  }
  return best;
}

function tileForLatLon(lat, lon) {
  const worldSize = TILE_SIZE * 2 ** TILE_ZOOM;
  const siny = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const x = worldSize * (0.5 + lon / 360);
  const y = worldSize * (0.5 - Math.log((1 + siny) / (1 - siny)) / (4 * Math.PI));
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  return { tileX, tileY, px: Math.floor(x - tileX * TILE_SIZE), py: Math.floor(y - tileY * TILE_SIZE) };
}

// "year_tileX_tileY" -> Promise<CanvasRenderingContext2D|null>, so panning
// around (or checking a few nearby locations, or the multi-year trend read)
// doesn't refetch the same 1024px PNG.
const tileCache = new Map();

function loadTile(year, tileX, tileY) {
  const key = year + "_" + tileX + "_" + tileY;
  if (tileCache.has(key)) return tileCache.get(key);
  const url = TILE_URL(year, tileX, tileY);
  // fetch()+blob() rather than `new Image(); img.crossOrigin = "anonymous"`:
  // the <img> approach taints the canvas if the browser reuses a copy of the
  // same URL that Leaflet's own (non-CORS) tile <img> already cached — fetch
  // always performs a real CORS check and rejects outright on failure, and an
  // object URL built from its blob is same-origin, so the canvas it feeds is
  // never tainted regardless of what else has requested that URL.
  const p = fetch(url, { mode: "cors" })
    .then((res) => {
      if (!res.ok) throw new Error("tile fetch " + res.status);
      return res.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const img = new window.Image();
          const objectUrl = URL.createObjectURL(blob);
          img.onload = () => { resolve(img); URL.revokeObjectURL(objectUrl); };
          img.onerror = () => { reject(new Error("tile decode failed")); URL.revokeObjectURL(objectUrl); };
          img.src = objectUrl;
        })
    )
    .then((img) => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return ctx;
    })
    .catch((e) => {
      if (process.env.NODE_ENV !== "production") console.warn("lightPollution tile load failed:", url, e);
      return null;
    });
  tileCache.set(key, p);
  return p;
}

// Resolves to { zone: "4a", tier: "moderate", rgb: [r,g,b], lpi } or null if
// the tile couldn't be read (offline, blocked, or the pixel is fully
// transparent — the atlas's `black.png` error tile / no-data ocean areas).
export async function getZoneAtPoint(lat, lon, year = LATEST_YEAR) {
  const { tileX, tileY, px, py } = tileForLatLon(lat, lon);
  const max = 2 ** TILE_ZOOM - 1;
  if (tileX < 0 || tileX > max || tileY < 0 || tileY > max) return null;
  const ctx = await loadTile(year, tileX, tileY);
  if (!ctx) return null;
  let data;
  try {
    data = ctx.getImageData(px, py, 1, 1).data;
  } catch {
    return null;
  }
  if (data[3] === 0) return null;
  const match = nearestZone([data[0], data[1], data[2]]);
  return match ? { zone: match.zone, tier: match.tier, rgb: match.rgb, lpi: match.lpi } : null;
}

// One reading per atlas year at the same point — for the "how has this
// grown over time" trend chart. Resolves to
// [{ year, zone, tier, lpi } | { year, zone: null, tier: null, lpi: null }, ...],
// oldest year first, one entry per LP_YEARS even when a read fails (so the
// chart can still render an empty bar with the right year label).
export async function getTrendAtPoint(lat, lon) {
  const reads = await Promise.all(LP_YEARS.map((year) => getZoneAtPoint(lat, lon, year)));
  return LP_YEARS.map((year, i) => {
    const r = reads[i];
    return r ? { year, ...r } : { year, zone: null, tier: null, rgb: null, lpi: null };
  });
}

export { TILE_URL, TILE_ZOOM, TILE_SIZE, LATEST_YEAR };
