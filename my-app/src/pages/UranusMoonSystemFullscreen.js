// Fullscreen PixiJS view of Uranus's moon system.
//
// Architecture mirrors `NeptuneMoonSystemFullscreen.js` exactly (stable-ref
// ticker, camera easing + clamp, wheel/drag/pinch, keyboard nav, starfield,
// annular orbit hit, LOD-gated constant-screen strokes, planet+moon photo
// cross-fade, honest "no resolved image" placeholder), parameterized with
// Uranus data. The inline SVG widget (`#moon-system` in Uranus.js) is left
// untouched; this component is opened from a fullscreen button inside that
// widget's controls.
//
// Data model (mirrors the backend `services/uranus.py` / the SVG widget):
//   moons[]: { name, name_uk, group, a_km, period_d, e, i_deg, prograde,
//             m0_deg, diameter_km }
// Coordinate model (same as Uranus.js / Neptune):
//   EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
//   daysSinceEpoch = (Date.now() - EPOCH_MS) / 86400000
//   simDays = ((t - t0) / 1000) * TIME_SCALE
//   total = daysSinceEpoch + simDays
//   Keplerian position (see lib/kepler.js): reads m.m0_deg, m.e, m.omega.
//
// Scene graph:
//   app.stage
//    └─ world (Container)          // camera transform: position + scale
//        ├─ uranusDisc (Graphics)   // true-scale planet disc
//        ├─ orbits (Container)     // Keplerian orbit ellipses (positioned +
//        │                         //   rotated Graphics; strokes redrawn/LOD)
//        └─ moons (Container)      // one Container per moon
//            └─ moon[i]: Container { dot, label, photoSprite, placeholder }
//
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import * as PIXI from "pixi.js";
import { useApi } from "../hooks/useApi";
import { getUranus } from "../lib/api";
import { perihelionArg, orbitEllipse, keplerXY } from "../lib/kepler";
import "../styles/planetarium.css";

// ---------------------------------------------------------------------------
// Constants shared with the SVG widget in Uranus.js
// ---------------------------------------------------------------------------
const SYS = { vb: 640, cx: 320, cy: 320, rMin: 32, rMax: 300 };
const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const TIME_SCALE = 0.1; // 1 real second ≈ 0.1 simulated days
const URANUS_RADIUS_KM = 25362;

// Group order used by the SVG widget (and by prev/next navigation here).
const GROUPS = ["inner", "major", "outer"];

// ---------------------------------------------------------------------------
// Fullscreen-specific visual constants
// ---------------------------------------------------------------------------
const FIT_MARGIN = 0.92;
const DEFAULT_VIEW_BOOST = 1.69;
const ORBIT_POWER = 1; // TRUE linear mapping — honest distances at every zoom

