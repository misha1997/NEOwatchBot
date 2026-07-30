// Fullscreen PixiJS view of Neptune's moon system.
//
// This is a separate immersive mode for the existing `/planetarium/neptune` page.
// The inline SVG widget (`#moon-system` in Neptune.js) is left untouched; this
// component is opened from a fullscreen button inside that widget's controls.
//
// Architecture mirrors `JupiterMoonSystemFullscreen.js` exactly (stable-ref ticker,
// camera easing + clamp, wheel/drag/pinch, keyboard nav, starfield, annular orbit
// hit, LOD-gated constant-screen strokes, planet+moon photo cross-fade, honest
// "no resolved image" placeholder), parameterized with Neptune data.
//
// Data model (mirrors the backend `services/neptune.py` / the SVG widget):
//   moons[]: { name, name_uk, group, a_km, period_d, e, i_deg, prograde,
//             m0_deg, diameter_km }
// Coordinate model (same as Neptune.js):
//   EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
//   daysSinceEpoch = (Date.now() - EPOCH_MS) / 86400000
//   simDays = ((t - t0) / 1000) * TIME_SCALE
//   total = daysSinceEpoch + simDays
//   Keplerian position (see lib/kepler.js):
//     M = m0_rad + n * total            (mean anomaly; n = 2π / period_d)
//     E from M = E - e·sin(E)            (Newton iteration)
//     ν from E                            (true anomaly)
//     r = a_world * (1 - e·cos E)        (focus distance; a_world = rMax·a/aMax)
//     angle = sgn * (ν + ω)              (ω = synthetic perihelion arg, 0 if e≈0)
//     x = SYS.cx + r * cos(angle)
//     y = SYS.cy - r * sin(angle)
//   sgn = prograde ? 1 : -1. e = 0 ⇒ a uniform circle (same as the old model).
//
// Scene graph:
//   app.stage
//    └─ world (Container)          // camera transform: position + scale
//        ├─ neptuneDisc (Graphics) // true-scale planet disc
//        ├─ orbits (Container)     // Keplerian orbit ellipses (positioned +
//        │                          //   rotated Graphics; strokes redrawn/LOD)
//        └─ moons (Container)      // one Container per moon
//            └─ moon[i]: Container { dot, label, photoSprite, placeholder }
//
// LOD (level of detail) by camera.zoom:
//   - far:    colored dot only
//   - medium: dot + name label
//   - close:  real photo Sprite if one exists (Triton), otherwise an honest
//             placeholder stating that no resolved image is available.
//
// Lifecycle notes:
//   - Pixi Application is created on mount and destroyed (`app.destroy(true, ...)`)
//     on unmount to avoid WebGL context leaks when the modal is opened/closed
//     repeatedly.
//   - `app.ticker` runs while the component is mounted and visible; it is
//     stopped on `document.visibilitychange` when the tab goes to background.
//   - Orbit Graphics are drawn once; only moon positions are updated each frame.
//
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import * as PIXI from "pixi.js";
import { useApi } from "../hooks/useApi";
import { getNeptune } from "../lib/api";
import { perihelionArg, orbitEllipse, keplerXY } from "../lib/kepler";
import "../styles/planetarium.css";

// ---------------------------------------------------------------------------
// Constants shared with the SVG widget in Neptune.js
// ---------------------------------------------------------------------------
const SYS = { vb: 640, cx: 320, cy: 320, rMin: 32, rMax: 300 };
const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const TIME_SCALE = 0.1; // 1 real second ≈ 0.1 simulated days
const NEPTUNE_RADIUS_KM = 24622;

// Group order used by the SVG widget (and by prev/next navigation here).
const GROUPS = ["inner", "triton", "nereid", "outer"];

// ---------------------------------------------------------------------------
// Fullscreen-specific visual constants
// ---------------------------------------------------------------------------
// Margin around the world when fitting to the viewport.
const FIT_MARGIN = 0.92;
// The default (initial + reset) view sits this many times closer than the
// full-system fit zoom (≈69% in) so the inner system reads clearly on open.
const DEFAULT_VIEW_BOOST = 1.69;
// Orbit radius mapping: r = rMax * (a / aMax) ^ ORBIT_POWER. TRUE linear
// (power 1) is the honest geometry — distances between orbits are correct at
// every zoom level. Neptune's span is ~1000× (Naiad 48 227 km .. Neso
// ~48.4M km), so the inner moons cluster tightly at the centre at the default
// fit zoom; deep zoom (ZOOM_IN_FACTOR) reveals them at true scale.
const ORBIT_POWER = 1;

// Neptune's faint planetary rings (true radii in km), drawn at the SAME linear
// world mapping as the moon orbits. Because they sit at 42 000–63 000 km —
// between the planet (R 24 622 km) and the inner moons (Naiad 48 227 km ...) —
// they map to ~0.26–0.39 world units and only resolve when the camera zooms
// into the inner system (the small SVG minimap can't show them: at its scale
// they're sub-pixel, like the planet disc and inner moons). `w_km` is the ring's
// physical width; it sets the stroke width so broad rings (Galle, Lassell) read
// as bands at deep zoom while narrow ones stay ~1 px lines. The narrow, brighter
// rings (Le Verrier, Adams — the one carrying the arcs) get a higher alpha.
// Sources: NASA NSSDC Neptunian Rings Fact Sheet; Rings of Neptune (Wikipedia).
const NEPTUNE_RINGS = [
  { key: "galle",     r_km: 42000, w_km: 2000, alpha: 0.16 },
  { key: "leverrier", r_km: 53200, w_km: 100,  alpha: 0.50 },
  { key: "lassell",   r_km: 55200, w_km: 4000, alpha: 0.10 },
  { key: "arago",     r_km: 57200, w_km: 100,  alpha: 0.34 },
  { key: "adams",     r_km: 62933, w_km: 50,   alpha: 0.55 },
];
const RING_COLOR = 0x6fa8e8; // Neptune blue accent (matches the disc outline)
// Zoom limits, as multiples of the default (fit-system) zoom. Neptune needs a
// deep max zoom: its inner→outer span is ~1000× (Naiad 48 227 km .. Neso
// ~48.4M km), so the inner moons orbit at a tiny fraction of the outer radius
// and only a very deep zoom reveals them at true scale.
const ZOOM_OUT_FACTOR = 0.85; // farthest: system a bit smaller than fit
const ZOOM_IN_FACTOR = 800; // closest: very deep zoom to inspect the inner system
// LOD thresholds, expressed as multiples of the default (fit-system) zoom.
const LOD_LABEL_FACTOR = 8; // names appear once zoomed in past 8x
// Photo cross-fade window: as you zoom in, each dot dissolves into a real
// photo of that moon. Pushed high so photos only appear once Neptune itself
// is drawn at a comparable-or-larger screen size.
const LOD_PHOTO_START = 25; // photo begins fading in
const LOD_PHOTO_END = 50; // photo fully replaces the dot
// Photo sizing: the sprite is scaled to PHOTO_MULT × the dot's on-screen
// diameter, clamped to [PHOTO_MIN_PX, PHOTO_MAX_PX].
const PHOTO_MULT = 5;
const PHOTO_MIN_PX = 26;
const PHOTO_MAX_PX = 90;
// Planet photo cross-fade: as you zoom in, the flat Neptune disc dissolves
// into the real planet image (/planets/Neptune.png). The flat disc fades out
// 1:1 as the photo fades in.
const LOD_PLANET_START = 15; // planet photo begins fading in
const LOD_PLANET_END = 30; // planet photo fully replaces the flat disc
// Dot sizing: the dot radius in world units is the TRUE body radius on the
// same scale as the Neptune disc. Clamped on screen to [DOT_MIN_PX, DOT_MAX_PX]
// so tiny moons stay visible at low zoom while big moons grow realistically.
const DOT_MIN_PX = 1.5;
const DOT_MAX_PX = 14;
// Neptune disc: drawn at true scale but clamped to a min on-screen radius so
// the planet stays identifiable at the default fit zoom, and grows to its
// real relative size as you zoom in.
const DISC_MIN_PX = 4;
// Close-up zoom target when flying to a moon (multiples of default zoom).
// Kept inside [ZOOM_OUT_FACTOR, ZOOM_IN_FACTOR] and past LOD_PHOTO_END so the
// focused moon's photo is fully resolved on arrival.
const FOCUS_ZOOM_FACTOR = 150;
// Camera easing duration (ms).
const CAMERA_EASE_MS = 700;
// Easing function: easeInOutCubic.
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Moon name keys that have unique, specific photographs in `/moons/*.png`.
// Only Triton has a resolved image; every other moon gets the honest
// "no resolved image" placeholder.
const UNIQUE_MOONS = new Set(["naiad", "thalassa", "despina", "galatea", "larissa", "proteus", "triton", "nereid"]);