// Uranus's planetary rings (true radii in km), drawn at the SAME linear world
// mapping as the moon orbits. Uranus's rings are narrow and faint (except the
// bright epsilon ring); the broad dusty rings (zeta, nu, mu) read as bands at
// deep zoom while the narrow ones stay ~1 px lines. `w_km` is the ring's
// physical width; it sets the stroke width. The epsilon ring (brightest, most
// opaque) gets the highest alpha. Sources: NASA Uranian Rings facts; Rings of
// Uranus (Wikipedia).
const URANUS_RINGS = [
  { key: "zeta",      r_km: 38000,  w_km: 3500,  alpha: 0.15 },
  { key: "ring6",     r_km: 41840,  w_km: 2,     alpha: 0.20 },
  { key: "ring5",     r_km: 42230,  w_km: 2,     alpha: 0.20 },
  { key: "ring4",     r_km: 42580,  w_km: 3,     alpha: 0.20 },
  { key: "alpha",     r_km: 44720,  w_km: 7,     alpha: 0.35 },
  { key: "beta",      r_km: 45660,  w_km: 8,     alpha: 0.35 },
  { key: "eta",       r_km: 47170,  w_km: 2,     alpha: 0.30 },
  { key: "gamma",     r_km: 47630,  w_km: 4,     alpha: 0.40 },
  { key: "delta",     r_km: 48300,  w_km: 6,     alpha: 0.40 },
  { key: "lambda",    r_km: 50020,  w_km: 2,     alpha: 0.30 },
  { key: "epsilon",   r_km: 51149,  w_km: 50,    alpha: 0.60 },
  { key: "nu",        r_km: 67300,  w_km: 3800,  alpha: 0.15 },
  { key: "mu",        r_km: 97700,  w_km: 17000, alpha: 0.10 },
];
const RING_COLOR = 0x9fd9e0; // Uranus pale teal accent (matches the disc outline)
// Zoom limits, as multiples of the default (fit-system) zoom. Uranus's
// inner→outer span is ~420× (Cordelia 49 751 km .. Ferdinand ~20.9M km), so the
// inner moons + rings cluster tightly at the centre at fit zoom; deep zoom
// reveals them at true scale.
const ZOOM_OUT_FACTOR = 0.85;
const ZOOM_IN_FACTOR = 800;
const LOD_LABEL_FACTOR = 8;
const LOD_PHOTO_START = 25;
const LOD_PHOTO_END = 50;
const PHOTO_MULT = 5;
const PHOTO_MIN_PX = 26;
const PHOTO_MAX_PX = 90;
const LOD_PLANET_START = 15;
const LOD_PLANET_END = 30;
const DOT_MIN_PX = 1.5;
const DOT_MAX_PX = 14;
const DISC_MIN_PX = 4;
const FOCUS_ZOOM_FACTOR = 150;
const CAMERA_EASE_MS = 700;
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Moon name keys that have unique, specific photographs in `/moons/*.png`.
// The five major moons were all imaged by Voyager 2.
const UNIQUE_MOONS = new Set(["miranda", "ariel", "umbriel", "titania", "oberon"]);

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

// Helpers for formatting numeric values (same helpers as Uranus.js).
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

// Annular hit area for an orbit ring (see NeptuneMoonSystemFullscreen).
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

function drawSmoothCircle(g, cx, cy, r, segments = 256) {
  const pts = new Array(segments * 2);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts[i * 2] = cx + r * Math.cos(a);
    pts[i * 2 + 1] = cy + r * Math.sin(a);
  }
  g.drawPolygon(pts);
}

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
export default function UranusMoonSystemFullscreen({ onClose, initialMoonKey = null }) {
  const { t } = useTranslation();
  const { data } = useApi(getUranus, { deps: [] });

  const wrapRef = useRef(null);
  const canvasWrapRef = useRef(null);
  const pinchRef = useRef(new Map());

  const appRef = useRef(null);
  const worldRef = useRef(null);
  const moonsContainerRef = useRef(null);
  const moonItemsRef = useRef([]);
  const initialFocusRef = useRef(null);
  const textureCacheRef = useRef({});
  const starsContainerRef = useRef(null);
  const twinkleStarsRef = useRef([]);
  const discRef = useRef(null);
  const discRRef = useRef(0);
  const orbitsRef = useRef(null);
  const ringsRef = useRef(null);
  const discPhotoRef = useRef(null);
  const discPhotoStateRef = useRef({ loaded: false, loading: false, texMax: 1 });
  const planetGlowRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const defaultZoomRef = useRef(1);
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

  const [orbitsPaused, setOrbitsPaused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [selectedRingKey, setSelectedRingKey] = useState(null);
  const selectedRingKeyRef = useRef(selectedRingKey);
  selectedRingKeyRef.current = selectedRingKey;
  const [orbitMode, setOrbitMode] = useState("circle");
  const orbitModeRef = useRef(orbitMode);
  orbitModeRef.current = orbitMode;

  // Derived geometry. Orbit radii use TRUE linear mapping (ORBIT_POWER=1). Each
  // moon's dot radius is on the SAME true-size scale as the Uranus disc.
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
      const key = m.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isPhotoMoon = UNIQUE_MOONS.has(key);
      const hash = getNameHash(m.name);
      const rot = isPhotoMoon ? 0 : (Math.abs(hash) % 360) * (Math.PI / 180);
      const flipX = isPhotoMoon ? 1 : (hash & 1 ? -1 : 1);
      const flipY = isPhotoMoon ? 1 : (hash & 2 ? -1 : 1);
      const scaleMult = isPhotoMoon ? 1.0 : 0.85 + (Math.abs(hash % 100) / 100) * 0.3;

      const tints = [0xffffff, 0xf2ebe1, 0xe1e6ec, 0xebebeb, 0xf6ebd8];
      const tint = isPhotoMoon ? 0xffffff : tints[Math.abs(hash) % tints.length];

      const hasPhoto = isPhotoMoon;
      const omega = (m.e || 0) < 0.001 ? 0 : perihelionArg(m.name);

      return { ...m, r, sgn, dotR, color, hasPhoto, omega, rot, flipX, flipY, scaleMult, tint };
    });
  }, [moons]);

  const geoRef = useRef(geo);
  geoRef.current = geo;

  const discR = useMemo(() => {
    const aMax = moons.length ? Math.max(...moons.map((m) => m.a_km)) : 20901000;
    return SYS.rMax * Math.pow(URANUS_RADIUS_KM / aMax, ORBIT_POWER);
  }, [moons]);

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
  // Initialize / destroy Pixi application (mount once)
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

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    const world = new PIXI.Container();
    app.stage.addChild(world);
    worldRef.current = world;

    // Background starfield (screen space, behind the world).
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

    // Uranus disc (true scale; ticker redraws it each LOD pass with a min
    // on-screen radius).
    const planetGlow = new PIXI.Graphics();
    planetGlow.visible = false;
    world.addChild(planetGlow);
    planetGlowRef.current = planetGlow;
    const disc = new PIXI.Graphics();
    disc.beginFill(0x2e7da8);
    drawSmoothCircle(disc, SYS.cx, SYS.cy, discR);
    disc.endFill();
    disc.lineStyle(1.5, 0x9fd9e0, 0.6);
    drawSmoothCircle(disc, SYS.cx, SYS.cy, discR);
    world.addChild(disc);
    discRef.current = disc;
    discRRef.current = discR;

    // Uranus photo sprite: cross-fades in over the flat disc as you zoom in.
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
        const tex = await PIXI.Assets.load("/planets/Uranus_no_rings.png");
        const dp = discPhotoRef.current;
        if (dp) dp.texture = tex;
        st.texMax = Math.max(tex.width, tex.height) || 1;
        st.loaded = true;
        lastZoomRef.current = NaN;
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

    // Initial camera: center world on screen.
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
        lastZoomRef.current = NaN;
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
        lastZoomRef.current = NaN;
      } catch (err) {
        console.error("Failed to load moon texture", url, err);
      } finally {
        item.photoLoading = false;
      }
    };

    // Stable ticker: reads refs only so it never needs to be re-created.
    const ticker = () => {
      const a = appRef.current;
      if (!a) return;
      const now = performance.now();

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

      let simDays;
      if (sim.paused) {
        simDays = sim.pausedAt;
      } else {
        simDays = ((now - sim.t0) / 1000) * TIME_SCALE;
        sim.pausedAt = simDays;
      }
      const daysSinceEpoch = (Date.now() - EPOCH_MS) / 86400000;
      const totalDays = daysSinceEpoch + simDays;

      // Moon positions. "kepler" ⇒ real-eccentricity ellipses (2nd law),
      // Uranus at the focus. "circle" ⇒ simplified uniform circular motion.
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

      // LOD + overlay sizing. Gated on `zoomChanged` so orbit ellipses + dots
      // are NOT cleared+redrawn every frame while zoom is steady.
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

      const photoAlpha = Math.max(
        0,
        Math.min(
          1,
          (zoomNorm - LOD_PHOTO_START) / (LOD_PHOTO_END - LOD_PHOTO_START)
        )
      );

      // Orbit rings: constant ~1 px screen stroke.
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

      // Planetary rings.
      const rc = ringsRef.current;
      if (rc) {
        const rkids = rc.children;
        for (let i = 0; i < rkids.length; i++) {
          const g = rkids[i];
          g.clear();
          if (g._hl || g._sel) {
            g.lineStyle(Math.max(2.5 * inv, g._wWorld * 1.5), g._color, 0.85);
          } else {
            g.lineStyle(Math.max(inv, g._wWorld), g._color, g._alpha);
          }
          g.drawPolygon(g._pts);
          if (g._hit) {
            g._hit.tol = Math.min(0.5, (10 * inv) / (g._rWorld || 1));
          }
        }
      }

      // Uranus disc: true-scale world radius, clamped to a min on-screen radius.
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
        disc.beginFill(0x2e7da8);
        drawSmoothCircle(disc, SYS.cx, SYS.cy, discWorldR);
        disc.endFill();
        disc.lineStyle(1.5 * inv, 0x9fd9e0, 0.6);
        drawSmoothCircle(disc, SYS.cx, SYS.cy, discWorldR);
        disc.alpha = 1 - planetAlpha;
      }
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
      const pg = planetGlowRef.current;
      if (pg) {
        pg.clear();
        if (planetAlpha > 0 && discWorldR > 0) {
          pg.visible = true;
          const cx = SYS.cx, cy = SYS.cy;
          pg.beginFill(0x9fd9e0, 0.05 * planetAlpha);
          drawSmoothCircle(pg, cx, cy, discWorldR * 1.35);
          pg.endFill();
          pg.beginFill(0x9fd9e0, 0.07 * planetAlpha);
          drawSmoothCircle(pg, cx, cy, discWorldR * 1.22);
          pg.endFill();
          pg.beginFill(0x9fd9e0, 0.09 * planetAlpha);
          drawSmoothCircle(pg, cx, cy, discWorldR * 1.12);
          pg.endFill();
        } else {
          pg.visible = false;
        }
      }

      for (const item of items) {
        const m = item.data;

        const dotScreenPx = Math.max(
          DOT_MIN_PX,
          Math.min(DOT_MAX_PX, m.dotR * cam.zoom)
        );
        const dotRadius = dotScreenPx * inv;

        item.label.visible = showLabel;
        item.label.scale.set(inv);

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
          const pgm = item.photoGlow;
          if (pgm) {
            pgm.clear();
            pgm.visible = true;
            const gR = (photoScreenPx * 0.5) * inv;
            pgm.beginFill(m.color, 0.06 * pa);
            drawSmoothCircle(pgm, 0, 0, gR * 1.35);
            pgm.endFill();
            pgm.beginFill(m.color, 0.08 * pa);
            drawSmoothCircle(pgm, 0, 0, gR * 1.22);
            pgm.endFill();
            pgm.beginFill(m.color, 0.10 * pa);
            drawSmoothCircle(pgm, 0, 0, gR * 1.12);
            pgm.endFill();
          }
        } else if (item.photoGlow) {
          item.photoGlow.visible = false;
          item.photoGlow.clear();
        }

        item.placeholder.visible = false;

        item.dot.visible = true;
        item.dot.alpha = 1 - pa;
        item.dot.clear();
        item.dot.beginFill(m.color, 0.22);
        drawSmoothCircle(item.dot, 0, 0, dotRadius * 1.9);
        item.dot.endFill();
        item.dot.beginFill(m.color);
        drawSmoothCircle(item.dot, 0, 0, dotRadius);
        item.dot.endFill();
        if (item.dotHit) item.dotHit.radius = 14 * inv;
      }
    };
    app.ticker.add(ticker);

    // Pointer / wheel interactions attached to the Pixi canvas.
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

    const newOrbits = new PIXI.Container();
    newOrbits.name = "orbits";
    world.addChildAt(newOrbits, 1);
    orbitsRef.current = newOrbits;

    const onMoonTap = (index) => {
      setSelectedRingKey(null);
      setSelectedIndex(index);
      flyToMoon(index);
    };

    const onRingTap = (key) => {
      setSelectedIndex(null);
      setSelectedRingKey(key);
      startCameraAnimation(SYS.cx, SYS.cy, cameraRef.current.zoom);
    };

    // Planetary rings: faint circles at true linear world radii, interleaved
    // with the inner moon orbits. Placed below the moons so dots/photos render
    // on top.
    const newRings = new PIXI.Container();
    newRings.name = "rings";
    const aMax = geo.length ? Math.max(...geo.map((m) => m.a_km)) : 1;
    for (const ring of URANUS_RINGS) {
      const rWorld = (SYS.rMax * Math.pow(ring.r_km / aMax, ORBIT_POWER)) || 0.0001;
      const g = new PIXI.Graphics();
      g.position.set(SYS.cx, SYS.cy);
      g._pts = ellipsePolygonPoints(rWorld, rWorld);
      g._wWorld = (SYS.rMax * ring.w_km) / aMax;
      g._color = RING_COLOR;
      g._alpha = ring.alpha;
      g._key = ring.key;
      g._rWorld = rWorld;
      g._hl = false;
      g._sel = ring.key === selectedRingKeyRef.current;
      g._hit = new RingHit(rWorld, rWorld);
      g.hitArea = g._hit;
      g.eventMode = "static";
      g.cursor = "pointer";
      g.on("pointerover", () => {
        g._hl = true;
        lastZoomRef.current = NaN;
      });
      g.on("pointerout", () => {
        g._hl = false;
        lastZoomRef.current = NaN;
      });
      g.on("pointertap", () => {
        onRingTap(ring.key);
      });
      g.lineStyle(1, RING_COLOR, ring.alpha);
      g.drawPolygon(g._pts);
      newRings.addChild(g);
    }
    world.addChild(newRings);
    ringsRef.current = newRings;

    const newMoonsContainer = new PIXI.Container();
    newMoonsContainer.name = "moons";
    world.addChild(newMoonsContainer);
    moonsContainerRef.current = newMoonsContainer;

    for (let idx = 0; idx < geo.length; idx++) {
      const m = geo[idx];

      const g = new PIXI.Graphics();
      g._hl = false;
      g._sel = idx === selectedIndex;
      setupOrbitGraphics(g, m, orbitModeRef.current);
      g.on("pointerover", () => {
        g._hl = true;
        lastZoomRef.current = NaN;
      });
      g.on("pointerout", () => {
        g._hl = false;
        lastZoomRef.current = NaN;
      });
      g.on("pointertap", () => onMoonTap(idx));
      newOrbits.addChild(g);

      const mc = new PIXI.Container();
      mc.name = m.name;
      newMoonsContainer.addChild(mc);

      const dotHit = new PIXI.Circle(0, 0, 14);
      const dot = new PIXI.Graphics();
      dot.beginFill(m.color);
      drawSmoothCircle(dot, 0, 0, 3);
      dot.endFill();
      dot.eventMode = "static";
      dot.cursor = "pointer";
      dot.hitArea = dotHit;
      dot.on("pointertap", () => onMoonTap(idx));
      mc.addChild(dot);

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

      const photoGlow = new PIXI.Graphics();
      photoGlow.visible = false;
      mc.addChild(photoGlow);
      const photo = new PIXI.Sprite(PIXI.Texture.EMPTY);
      photo.anchor.set(0.5);
      photo.visible = false;
      photo.rotation = m.rot;
      photo.tint = m.tint;
      photo.eventMode = "static";
      photo.cursor = "pointer";
      photo.on("pointertap", () => onMoonTap(idx));
      mc.addChild(photo);

      const placeholder = new PIXI.Container();
      placeholder.visible = false;
      placeholder.eventMode = "static";
      placeholder.cursor = "pointer";
      placeholder.hitArea = new PIXI.Circle(0, 0, 28);
      const phCircle = new PIXI.Graphics();
      phCircle.lineStyle(1.5, 0xedeff8, 0.25);
      phCircle.beginFill(0x14182b, 0.55);
      drawSmoothCircle(phCircle, 0, 0, 26);
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

    discRRef.current = discR;
    const disc = discRef.current || world.children[0];
    if (disc && disc instanceof PIXI.Graphics) {
      disc.clear();
      disc.beginFill(0x2e7da8);
      drawSmoothCircle(disc, SYS.cx, SYS.cy, discR);
      disc.endFill();
      disc.lineStyle(1.5, 0x9fd9e0, 0.6);
      drawSmoothCircle(disc, SYS.cx, SYS.cy, discR);
    }

    applyCamera();
    lastZoomRef.current = NaN;
    if (initialMoonKey && geo.length && initialFocusRef.current !== initialMoonKey) {
      const idx = geo.findIndex((m) => m.name.toLowerCase() === initialMoonKey);
      if (idx >= 0) {
        initialFocusRef.current = initialMoonKey;
        setSelectedRingKey(null);
        setSelectedIndex(idx);
        requestAnimationFrame(() => flyToMoon(idx));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo]);

  // Orbit-mode toggle: re-configure the EXISTING orbit Graphics in place.
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

  useEffect(() => {
    const rc = ringsRef.current;
    if (!rc) return;
    const kids = rc.children;
    for (let i = 0; i < kids.length; i++) {
      kids[i]._sel = kids[i]._key === selectedRingKey;
    }
    lastZoomRef.current = NaN;
  }, [selectedRingKey]);

  // -------------------------------------------------------------------------
  // Navigation
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
    setSelectedRingKey(null);
    setSelectedIndex(idx);
    flyToMoon(idx);
  };
  const navigatePrevRef = useRef(navigatePrev);
  navigatePrevRef.current = navigatePrev;

  const navigateNext = () => {
    if (!orderedIndices.length) return;
    const current =
      selectedIndex != null ? orderedIndices.indexOf(selectedIndex) : 0;
    const next = (current + 1) % orderedIndices.length;
    const idx = orderedIndices[next];
    setSelectedRingKey(null);
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
    setSelectedRingKey(null);
  };

  const zoomBy = (factor) => {
    const cam = cameraRef.current;
    startCameraAnimation(cam.x, cam.y, clampZoom(cam.zoom * factor));
  };

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const selected = selectedIndex != null ? geo[selectedIndex] : null;
  const selectedRing = selectedRingKey != null ? URANUS_RINGS.find((r) => r.key === selectedRingKey) : null;

  return createPortal(
    <div ref={wrapRef} className="jms-fullscreen-wrap" role="dialog" aria-modal="true" aria-label={t("uranus.system.fullscreenTitle")}>
      <div ref={canvasWrapRef} className="jms-canvas-wrap" />

      {/* Top-left header / close */}
      <div className="jms-top-bar">
        <div>
          <div className="jms-title">{t("uranus.system.title")}</div>
          <div className="jms-sub">
            {t("uranus.system.eyebrow", { count: moons.length || 0 })}
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
              setSelectedRingKey(null);
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

      {/* Selected-moon detail card */}
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
                {t("jupiter.system.photoLabel")}
              </span>
            </div>
          ) : (
            <div className="jms-card-no-photo">
              <span>{t("jupiter.system.noPhoto")}</span>
              <p>{t("jupiter.system.noPhotoBody")}</p>
            </div>
          )}
          <div className="jms-card-rows">
            <div className="jms-card-row"><span>{t("jupiter.tooltip.group")}</span><b>{t("uranus.system." + selected.group)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.a")}</span><b>{fmtA(selected.a_km)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.period")}</span><b>{fmtP(selected.period_d)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.direction")}</span><b>{selected.prograde ? t("jupiter.tooltip.dirPro") : t("jupiter.tooltip.dirRetro")}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.inclination")}</span><b>{selected.i_deg.toFixed(1)}°</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.eccentricity")}</span><b>{selected.e.toFixed(3)}</b></div>
            <div className="jms-card-row"><span>{t("jupiter.tooltip.diameter")}</span><b>{selected.diameter_km != null ? spacer(Math.round(selected.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</b></div>
          </div>
        </div>
      )}

      {/* Selected-ring detail card */}
      {selectedRing && (
        <div className="jms-card" onClick={(e) => e.stopPropagation()}>
          <button className="jms-card-close" onClick={() => setSelectedRingKey(null)} aria-label={t("jupiter.system.close")}>✕</button>
          <h3>{t("uranus.rings." + selectedRing.key + ".name")}</h3>
          <div className="jms-card-no-photo">
            <span>{t("uranus.rings.planetaryRing")}</span>
            <p>{t("uranus.rings." + selectedRing.key + ".desc")}</p>
          </div>
          <div className="jms-card-rows">
            <div className="jms-card-row"><span>{t("uranus.rings.radiusLabel")}</span><b>{spacer(Math.round(selectedRing.r_km))} км</b></div>
            <div className="jms-card-row"><span>{t("uranus.rings.widthLabel")}</span><b>{spacer(Math.round(selectedRing.w_km))} км</b></div>
            <div className="jms-card-row"><span>{t("uranus.rings.discovererLabel")}</span><b>{t("uranus.rings." + selectedRing.key + ".discoverer")}</b></div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}