function getNameHash(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return hash;
}

function getMoonTextureUrl(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (UNIQUE_MOONS.has(key)) {
    return `/moons/${key}.png`;
  }
  return `/moons/default_minor.png`;
}


// Helpers for formatting numeric values (same helpers as Neptune.js).
function spacer(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
function fmtA(a) {
  return a >= 1e6
    ? (a / 1e6).toFixed(2) + " млн км"
    : spacer(Math.round(a)) + " км";
}
function fmtP(p) {
  return p < 1 ? (p * 24).toFixed(1) + " год" : p.toFixed(2) + " діб";
}

// Annular hit area for an orbit ring: a hit registers only when the pointer is
// near the ellipse CURVE (within a normalized radial tolerance `tol`), NOT in
// the interior — so hovering Neptune or the inner system doesn't trigger every
// nested orbit. `tol` is updated each LOD pass to keep the hit band roughly
// constant in screen pixels (≈6 px) regardless of zoom. For a circle (a=b=r)
// this reduces to |distance − r| ≤ tol·r.
function RingHit(a, b) {
  this.a = a;
  this.b = b;
  this.tol = 0.04;
}
RingHit.prototype.contains = function (x, y) {
  const a = this.a;
  const b = this.b;
  if (a <= 0 || b <= 0) return false;
  const rho = Math.sqrt((x * x) / (a * a) + (y * y) / (b * b));
  return Math.abs(rho - 1) <= this.tol;
};

// Build a high-resolution polygon approximating an ellipse, as a flat
// [x,y, x,y, ...] number array for `Graphics.drawPolygon`. Pixi's built-in
// drawCircle/drawEllipse derive their segment count from the WORLD radius
// (`ceil(2.3·√(rx+ry))`), which collapses to just a handful of segments for
// the tiny inner orbits (Naiad orbits at ~0.29 world units → an octagon) and
// shows visible straight edges at deep zoom. Sampling our own polygon with a
// high, radius-aware segment count keeps every orbit smooth at every zoom.
function ellipsePolygonPoints(rx, ry) {
  const segs = Math.max(
    480,
    Math.min(1024, Math.round(Math.sqrt(Math.max(rx, ry)) * 32))
  );
  const pts = new Array(segs * 2);
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts[i * 2] = rx * Math.cos(a);
    pts[i * 2 + 1] = ry * Math.sin(a);
  }
  return pts;
}

// Configure an orbit Graphics for the given display mode (see
// JupiterMoonSystemFullscreen.setupOrbitGraphics for the full contract).
function setupOrbitGraphics(g, m, mode) {
  g._oc = m.color;
  let rx, ry, ecx, ecy, rot;
  if (mode === "circle") {
    rx = ry = m.r;
    ecx = SYS.cx;
    ecy = SYS.cy;
    rot = 0;
  } else {
    const oe = orbitEllipse({ e: m.e, R: m.r, omega: m.omega }, SYS.cx, SYS.cy);
    rx = oe.rx;
    ry = oe.ry;
    ecx = oe.ecx;
    ecy = oe.ecy;
    rot = oe.rot;
  }
  g._a = rx;
  g._b = ry;
  g.position.set(ecx, ecy);
  g.rotation = rot;
  g._polyPts = ellipsePolygonPoints(rx, ry);
  g.clear();
  g.lineStyle(1, m.color, 0.25);
  g.drawPolygon(g._polyPts);
  if (!g._hit) g._hit = new RingHit(g._a, g._b);
  else {
    g._hit.a = g._a;
    g._hit.b = g._b;
  }
  g.hitArea = g._hit;
  g.eventMode = "static";
  g.cursor = "pointer";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NeptuneMoonSystemFullscreen({ onClose, initialMoonKey = null }) {
  const { t } = useTranslation();
  const { data } = useApi(getNeptune, { deps: [] });

  // Root container refs.
  const wrapRef = useRef(null);
  const canvasWrapRef = useRef(null);

  // Pinch tracking (two-finger zoom). Map pointerId -> {x, y}.
  const pinchRef = useRef(new Map());

  // Mutable refs read by the stable Pixi ticker.
  const appRef = useRef(null);
  const worldRef = useRef(null);
  const moonsContainerRef = useRef(null);
  const moonItemsRef = useRef([]);
  // Tracks which initialMoonKey we've already flown to, so a [geo] rebuild
  // (data load) doesn't re-trigger the fly-to more than once per open.
  const initialFocusRef = useRef(null);
  const textureCacheRef = useRef({});
  const starsContainerRef = useRef(null); // screen-space starfield, behind the world
  const twinkleStarsRef = useRef([]); // bright stars animated each frame
  const discRef = useRef(null); // Neptune disc Graphics (redrawn each LOD pass)
  const discRRef = useRef(0); // true-scale disc radius in world units
  const orbitsRef = useRef(null); // orbit circles Container (strokes redrawn each LOD pass)
  const ringsRef = useRef(null); // planetary rings Container (redrawn each LOD pass)
  const discPhotoRef = useRef(null); // Neptune photo Sprite (cross-fades in on zoom)
  const discPhotoStateRef = useRef({ loaded: false, loading: false, texMax: 1 });
  const planetGlowRef = useRef(null); // soft halo behind the Neptune photo
  const sizeRef = useRef({ width: 0, height: 0 });
  const defaultZoomRef = useRef(1);
  // Last camera zoom processed by the LOD pass. NaN forces a refresh next frame.
  const lastZoomRef = useRef(NaN);
  const dragRef = useRef(null);
  const simRef = useRef({ t0: performance.now(), paused: false, pausedAt: 0 });
  const cameraRef = useRef({
    x: SYS.cx,
    y: SYS.cy,
    zoom: 1,
    startX: SYS.cx,
    startY: SYS.cy,
    startZoom: 1,
    targetX: SYS.cx,
    targetY: SYS.cy,
    targetZoom: 1,
    animStart: null,
  });

  // React state for UI re-renders.
  const [orbitsPaused, setOrbitsPaused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  // Orbit display mode: "kepler" (real-eccentricity ellipses, variable speed)
  // or "circle" (simplified circles, uniform speed). Default is "circle" (the
  // simplified overview); the user can toggle to accurate Keplerian ellipses.
  // Read by the ticker via the ref so it doesn't have to be re-created on toggle.
  const [orbitMode, setOrbitMode] = useState("circle");
  const orbitModeRef = useRef(orbitMode);
  orbitModeRef.current = orbitMode;

  // Derived geometry. Orbit radii use TRUE linear mapping (ORBIT_POWER=1) so
  // distances are honest at every zoom. Each moon's dot radius (`dotR`) is on
  // the SAME true-size scale as the Neptune disc. All 16 Neptune moons carry
  // a diameter, so dotR is the real body radius; a small fallback covers any
  // future moon missing one.
  const moons = useMemo(() => data?.moons ?? [], [data]);
  const geo = useMemo(() => {
    if (!moons.length) return [];
    const as = moons.map((m) => m.a_km);
    const aMax = Math.max(...as);
    const getBodyR_km = (m) => {
      if (m.diameter_km != null) return m.diameter_km / 2;
      return 2;
    };
    return moons.map((m) => {
      const r = SYS.rMax * Math.pow(m.a_km / aMax, ORBIT_POWER);
      const sgn = m.prograde ? 1 : -1;
      const dotR = SYS.rMax * getBodyR_km(m) / aMax;
      const color = m.prograde ? 0x4fd1c5 : 0xff7f6e; // --teal / --coral as hex
      const isPhotoMoon = m.name.toLowerCase() === "triton";
      const hash = getNameHash(m.name);
      const rot = isPhotoMoon ? 0 : (Math.abs(hash) % 360) * (Math.PI / 180);
      const flipX = isPhotoMoon ? 1 : (hash & 1 ? -1 : 1);
      const flipY = isPhotoMoon ? 1 : (hash & 2 ? -1 : 1);
      const scaleMult = isPhotoMoon ? 1.0 : 0.85 + (Math.abs(hash % 100) / 100) * 0.3;

      const tints = [0xffffff, 0xf2ebe1, 0xe1e6ec, 0xebebeb, 0xf6ebd8];
      const tint = isPhotoMoon ? 0xffffff : tints[Math.abs(hash) % tints.length];

      const hasPhoto = UNIQUE_MOONS.has(m.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const omega = (m.e || 0) < 0.001 ? 0 : perihelionArg(m.name);

      return { ...m, r, sgn, dotR, color, hasPhoto, omega, rot, flipX, flipY, scaleMult, tint };
    });
  }, [moons]);

  // Mirror geo into a ref so the orbit-mode toggle effect can read the latest
  // geometry without depending on it.
  const geoRef = useRef(geo);
  geoRef.current = geo;

  const discR = useMemo(() => {
    const aMax = moons.length ? Math.max(...moons.map((m) => m.a_km)) : 50624000;
    return SYS.rMax * Math.pow(NEPTUNE_RADIUS_KM / aMax, ORBIT_POWER);
  }, [moons]);

  // Sorted index list for prev/next navigation: groups inner→outer, then by
  // a_km inside each group.
  const orderedIndices = useMemo(() => {
    const order = new Map(GROUPS.map((g, i) => [g, i]));
    return geo
      .map((m, i) => ({ i, g: order.get(m.group) ?? 99, a: m.a_km }))
      .sort((a, b) => a.g - b.g || a.a - b.a)
      .map((x) => x.i);
  }, [geo]);

  // -------------------------------------------------------------------------
  // Camera helpers
  // -------------------------------------------------------------------------
  const clampZoom = (z) => {
    const lo = defaultZoomRef.current * ZOOM_OUT_FACTOR;
    const hi = defaultZoomRef.current * ZOOM_IN_FACTOR;
    return Math.max(lo, Math.min(hi, z));
  };
  const clampCameraTarget = (x, y) => {
    const margin = SYS.vb * 0.4;
    return {
      x: Math.max(SYS.cx - margin, Math.min(SYS.cx + margin, x)),
      y: Math.max(SYS.cy - margin, Math.min(SYS.cy + margin, y)),
    };
  };
  const applyCamera = () => {
    const world = worldRef.current;
    const { width, height } = sizeRef.current;
    if (!world || !width || !height) return;
    const cam = cameraRef.current;
    world.position.set(width / 2 - cam.x * cam.zoom, height / 2 - cam.y * cam.zoom);
    world.scale.set(cam.zoom);
  };
  const startCameraAnimation = (targetX, targetY, targetZoom) => {
    const cam = cameraRef.current;
    const clamped = clampCameraTarget(targetX, targetY);
    cam.startX = cam.x;
    cam.startY = cam.y;
    cam.startZoom = cam.zoom;
    cam.targetX = clamped.x;
    cam.targetY = clamped.y;
    cam.targetZoom = clampZoom(targetZoom);
    cam.animStart = performance.now();
  };

  // -------------------------------------------------------------------------
  // Initialize / destroy Pixi application
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!wrapRef.current) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    sizeRef.current = { width, height };

    const app = new PIXI.Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    appRef.current = app;
    canvasWrapRef.current.appendChild(app.view);

    // Allow the stage to receive pointer events for panning (drag background).
    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    const world = new PIXI.Container();
    app.stage.addChild(world);
    worldRef.current = world;

    // Background starfield. Lives in screen space (added behind the world,
    // never scaled/panned by the camera) so the stars stay fixed while the
    // moon system is explored. Rebuilt on resize to fill the viewport.
    const stars = new PIXI.Container();
    stars.name = "stars";
    app.stage.addChildAt(stars, 0);
    starsContainerRef.current = stars;

    const buildStars = (w, h) => {
      stars.removeChildren();
      const faint = new PIXI.Graphics();
      const density = Math.round((w * h) / 5200);
      for (let i = 0; i < density; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const r = Math.random() < 0.85 ? 0.6 : 1.0;
        const a = 0.2 + Math.random() * 0.5;
        faint.beginFill(0xffffff, a);
        faint.drawCircle(x, y, r);
        faint.endFill();
      }
      stars.addChild(faint);
      const twinkle = [];
      for (let i = 0; i < 26; i++) {
        const g = new PIXI.Graphics();
        const r = 0.8 + Math.random() * 0.8;
        g.beginFill(0xffffff, 1);
        g.drawCircle(0, 0, r);
        g.endFill();
        g.position.set(Math.random() * w, Math.random() * h);
        stars.addChild(g);
        twinkle.push({
          g,
          phase: Math.random() * Math.PI * 2,
          speed: 0.4 + Math.random() * 1.1,
        });
      }
      twinkleStarsRef.current = twinkle;
    };
    buildStars(width, height);

    // Neptune disc (true scale, drawn once here; the ticker redraws it each
    // LOD pass with a min on-screen radius so it stays visible at fit zoom and
    // grows to its real relative size as you zoom in).
    const planetGlow = new PIXI.Graphics();
    planetGlow.visible = false;
    world.addChild(planetGlow); // behind the disc → only the outer halo shows
    planetGlowRef.current = planetGlow;
    const disc = new PIXI.Graphics();
    disc.beginFill(0x2e5cc9);
    disc.drawCircle(SYS.cx, SYS.cy, discR);
    disc.endFill();
    disc.lineStyle(1.5, 0x6fa8e8, 0.6);
    disc.drawCircle(SYS.cx, SYS.cy, discR);
    world.addChild(disc);
    discRef.current = disc;
    discRRef.current = discR;

    // Neptune photo sprite: cross-fades in over the flat disc as you zoom in.
    // Sized each LOD pass to the disc diameter so it tracks the true-scale disc.
    const discPhoto = new PIXI.Sprite(PIXI.Texture.EMPTY);
    discPhoto.anchor.set(0.5);
    discPhoto.position.set(SYS.cx, SYS.cy);
    discPhoto.visible = false;
    world.addChild(discPhoto);
    discPhotoRef.current = discPhoto;
    const loadDiscPhoto = async () => {
      const st = discPhotoStateRef.current;
      if (st.loading || st.loaded) return;
      st.loading = true;
      try {
        const tex = await PIXI.Assets.load("/planets/Neptune.png");
        const dp = discPhotoRef.current;
        if (dp) dp.texture = tex;
        st.texMax = Math.max(tex.width, tex.height) || 1;
        st.loaded = true;
        lastZoomRef.current = NaN; // force an LOD refresh so the photo shows
      } catch {
        /* planet photo is optional — fall back to the flat disc */
      } finally {
        st.loading = false;
      }
    };

    // Orbit ellipses (positioned + rotated Graphics, redrawn each LOD pass).
    const orbits = new PIXI.Container();
    orbits.name = "orbits";
    world.addChild(orbits);

    // Moons container.
    const moonsContainer = new PIXI.Container();
    moonsContainer.name = "moons";
    world.addChild(moonsContainer);
    moonsContainerRef.current = moonsContainer;

    // Initial camera: center world on screen. defaultZoomRef is the full-system
    // fit zoom (the LOD/clamp baseline); the camera starts DEFAULT_VIEW_BOOST
    // closer so the inner system reads better on open.
    const fitZoom = Math.min(width, height) / SYS.vb * FIT_MARGIN;
    defaultZoomRef.current = fitZoom;
    const startZoom = fitZoom * DEFAULT_VIEW_BOOST;
    const cam = cameraRef.current;
    cam.zoom = startZoom;
    cam.startZoom = startZoom;
    cam.targetZoom = startZoom;
    cam.x = SYS.cx;
    cam.y = SYS.cy;
    cam.startX = SYS.cx;
    cam.startY = SYS.cy;
    cam.targetX = SYS.cx;
    cam.targetY = SYS.cy;
    applyCamera();

    // Lazy photo loader (called from ticker when LOD threshold is crossed).
    const loadMoonPhoto = async (item) => {
      if (item.photoLoading || item.photoLoaded) return;
      item.photoLoading = true;
      const url = getMoonTextureUrl(item.data.name);
      if (textureCacheRef.current[url]) {
        item.photo.texture = textureCacheRef.current[url];
        item.photoLoaded = true;
        item.photoLoading = false;
        lastZoomRef.current = NaN; // force an LOD refresh so the photo shows
        return;
      }
      try {
        const texture = await PIXI.Assets.load(url);
        textureCacheRef.current[url] = texture;
        item.photo.texture = texture;
        item.photoLoaded = true;
        const maxWorldSize = 24;
        item.photoBaseScale =
          maxWorldSize / Math.max(texture.width, texture.height);
        lastZoomRef.current = NaN; // force an LOD refresh so the photo shows
      } catch (err) {
        console.error("Failed to load moon texture", url, err);
      } finally {
        item.photoLoading = false;
      }
    };

    // Ticker: updates star twinkle, moon positions, camera easing, and LOD.
    // It reads refs only so it never needs to be re-created.
    const ticker = () => {
      const a = appRef.current;
      if (!a) return;
      const now = performance.now();

      // Twinkle the bright background stars.
      const tw = twinkleStarsRef.current;
      if (tw.length) {
        const tt = now / 1000;
        for (const s of tw) {
          s.g.alpha = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(tt * s.speed + s.phase));
        }
      }

      const w = worldRef.current;
      const items = moonItemsRef.current;
      if (!w || !items.length) return;

      const cam = cameraRef.current;
      const sim = simRef.current;

      // Advance simulation time unless paused.
      let simDays;
      if (sim.paused) {
        simDays = sim.pausedAt;
      } else {
        simDays = ((now - sim.t0) / 1000) * TIME_SCALE;
        sim.pausedAt = simDays;
      }
      const daysSinceEpoch = (Date.now() - EPOCH_MS) / 86400000;
      const totalDays = daysSinceEpoch + simDays;

      // Moon positions. "kepler" ⇒ real-eccentricity ellipses with variable
      // angular speed (2nd law), Neptune at the focus. "circle" ⇒ simplified
      // uniform circular motion (radius = semi-major axis). e ≈ 0 moons are
      // identical in both.
      const kp = [0, 0];
      const circleMode = orbitModeRef.current === "circle";
      for (const item of items) {
        const m = item.data;
        if (circleMode) {
          const ang =
            (m.sgn * (m.m0_deg + (360 / m.period_d) * totalDays) * Math.PI) / 180;
          item.container.position.set(
            SYS.cx + m.r * Math.cos(ang),
            SYS.cy - m.r * Math.sin(ang)
          );
        } else {
          keplerXY(m, totalDays, SYS.cx, SYS.cy, kp);
          item.container.position.set(kp[0], kp[1]);
        }
      }

      // Camera easing.
      if (cam.animStart !== null) {
        const elapsed = now - cam.animStart;
        const t = Math.min(1, elapsed / CAMERA_EASE_MS);
        const et = easeInOutCubic(t);
        cam.x = cam.startX + (cam.targetX - cam.startX) * et;
        cam.y = cam.startY + (cam.targetY - cam.startY) * et;
        cam.zoom = cam.startZoom + (cam.targetZoom - cam.startZoom) * et;
        if (t >= 1) cam.animStart = null;
        applyCamera();
      }

      // LOD + overlay sizing. Gated on `zoomChanged` (thresholded) so the orbit
      // ellipses + dots are NOT cleared+redrawn every frame while the zoom is
      // steady. Moon positions above still update every frame.
      const prevLod = lastZoomRef.current;
      const zoomChanged =
        isNaN(prevLod) ||
        Math.abs(cam.zoom - prevLod) > Math.max(0.5, prevLod * 0.01);
      if (zoomChanged) lastZoomRef.current = cam.zoom;
      if (!zoomChanged) return;

      const defZoom = defaultZoomRef.current || 1;
      const zoomNorm = cam.zoom / defZoom;
      const showLabel = zoomNorm >= LOD_LABEL_FACTOR;
      const inv = 1 / cam.zoom;

      // Photo cross-fade alpha across the [LOD_PHOTO_START, LOD_PHOTO_END] window.
      const photoAlpha = Math.max(
        0,
        Math.min(
          1,
          (zoomNorm - LOD_PHOTO_START) / (LOD_PHOTO_END - LOD_PHOTO_START)
        )
      );

      // Orbit rings: redraw with a stroke of `inv` world units so the line
      // stays a constant ~1 px on screen at any zoom. Drawn as a pre-sampled
      // high-resolution polygon (g._polyPts) so the curve stays smooth at deep
      // zoom — drawCircle/drawEllipse would show straight edges here. A hovered
      // or selected ring (_hl/_sel) gets a thicker, brighter stroke. The
      // annular hit tolerance is refreshed to ~6 px screen so ring hover/click
      // stays usable at every zoom.
      const oc = orbitsRef.current;
      if (oc) {
        const kids = oc.children;
        for (let i = 0; i < kids.length; i++) {
          const g = kids[i];
          g.clear();
          if (g._hl || g._sel) g.lineStyle(2.5 * inv, g._oc, 0.6);
          else g.lineStyle(inv, g._oc, 0.25);
          g.drawPolygon(g._polyPts);
          if (g._hit) g._hit.tol = Math.min(0.5, (6 * inv) / (g._a || 1));
        }
      }

      // Planetary rings: redraw with a stroke of max(inv, physical width) so
      // each ring stays ≥1 px on screen and the broad rings (Galle, Lassell)
      // widen into visible bands as you zoom in. Constant screen thickness at
      // any zoom, same scheme as the orbit strokes above.
      const rc = ringsRef.current;
      if (rc) {
        const rkids = rc.children;
        for (let i = 0; i < rkids.length; i++) {
          const g = rkids[i];
          g.clear();
          g.lineStyle(Math.max(inv, g._wWorld), g._color, g._alpha);
          g.drawPolygon(g._pts);
        }
      }

      // Neptune disc: true-scale world radius, clamped to a min on-screen
      // radius. As the real planet photo fades in (planetAlpha), the flat disc
      // fades out 1:1 so they cross-fade rather than stack.
      const disc = discRef.current;
      const discR0 = discRRef.current;
      const discWorldR =
        disc && discR0 ? Math.max(DISC_MIN_PX, discR0 * cam.zoom) * inv : 0;
      const planetAlpha = Math.max(
        0,
        Math.min(
          1,
          (zoomNorm - LOD_PLANET_START) / (LOD_PLANET_END - LOD_PLANET_START)
        )
      );
      if (disc) {
        disc.clear();
        disc.beginFill(0x2e5cc9);
        disc.drawCircle(SYS.cx, SYS.cy, discWorldR);
        disc.endFill();
        disc.lineStyle(1.5 * inv, 0x6fa8e8, 0.6);
        disc.drawCircle(SYS.cx, SYS.cy, discWorldR);
        disc.alpha = 1 - planetAlpha;
      }
      // Real planet photo: lazy-loads the first time the zoom window opens,
      // then is scaled each pass to the disc diameter and cross-faded in.
      const dp = discPhotoRef.current;
      const dps = discPhotoStateRef.current;
      if (dp) {
        if (planetAlpha > 0) {
          if (dps.loaded) {
            dp.visible = true;
            dp.alpha = planetAlpha;
            dp.scale.set((2 * discWorldR) / (dps.texMax || 1));
          } else if (!dps.loading) {
            loadDiscPhoto();
          }
        } else {
          dp.visible = false;
        }
      }
      // Soft halo behind the Neptune photo: concentric faint rings (gradient,
      // not a solid disc) tinted blue. Fades with the photo cross-fade.
      const pg = planetGlowRef.current;
      if (pg) {
        pg.clear();
        if (planetAlpha > 0 && discWorldR > 0) {
          pg.visible = true;
          const cx = SYS.cx, cy = SYS.cy;
          pg.beginFill(0x6fa8e8, 0.05 * planetAlpha);
          pg.drawCircle(cx, cy, discWorldR * 1.35);
          pg.endFill();
          pg.beginFill(0x6fa8e8, 0.07 * planetAlpha);
          pg.drawCircle(cx, cy, discWorldR * 1.22);
          pg.endFill();
          pg.beginFill(0x6fa8e8, 0.09 * planetAlpha);
          pg.drawCircle(cx, cy, discWorldR * 1.12);
          pg.endFill();
        } else {
          pg.visible = false;
        }
      }

      for (const item of items) {
        const m = item.data;

        // True-size dot, clamped on screen to [DOT_MIN_PX, DOT_MAX_PX].
        const dotScreenPx = Math.max(
          DOT_MIN_PX,
          Math.min(DOT_MAX_PX, m.dotR * cam.zoom)
        );
        const dotRadius = dotScreenPx * inv;

        // Label: constant screen size, shown once zoomed in past the threshold.
        item.label.visible = showLabel;
        item.label.scale.set(inv);

        // Photo: fade in over the zoom window, sized relative to the dot. The
        // texture loads lazily the first time the window opens; until it
        // resolves the dot stays fully opaque (no gap). Only moons with a real
        // photo (Triton) get a sprite; the rest render the placeholder below.
        let pa = 0;
        if (m.hasPhoto) {
          if (item.photoLoaded) pa = photoAlpha;
          else if (photoAlpha > 0 && !item.photoLoading) loadMoonPhoto(item);
        }
        item.photo.visible = pa > 0;
        item.photo.alpha = pa;
        if (pa > 0 && item.photoBaseScale) {
          const photoScreenPx = Math.max(
            PHOTO_MIN_PX,
            Math.min(PHOTO_MAX_PX, dotScreenPx * PHOTO_MULT)
          );
          const baseScale = item.photoBaseScale * (photoScreenPx / 24) * inv * m.scaleMult;
          item.photo.scale.set(
            baseScale * m.flipX,
            baseScale * m.flipY
          );
          // Soft halo behind the moon photo, tinted with the moon's colour.
          const pgm = item.photoGlow;
          if (pgm) {
            pgm.clear();
            pgm.visible = true;
            const gR = (photoScreenPx * 0.5) * inv;
            pgm.beginFill(m.color, 0.06 * pa);
            pgm.drawCircle(0, 0, gR * 1.35);
            pgm.endFill();
            pgm.beginFill(m.color, 0.08 * pa);
            pgm.drawCircle(0, 0, gR * 1.22);
            pgm.endFill();
            pgm.beginFill(m.color, 0.10 * pa);
            pgm.drawCircle(0, 0, gR * 1.12);
            pgm.endFill();
          }
        } else if (item.photoGlow) {
          item.photoGlow.visible = false;
          item.photoGlow.clear();
        }

        // No-photo moons stay plain dots at every zoom level (matches Jupiter:
        // the honest "no resolved image" message lives in the detail card, not
        // on the map).
        item.placeholder.visible = false;

        // Dot fades out as the photo fades in.
        item.dot.visible = true;
        item.dot.alpha = 1 - pa;
        item.dot.clear();
        // Subtle always-on glow halo — fades with the dot as the photo fades in.
        item.dot.beginFill(m.color, 0.22);
        item.dot.drawCircle(0, 0, dotRadius * 1.9);
        item.dot.endFill();
        item.dot.beginFill(m.color);
        item.dot.drawCircle(0, 0, dotRadius);
        item.dot.endFill();
        // Keep the click hit area a constant ~14 px on screen regardless of zoom.
        if (item.dotHit) item.dotHit.radius = 14 * inv;
      }
    };
    app.ticker.add(ticker);

    // Pointer / wheel interactions are attached to the Pixi canvas so that
    // moon sprites still receive their own pointer events (click to focus).
    const view = app.view;
    const screenToWorld = (sx, sy) => {
      return {
        x: (sx - world.position.x) / world.scale.x,
        y: (sy - world.position.y) / world.scale.y,
      };
    };
    const doWheel = (e) => {
      e.preventDefault();
      const rect = view.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const before = screenToWorld(sx, sy);
      const factor = e.deltaY < 0 ? 1.22 : 0.82;
      const newZoom = clampZoom(cam.zoom * factor);
      const tx = before.x - (before.x - cam.x) * (newZoom / cam.zoom);
      const ty = before.y - (before.y - cam.y) * (newZoom / cam.zoom);
      const clamped = clampCameraTarget(tx, ty);
      cam.x = clamped.x;
      cam.y = clamped.y;
      cam.targetX = clamped.x;
      cam.targetY = clamped.y;
      cam.targetZoom = newZoom;
      cam.animStart = null;
      cam.zoom = newZoom;
      applyCamera();
    };

    // Drag (single pointer) and pinch (two pointers) handling.
    const doPointerDown = (e) => {
      if (e.button !== 0) return;
      const pointers = pinchRef.current;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        dragRef.current = {
          screenX: e.clientX,
          screenY: e.clientY,
          camX: cam.x,
          camY: cam.y,
        };
      }
      cam.animStart = null;
    };

    const doPointerMove = (e) => {
      const pointers = pinchRef.current;
      if (!pointers.has(e.pointerId)) return;
      const old = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        const d = dragRef.current;
        if (!d) return;
        const rect = view.getBoundingClientRect();
        const dx = ((e.clientX - d.screenX) / rect.width) * SYS.vb;
        const dy = ((e.clientY - d.screenY) / rect.height) * SYS.vb;
        const rawX = d.camX - dx / cam.zoom;
        const rawY = d.camY - dy / cam.zoom;
        const clamped = clampCameraTarget(rawX, rawY);
        cam.x = clamped.x;
        cam.y = clamped.y;
        cam.targetX = clamped.x;
        cam.targetY = clamped.y;
        cam.targetZoom = cam.zoom;
        cam.animStart = null;
        applyCamera();
        return;
      }

      // Pinch: compute center and scale change between the two pointers.
      if (pointers.size !== 2) return;
      const pts = Array.from(pointers.values());
      const [p1New, p2New] = pts;
      const [p1Old, p2Old] = [old, pts.find((p) => p !== old) || pts[1]];
      const oldDist = Math.hypot(p2Old.x - p1Old.x, p2Old.y - p1Old.y);
      const newDist = Math.hypot(p2New.x - p1New.x, p2New.y - p1New.y);
      if (!oldDist || !newDist) return;
      const factor = newDist / oldDist;
      const centerX = (p1New.x + p2New.x) / 2;
      const centerY = (p1New.y + p2New.y) / 2;
      const rect = view.getBoundingClientRect();
      const sx = centerX - rect.left;
      const sy = centerY - rect.top;
      const before = screenToWorld(sx, sy);
      const newZoom = clampZoom(cam.zoom * factor);
      const tx = before.x - (before.x - cam.x) * (newZoom / cam.zoom);
      const ty = before.y - (before.y - cam.y) * (newZoom / cam.zoom);
      const clamped = clampCameraTarget(tx, ty);
      cam.x = clamped.x;
      cam.y = clamped.y;
      cam.targetX = clamped.x;
      cam.targetY = clamped.y;
      cam.targetZoom = newZoom;
      cam.animStart = null;
      cam.zoom = newZoom;
      applyCamera();
    };

    const doPointerUp = (e) => {
      dragRef.current = null;
      pinchRef.current.delete(e.pointerId);
    };

    view.addEventListener("wheel", doWheel, { passive: false });
    view.addEventListener("pointerdown", doPointerDown);
    window.addEventListener("pointermove", doPointerMove);
    window.addEventListener("pointerup", doPointerUp);
    window.addEventListener("pointercancel", doPointerUp);

    // Event handlers.
    const onResize = () => {
      if (!wrapRef.current || !appRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const h = Math.max(1, Math.floor(r.height));
      appRef.current.renderer.resize(w, h);
      appRef.current.stage.hitArea = appRef.current.screen;
      sizeRef.current = { width: w, height: h };
      buildStars(w, h);
      applyCamera();
    };
    const onVis = () => {
      if (!appRef.current) return;
      if (document.hidden) appRef.current.ticker.stop();
      else appRef.current.ticker.start();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") navigatePrevRef.current?.();
      else if (e.key === "ArrowRight") navigateNextRef.current?.();
      else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePauseRef.current?.();
      }
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("keydown", onKey);
      view.removeEventListener("wheel", doWheel);
      view.removeEventListener("pointerdown", doPointerDown);
      window.removeEventListener("pointermove", doPointerMove);
      window.removeEventListener("pointerup", doPointerUp);
      window.removeEventListener("pointercancel", doPointerUp);
      app.ticker.remove(ticker);
      // Destroy the application and all its WebGL resources/children.
      app.destroy(true, { children: true, texture: true, baseTexture: true });
      appRef.current = null;
      worldRef.current = null;
      moonsContainerRef.current = null;
      moonItemsRef.current = [];
      textureCacheRef.current = {};
      starsContainerRef.current = null;
      twinkleStarsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build / rebuild scene when derived geometry changes (data loaded).
  useEffect(() => {
    if (!appRef.current || !geo.length) return;

    const world = worldRef.current;
    const orbits = world.children.find((c) => c.name === "orbits");
    const moonsContainer = world.children.find((c) => c.name === "moons");
    const rings = world.children.find((c) => c.name === "rings");

    // Clear old content and free Pixi resources.
    if (orbits) {
      orbits.removeChildren();
      orbits.destroy({ children: true, texture: true, baseTexture: true });
    }
    if (rings) {
      rings.removeChildren();
      rings.destroy({ children: true, texture: true, baseTexture: true });
    }
    if (moonsContainer) {
      const oldChildren = moonsContainer.children.slice();
      moonsContainer.removeChildren();
      for (const child of oldChildren) {
        child.destroy({ children: true, texture: false, baseTexture: false });
      }
    }
    moonItemsRef.current = [];

    // Recreate orbits container.
    const newOrbits = new PIXI.Container();
    newOrbits.name = "orbits";
    world.addChildAt(newOrbits, 1);
    orbitsRef.current = newOrbits;

    // Planetary rings: faint circles at true linear world radii, interleaved
    // with the inner moon orbits (Galle inside Naiad; Adams between Galatea and
    // Larissa). Strokes are redrawn each LOD pass to stay a constant screen
    // thickness; broad rings (Galle, Lassell) widen into bands at deep zoom.
    // Placed below the moons so dots/photos render on top.
    const newRings = new PIXI.Container();
    newRings.name = "rings";
    const aMax = geo.length ? Math.max(...geo.map((m) => m.a_km)) : 1;
    for (const ring of NEPTUNE_RINGS) {
      const rWorld = (SYS.rMax * Math.pow(ring.r_km / aMax, ORBIT_POWER)) || 0.0001;
      const g = new PIXI.Graphics();
      g.position.set(SYS.cx, SYS.cy);
      g._pts = ellipsePolygonPoints(rWorld, rWorld);
      g._wWorld = (SYS.rMax * ring.w_km) / aMax; // physical width in world units
      g._color = RING_COLOR;
      g._alpha = ring.alpha;
      g.lineStyle(1, RING_COLOR, ring.alpha);
      g.drawPolygon(g._pts);
      newRings.addChild(g);
    }
    world.addChild(newRings);
    ringsRef.current = newRings;

    // Recreate moons container.
    const newMoonsContainer = new PIXI.Container();
    newMoonsContainer.name = "moons";
    world.addChild(newMoonsContainer);
    moonsContainerRef.current = newMoonsContainer;

    // Clicking a moon opens its description card and flies the camera to it.
    const onMoonTap = (index) => {
      setSelectedIndex(index);
      flyToMoon(index);
    };

    for (let idx = 0; idx < geo.length; idx++) {
      const m = geo[idx];

      // Orbit ring.
      const g = new PIXI.Graphics();
      g._hl = false;
      g._sel = idx === selectedIndex;
      setupOrbitGraphics(g, m, orbitModeRef.current);
      g.on("pointerover", () => {
        g._hl = true;
        lastZoomRef.current = NaN; // force a redraw so the thick stroke shows
      });
      g.on("pointerout", () => {
        g._hl = false;
        lastZoomRef.current = NaN;
      });
      g.on("pointertap", () => onMoonTap(idx));
      newOrbits.addChild(g);

      // Moon container.
      const mc = new PIXI.Container();
      mc.name = m.name;
      newMoonsContainer.addChild(mc);

      // Dot. hitArea is a reusable Circle whose radius the ticker updates each
      // LOD pass to keep the click target a constant ~14 px on screen.
      const dotHit = new PIXI.Circle(0, 0, 14);
      const dot = new PIXI.Graphics();
      dot.beginFill(m.color);
      dot.drawCircle(0, 0, 3);
      dot.endFill();
      dot.eventMode = "static";
      dot.cursor = "pointer";
      dot.hitArea = dotHit;
      dot.on("pointertap", () => onMoonTap(idx));
      mc.addChild(dot);

      // Label.
      const label = new PIXI.Text(m.name_uk || m.name, {
        fontFamily: "var(--font-mono), monospace",
        fontSize: 13,
        fill: 0xedeff8,
        dropShadow: true,
        dropShadowColor: 0x000000,
        dropShadowBlur: 3,
        dropShadowDistance: 0,
        dropShadowAlpha: 0.7,
      });
      label.anchor.set(0.5, -0.4);
      label.visible = false;
      label.eventMode = "static";
      label.cursor = "pointer";
      const lw = label.width;
      const lh = label.height;
      label.hitArea = new PIXI.Rectangle(-lw / 2, 0.4 * lh, lw, lh);
      label.on("pointertap", () => onMoonTap(idx));
      mc.addChild(label);

      // Photo sprite (texture loaded lazily).
      const photoGlow = new PIXI.Graphics();
      photoGlow.visible = false;
      mc.addChild(photoGlow); // behind the photo → only the outer halo shows
      const photo = new PIXI.Sprite(PIXI.Texture.EMPTY);
      photo.anchor.set(0.5);
      photo.visible = false;
      photo.rotation = m.rot;
      photo.tint = m.tint;
      photo.eventMode = "static";
      photo.cursor = "pointer";
      photo.on("pointertap", () => onMoonTap(idx));
      mc.addChild(photo);

      // Placeholder for moons without real photos (honest "no image").
      const placeholder = new PIXI.Container();
      placeholder.visible = false;
      placeholder.eventMode = "static";
      placeholder.cursor = "pointer";
      placeholder.hitArea = new PIXI.Circle(0, 0, 28);
      const phCircle = new PIXI.Graphics();
      phCircle.lineStyle(1.5, 0xedeff8, 0.25);
      phCircle.beginFill(0x14182b, 0.55);
      phCircle.drawCircle(0, 0, 26);
      phCircle.endFill();
      placeholder.addChild(phCircle);
      const phIcon = new PIXI.Text("✕", {
        fontFamily: "var(--font-mono), monospace",
        fontSize: 18,
        fill: 0xedeff8,
        align: "center",
      });
      phIcon.anchor.set(0.5);
      placeholder.addChild(phIcon);
      placeholder.on("pointertap", () => onMoonTap(idx));
      mc.addChild(placeholder);

      moonItemsRef.current.push({
        index: idx,
        data: m,
        container: mc,
        dot,
        dotHit,
        label,
        photo,
        photoGlow,
        placeholder,
        photoLoaded: false,
        photoLoading: false,
      });
    }

    // Update disc radius in case the data set changed.
    discRRef.current = discR;
    const disc = discRef.current || world.children[0];
    if (disc && disc instanceof PIXI.Graphics) {
      disc.clear();
      disc.beginFill(0x2e5cc9);
      disc.drawCircle(SYS.cx, SYS.cy, discR);
      disc.endFill();
      disc.lineStyle(1.5, 0x6fa8e8, 0.6);
      disc.drawCircle(SYS.cx, SYS.cy, discR);
    }

    applyCamera();
    // Force an LOD pass next frame.
    lastZoomRef.current = NaN;
    // If opened from a page card with a requested moon, fly to it now that the
    // scene, moon items and camera baseline are all ready. Guarded so a [geo]
    // rebuild only fires once per open.
    if (initialMoonKey && geo.length && initialFocusRef.current !== initialMoonKey) {
      const idx = geo.findIndex((m) => m.name.toLowerCase() === initialMoonKey);
      if (idx >= 0) {
        initialFocusRef.current = initialMoonKey;
        setSelectedIndex(idx);
        // Defer one frame: moon containers are created at position (0,0) and are
        // only placed on their live orbits by the ticker on the next frame.
        // Without this, flyToMoon would read (0,0) and fly to the world origin.
        requestAnimationFrame(() => flyToMoon(idx));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  // Orbit-mode toggle: re-configure the EXISTING orbit Graphics in place (no
  // container rebuild → no photo reload / label re-raster), then force a LOD
  // refresh. The moon position loop reads orbitModeRef, so motion switches on
  // the next frame with no extra work here.
  useEffect(() => {
    const oc = orbitsRef.current;
    const garr = geoRef.current;
    if (!oc || !garr.length) return;
    const kids = oc.children;
    for (let i = 0; i < kids.length && i < garr.length; i++) {
      setupOrbitGraphics(kids[i], garr[i], orbitMode);
    }
    lastZoomRef.current = NaN;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbitMode]);

  // Keep the SELECTED moon's orbit highlighted (thick) for as long as it is
  // selected. Forces a LOD refresh so the stroke change shows immediately.
  useEffect(() => {
    const oc = orbitsRef.current;
    if (!oc) return;
    const kids = oc.children;
    for (let i = 0; i < kids.length; i++) kids[i]._sel = false;
    if (selectedIndex != null && kids[selectedIndex]) {
      kids[selectedIndex]._sel = true;
    }
    lastZoomRef.current = NaN;
  }, [selectedIndex]);

  // -------------------------------------------------------------------------
  // Navigation: opens the description card AND flies the camera to the moon.
  // -------------------------------------------------------------------------
  const flyToMoon = (index) => {
    const items = moonItemsRef.current;
    if (!items[index]) return;
    const targetX = items[index].container.position.x;
    const targetY = items[index].container.position.y;
    startCameraAnimation(
      targetX,
      targetY,
      defaultZoomRef.current * FOCUS_ZOOM_FACTOR
    );
  };

  const navigatePrev = () => {
    if (!orderedIndices.length) return;
    const current =
      selectedIndex != null ? orderedIndices.indexOf(selectedIndex) : 0;
    const next = (current - 1 + orderedIndices.length) % orderedIndices.length;
    const idx = orderedIndices[next];
    setSelectedIndex(idx);
    flyToMoon(idx);
  };
  const navigatePrevRef = useRef(navigatePrev);
  navigatePrevRef.current = navigatePrev;

  const navigateNext = () => {
    if (!orderedIndices.length) return;
    const current =
      selectedIndex != null ? orderedIndices.indexOf(selectedIndex) : -1;
    const next = (current + 1) % orderedIndices.length;
    const idx = orderedIndices[next];
    setSelectedIndex(idx);
    flyToMoon(idx);
  };
  const navigateNextRef = useRef(navigateNext);
  navigateNextRef.current = navigateNext;

  const togglePause = () => {
    const sim = simRef.current;
    setOrbitsPaused((p) => {
      const next = !p;
      sim.paused = next;
      if (next) {
        sim.pausedAt = ((performance.now() - sim.t0) / 1000) * TIME_SCALE;
      } else {
        sim.t0 = performance.now() - (sim.pausedAt / TIME_SCALE) * 1000;
      }
      return next;
    });
  };
  const togglePauseRef = useRef(togglePause);
  togglePauseRef.current = togglePause;

  const resetView = () => {
    startCameraAnimation(SYS.cx, SYS.cy, defaultZoomRef.current * DEFAULT_VIEW_BOOST);
    setSelectedIndex(null);
  };

  // Programmatic zoom toward the current screen centre (used by the ＋/－
  // buttons).
  const zoomBy = (factor) => {
    const cam = cameraRef.current;
    startCameraAnimation(cam.x, cam.y, clampZoom(cam.zoom * factor));
  };

  // -------------------------------------------------------------------------
  // Body scroll lock while modal is open
  // -------------------------------------------------------------------------
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const selected = selectedIndex != null ? geo[selectedIndex] : null;

  return createPortal(
    <div ref={wrapRef} className="jms-fullscreen-wrap" role="dialog" aria-modal="true" aria-label={t("neptune.system.fullscreenTitle")}>
      <div ref={canvasWrapRef} className="jms-canvas-wrap" />

      {/* Top-left header / close */}
      <div className="jms-top-bar">
        <div>
          <div className="jms-title">{t("neptune.system.title")}</div>
          <div className="jms-sub">
            {t("neptune.system.eyebrow", { count: moons.length || 0 })}
          </div>
        </div>
        <button className="jms-btn jms-btn-close" onClick={onClose} aria-label={t("jupiter.system.close")}>
          ✕
        </button>
      </div>

      {/* Playback / navigation controls */}
      <div className="jms-controls">
        <button className="jms-btn" onClick={togglePause} aria-label={orbitsPaused ? t("jupiter.system.play") : t("jupiter.system.pause")}>
          {orbitsPaused ? "▶" : "⏸"}
        </button>
        <button className="jms-btn" onClick={navigatePrev} aria-label={t("jupiter.system.prev")}>‹</button>
        <select
          className="jms-select"
          value={selectedIndex ?? ""}
          onChange={(e) => {
            const idx = e.target.value === "" ? null : Number(e.target.value);
            if (idx != null) {
              setSelectedIndex(idx);
              flyToMoon(idx);
            }
          }}
          aria-label={t("jupiter.system.selectMoon")}
        >
          <option value="">{t("jupiter.system.selectMoon")}</option>
          {orderedIndices.map((idx) => {
            const m = geo[idx];
            return (
              <option key={m.name} value={idx}>
                {m.name_uk || m.name}
              </option>
            );
          })}
        </select>
        <button className="jms-btn" onClick={navigateNext} aria-label={t("jupiter.system.next")}>›</button>
        <button className="jms-btn" onClick={() => zoomBy(1.25)} aria-label={t("jupiter.system.zoomIn")}>＋</button>
        <button className="jms-btn" onClick={() => zoomBy(0.8)} aria-label={t("jupiter.system.zoomOut")}>－</button>
        <button className="jms-btn" onClick={resetView} aria-label={t("jupiter.system.zoomReset")}>↺</button>
        <button
          className="jms-btn jms-btn-toggle"
          onClick={() => setOrbitMode((m) => (m === "kepler" ? "circle" : "kepler"))}
          aria-label={t("jupiter.system.orbitModeToggle")}
          title={t("jupiter.system.orbitModeToggle")}
        >
          {orbitMode === "kepler" ? t("jupiter.system.orbitModeKepler") : t("jupiter.system.orbitModeCircle")}
        </button>
      </div>

      {/* Selected-moon detail card (HTML overlay for accessibility) */}
      {selected && (
        <div className="jms-card" onClick={(e) => e.stopPropagation()}>
          <button className="jms-card-close" onClick={() => setSelectedIndex(null)} aria-label={t("jupiter.system.close")}>✕</button>
          <h3>{selected.name_uk || selected.name}</h3>
          {selected.hasPhoto ? (
            <div className="jms-card-photo-wrap" style={{ overflow: "hidden" }}>
              <img
                src={getMoonTextureUrl(selected.name)}
                alt={selected.name_uk || selected.name}
                className="jms-card-photo"
                style={{
                  transform: `rotate(${selected.rot || 0}rad) scale(${selected.flipX || 1}, ${selected.flipY || 1})`,
                  display: "block",
                  margin: "0 auto",
                }}
              />
              <span className="jms-card-photo-cap">
                {selected.name.toLowerCase() === "triton"
                  ? t("jupiter.system.photoLabel")
                  : t("jupiter.system.photoLabelViz")}
              </span>
            </div>
          ) : (
            <div className="jms-card-no-photo">
              <span>{t("jupiter.system.noPhoto")}</span>
              <p>{t("jupiter.system.noPhotoBody")}</p>
            </div>
          )}
          <div className="jms-card-rows">
            <div className="jms-card-row"><span>{t("jupiter.tooltip.group")}</span><b>{t("neptune.system." + selected.group)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.a")}</span><b>{fmtA(selected.a_km)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.period")}</span><b>{fmtP(selected.period_d)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.direction")}</span><b>{selected.prograde ? t("jupiter.tooltip.dirPro") : t("jupiter.tooltip.dirRetro")}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.inclination")}</span><b>{selected.i_deg.toFixed(1)}°</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.eccentricity")}</span><b>{selected.e.toFixed(3)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.diameter")}</span><b>{selected.diameter_km != null ? spacer(Math.round(selected.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</b></div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}