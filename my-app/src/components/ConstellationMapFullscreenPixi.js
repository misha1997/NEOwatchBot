import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import * as PIXI from "pixi.js";
import { useLang } from "../context/LanguageContext";
import { getConstellationDetails } from "../lib/constellation_details";
import "../styles/constellations.css";

// Astronomical formulas (RA/Dec to Alt/Az)
function getJulianDate(date) {
  return (date.getTime() / 86400000) + 2440587.5;
}

// Local Sidereal Time calculation
function getLST(date, lonDeg) {
  const jd = getJulianDate(date);
  const d = jd - 2451545.0;
  let gst = 280.46061837 + 360.98564736629 * d;
  let lst = gst + lonDeg;
  lst = lst % 360;
  if (lst < 0) lst += 360;
  return lst;
}

// Convert RA/Dec coordinates to Alt/Az
function raDecToAltAz(raDeg, decDeg, latDeg, lonDeg, date) {
  const lst = getLST(date, lonDeg);
  let ha = lst - raDeg;
  if (ha < 0) ha += 360;

  const haRad = (ha * Math.PI) / 180;
  const decRad = (decDeg * Math.PI) / 180;
  const latRad = (latDeg * Math.PI) / 180;

  const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const altRad = Math.asin(sinAlt);
  const altDeg = (altRad * 180) / Math.PI;

  const y = -Math.sin(haRad) * Math.cos(decRad);
  const x = Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(haRad);
  let azRad = Math.atan2(y, x);
  let azDeg = (azRad * 180) / Math.PI;
  if (azDeg < 0) azDeg += 360;

  return { alt: altDeg, az: azDeg };
}

// Convert Alt/Az to polar coordinates on canvas
function altAzToXY(alt, az, cx, cy, rHor) {
  const rZen = 10;
  const r = rZen + (rHor - rZen) * (1 - alt / 90);
  const a = (az * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(a),
    y: cy - r * Math.cos(a)
  };
}

// Dynamic star dot radius based on magnitude (matching SVG formula exactly)
function dotRadius(mag) {
  if (mag == null) return 2.0;
  const r = 2.8 + (2.5 - mag) * 0.7;
  return Math.max(1.2, Math.min(6.5, r));
}

// Formatting helpers
function formatRA(raDeg) {
  const raHours = raDeg / 15;
  const h = Math.floor(raHours);
  const m = Math.floor((raHours - h) * 60);
  const s = Math.floor(((raHours - h) * 60 - m) * 60);
  return `${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

function formatDec(decDeg) {
  const sign = decDeg >= 0 ? "+" : "-";
  const absDec = Math.abs(decDeg);
  const d = Math.floor(absDec);
  const m = Math.floor((absDec - d) * 60);
  const s = Math.floor(((absDec - d) * 60 - m) * 60);
  return `${sign}${d.toString().padStart(2, "0")}° ${m.toString().padStart(2, "0")}' ${s.toString().padStart(2, "0")}"`;
}

// --- Gyroscope / "sky-pointing" mode helpers -------------------------------
//
// Re-centers the alt/az dome projection on wherever the phone's back camera
// points, instead of on the true zenith, so the star map pans as you move the
// phone — same idea as Stellarium Mobile's sensor mode. Implemented as a
// virtual rotation of the celestial sphere: treat the boresight direction
// (alt0, az0) as the new "zenith" and re-derive each object's alt'/az' in
// that frame using the exact same spherical-trig shape as raDecToAltAz above
// (az plays the role of RA, alt plays the role of Dec, alt0 plays the role of
// latitude, and az-az0 plays the role of hour angle — no time term needed
// since this is a static re-pointing, not a sidereal-time conversion).
function rotateToBoresight(alt, az, boreAlt, boreAz) {
  const haRad = ((az - boreAz) * Math.PI) / 180;
  const altRad = (alt * Math.PI) / 180;
  const boreAltRad = (boreAlt * Math.PI) / 180;

  const sinAltP = Math.sin(boreAltRad) * Math.sin(altRad) + Math.cos(boreAltRad) * Math.cos(altRad) * Math.cos(haRad);
  const altPrimeDeg = (Math.asin(Math.max(-1, Math.min(1, sinAltP))) * 180) / Math.PI;

  const y = -Math.sin(haRad) * Math.cos(altRad);
  const x = Math.sin(altRad) * Math.cos(boreAltRad) - Math.cos(altRad) * Math.sin(boreAltRad) * Math.cos(haRad);
  let azPrimeDeg = (Math.atan2(y, x) * 180) / Math.PI;
  if (azPrimeDeg < 0) azPrimeDeg += 360;

  return { alt: altPrimeDeg, az: azPrimeDeg };
}

// Projects a true (alt, az) to screen space, optionally re-centered on a
// boresight ({alt, az} of wherever the phone points). Pass boresight=null for
// the normal zenith-centered projection (identical to plain altAzToXY).
function projectWithBoresight(alt, az, boresight, cx, cy, rHor) {
  if (!boresight) return altAzToXY(alt, az, cx, cy, rHor);
  const rotated = rotateToBoresight(alt, az, boresight.alt, boresight.az);
  return altAzToXY(rotated.alt, rotated.az, cx, cy, rHor);
}

// Shortest-path interpolation between two compass angles (handles the 359°→1°
// wraparound so smoothing doesn't spin the long way around).
function lerpAngleDeg(a, b, t) {
  let diff = ((b - a + 540) % 360) - 180;
  return (a + diff * t + 360) % 360;
}

// Reads a DeviceOrientationEvent and derives where the phone's back points, as
// {az, alt} in the same convention as the astronomical az/alt used elsewhere
// in this file (az: 0=N, 90=E, clockwise; alt: 0=horizon, 90=zenith).
//
// Azimuth comes from compass heading rather than the full 3-axis rotation
// matrix: iOS Safari's webkitCompassHeading is already a true heading (and is
// UI-orientation aware), and Android's absolute `alpha` converts to heading
// via `360 - alpha` (alpha increases counter-clockwise per the W3C spec,
// heading increases clockwise) plus the current screen rotation, since
// Android's alpha is relative to the physical device frame, not the locked UI
// orientation. Altitude uses the simpler `90 - beta` approximation (vertical
// phone ⇒ horizon, flat phone ⇒ zenith), which ignores roll (gamma) — fine
// for the common "hold the phone upright like a window" posture this feature
// targets, at the cost of some inaccuracy if the phone is held tilted/rotated
// about its long axis.
function computeHeadingAlt(event) {
  const beta = event.beta;
  if (beta == null) return null;

  let heading;
  if (typeof event.webkitCompassHeading === "number" && !Number.isNaN(event.webkitCompassHeading)) {
    heading = event.webkitCompassHeading;
  } else if (event.alpha != null) {
    const screenAngle =
      typeof window !== "undefined" && window.screen && window.screen.orientation && typeof window.screen.orientation.angle === "number"
        ? window.screen.orientation.angle
        : window.orientation || 0;
    heading = (360 - event.alpha + screenAngle) % 360;
    if (heading < 0) heading += 360;
  } else {
    return null;
  }

  const altitude = Math.max(-90, Math.min(90, 90 - beta));
  return { az: heading, alt: altitude };
}

export default function ConstellationMapFullscreenPixi({
  onClose,
  activeConst,
  setActiveConst,
  currentTime,
  latLon,
  seasonFilter,
  geoInfo,
  statusMsg,
  geoControlsCompact,
  pillsInner
}) {
  const { t } = useTranslation();
  const { lang } = useLang();

  // Canvas Refs
  const canvasWrapRef = useRef(null);
  const appRef = useRef(null);
  const worldRef = useRef(null);
  const starsContainersRef = useRef([]); // 4 LOD containers
  const linesGraphicsRef = useRef(null);
  const labelsContainerRef = useRef(null);
  const objectsContainerRef = useRef(null);
  const domeGraphicsRef = useRef(null);
  const starTextureRef = useRef(null);
  const selectionRingRef = useRef(null);

  // Cache constellations data to redraw it during zoom/pan events
  const constellationsDataRef = useRef(null);
  const updateElementsScaleRef = useRef(null);
  const selectedWorldPosRef = useRef(null); // {alt,az} of the selected star/planet/galaxy (re-projected each frame)

  // Gyroscope / "sky-pointing" mode (see rotateToBoresight above). Refs so the
  // orientation event handler and pointer handlers (added once, in the
  // mount-only Pixi init effect) can read live state without re-subscribing.
  const gyroActiveRef = useRef(false);
  const boresightRef = useRef({ alt: 90, az: 0 }); // smoothed look direction
  const lastGyroTickRef = useRef(0);
  const orientationHandlerRef = useRef(null);
  const savedViewRef = useRef(null); // {zoom, pan} to restore when gyro mode ends
  const constLabelsRef = useRef([]); // [{node, alt, az}] constellation name labels
  const cardinalLabelsRef = useRef([]); // [{node, alt, az}] N/S/E/W labels
  const reprojectAllRef = useRef(null);

  // States for detailed view and tooltip
  const [selectedObj, setSelectedObj] = useState(null);
  const [hoveredObj, setHoveredObj] = useState(null);
  const [hideBottomBar, setHideBottomBar] = useState(false);
  const [celestialData, setCelestialData] = useState(null);
  const [planetsData, setPlanetsData] = useState([]);
  const [galaxiesData, setGalaxiesData] = useState([]);
  const [detailedGalaxy, setDetailedGalaxy] = useState(null);
  const [gyroSupported, setGyroSupported] = useState(false);
  const [gyroActive, setGyroActive] = useState(false);
  const [gyroError, setGyroError] = useState(null);
  const [gyroHeading, setGyroHeading] = useState(null);

  // Store zoom/pan refs to modify in event listeners directly without re-rendering React
  const zoomRef = useRef(3.0);
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Multi-pointer / gesture state (mobile). Refs so the window listeners can
  // mutate them without re-rendering React.
  const pointersRef = useRef(new Map()); // pointerId -> { x, y } (client coords)
  const pinchRef = useRef(null); // { startDist, startZoom, startMid, startPan }
  const movedRef = useRef(false); // per-gesture: did the pointer(s) move > threshold?
  const lastTapRef = useRef({ t: 0, x: 0, y: 0 }); // last single-tap (double-tap detection)
  const spriteTapRef = useRef(false); // set by Pixi pointertap so a selection isn't a zoom
  const downPosRef = useRef({ x: 0, y: 0 }); // first-pointer down position (tap vs drag)
  const redrawDomeRef = useRef(null); // shared dome redraw helper (wheel + pinch)

  // Tooltip & Detail Card translations
  const hudLabels = // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    return lang === "en" ? {
      bayer: "Bayer designation",
      catalog: "Catalog number",
      mag: "Apparent Magnitude",
      constellation: "Constellation",
      radec: "RA / Dec (J2000)",
      altaz: "Alt / Az (apparent)",
      distance: "Distance",
      diameter: "Diameter",
      visibility: "Visibility",
      phase: "Moon Phase",
      season: "Observation Season",
      stars: "Brightest Star"
    } : {
      bayer: "Позначення Байєра",
      catalog: "Номер каталогу",
      mag: "Видима зоряна величина",
      constellation: "Сузір'я",
      radec: "Пряме піднес. / Схилення",
      altaz: "Висота / Азимут",
      distance: "Відстань",
      diameter: "Діаметр",
      visibility: "Видимість",
      phase: "Фаза Місяця",
      season: "Сезон спостереження",
      stars: "Головна зірка"
    };
  }, [lang]);

  const getStarColorInfo = (id) => {
    const classes = [
      { name: "O / B (Blue-white)", color: "#38bdf8" },
      { name: "A / F (White/Yellow-white)", color: "#f1f5f9" },
      { name: "G (Yellow like Sun)", color: "#eab308" },
      { name: "K / M (Orange-red Giant)", color: "#f43f5e" }
    ];
    const index = (id || 0) % classes.length;
    return classes[index];
  };

  // Get current viewport parameters dynamically
  const getViewportParams = () => {
    const app = appRef.current;
    if (!app) {
      return {
        cx: window.innerWidth / 2,
        cy: window.innerHeight / 2,
        rHor: Math.min(window.innerWidth, window.innerHeight) * 0.43
      };
    }
    const width = app.renderer.width / app.renderer.resolution;
    const height = app.renderer.height / app.renderer.resolution;
    return {
      cx: width / 2,
      cy: height / 2,
      rHor: Math.min(width, height) * 0.43
    };
  };

  // Helper to redraw constellation lines at the current zoom level to keep them thin and sharp.
  // `boresight` re-centers the lines on wherever the phone points (gyro mode); null draws the
  // normal zenith-centered projection.
  const drawConstellationLines = (z, boresight = null) => {
    const linesGraphics = linesGraphicsRef.current;
    if (!linesGraphics || !constellationsDataRef.current) return;

    const { cx, cy, rHor } = getViewportParams();
    linesGraphics.clear();

    constellationsDataRef.current.forEach((c) => {
      const centerLoc = raDecToAltAz(c.ra, c.dec, latLon.lat, latLon.lon, currentTime);
      if (centerLoc.alt <= -12) return;

      const details = getConstellationDetails(c.id, lang);
      const isSeason = seasonFilter ? details.seasonKey === seasonFilter : false;
      const isActive = activeConst === c.id;

      // Calculate styles matching mini-map active/season classes
      let lColor = 0x415b77;
      let lAlpha = 0.35;
      let lWidth = 1.1 / z; // Inverse-scaled stroke width

      if (isActive) {
        lColor = 0x4fd1c5; // Teal active lines
        lAlpha = 1.0;
        lWidth = 1.8 / z;
      } else if (isSeason) {
        lColor = 0xe8b94d; // Yellow-gold in-season lines
        lAlpha = 0.45;
      }

      linesGraphics.lineStyle({
        width: lWidth,
        color: lColor,
        alpha: lAlpha
      });

      c.lines.forEach((line) => {
        line.forEach((pt, idx) => {
          const ptLoc = raDecToAltAz(pt[0], pt[1], latLon.lat, latLon.lon, currentTime);
          const xyPt = projectWithBoresight(ptLoc.alt, ptLoc.az, boresight, cx, cy, rHor);
          if (idx === 0) {
            linesGraphics.moveTo(xyPt.x, xyPt.y);
          } else {
            linesGraphics.lineTo(xyPt.x, xyPt.y);
          }
        });
      });
    });
  };

  // Helper to redraw the selection highlight ring around the tapped star/planet/galaxy,
  // keeping it a constant screen size (inverse-scaled) as the user zooms. `boresight`
  // re-centers it in gyro mode, same as drawConstellationLines above.
  const drawSelectionRing = (z, boresight = null) => {
    const ring = selectionRingRef.current;
    if (!ring) return;
    ring.clear();

    const pos = selectedWorldPosRef.current; // {alt, az}
    if (!pos) return;

    const { cx, cy, rHor } = getViewportParams();
    const { x, y } = projectWithBoresight(pos.alt, pos.az, boresight, cx, cy, rHor);

    const r = 15 / z;
    ring.lineStyle({ width: 1.5 / z, color: 0x4fd1c5, alpha: 0.4 });
    ring.drawCircle(x, y, r * 1.7);
    ring.lineStyle({ width: 2 / z, color: 0x4fd1c5, alpha: 0.95 });
    ring.drawCircle(x, y, r);
  };

  // Helper to dynamically update elements' scale on zoom to prevent them from growing large
  const updateElementsScale = (z) => {
    // 1. Inverse-scale all stars based on zoom
    starsContainersRef.current.forEach((container) => {
      const len = container.children.length;
      for (let i = 0; i < len; i++) {
        const sprite = container.children[i];
        // Star texture is diameter 20, so scale = radius / (10 * z)
        sprite.scale.set(sprite.starRadius / (10 * z));
      }
    });

    // 2. Inverse-scale planets & galaxies
    const objectsContainer = objectsContainerRef.current;
    if (objectsContainer) {
      objectsContainer.children.forEach((child) => {
        child.scale.set(1 / z);
      });
    }

    // 3. Inverse-scale labels' font sizes
    const labelsContainer = labelsContainerRef.current;
    if (labelsContainer) {
      labelsContainer.children.forEach((child) => {
        if (child instanceof PIXI.Text) {
          const text = child.text;
          const isCardinal = ["N", "S", "E", "W"].includes(text);
          child.style.fontSize = isCardinal ? 13 / z : 10 / z;
        }
      });
    }

    // Redraw constellation lines and the selection ring, re-centered on the
    // current boresight if gyro mode is on (e.g. the user pinch/button-zoomed
    // mid-session) so they don't snap back to the zenith-centered layout.
    const activeBoresight = gyroActiveRef.current ? boresightRef.current : null;
    drawConstellationLines(z, activeBoresight);
    drawSelectionRing(z, activeBoresight);
  };
  updateElementsScaleRef.current = updateElementsScale;

  // Re-projects every on-screen object (stars, planets/galaxies, constellation
  // + cardinal labels, lines, selection ring) onto a new boresight direction.
  // Called on every (throttled) orientation-sensor tick while gyro mode is on;
  // pass boresight=null to snap everything back to the normal zenith-centered
  // layout when gyro mode ends. Sprite *scale* (inverse zoom) is untouched
  // here — only position changes, since Pixi's world container transform
  // already handles the visual zoom of position for us.
  const reprojectAll = (boresight) => {
    const { cx, cy, rHor } = getViewportParams();

    starsContainersRef.current.forEach((container) => {
      const children = container.children;
      for (let i = 0; i < children.length; i++) {
        const sprite = children[i];
        if (sprite.userAlt == null) continue;
        const { x, y } = projectWithBoresight(sprite.userAlt, sprite.userAz, boresight, cx, cy, rHor);
        sprite.position.set(x, y);
      }
    });

    const objectsContainer = objectsContainerRef.current;
    if (objectsContainer) {
      objectsContainer.children.forEach((child) => {
        if (child.userAlt == null) return;
        const { x, y } = projectWithBoresight(child.userAlt, child.userAz, boresight, cx, cy, rHor);
        child.position.set(x, y);
      });
    }

    constLabelsRef.current.forEach(({ node, alt, az }) => {
      const { x, y } = projectWithBoresight(alt, az, boresight, cx, cy, rHor);
      node.position.set(x, y);
    });

    cardinalLabelsRef.current.forEach(({ node, alt, az }) => {
      const { x, y } = projectWithBoresight(alt, az, boresight, cx, cy, rHor);
      node.position.set(x, y);
    });

    drawConstellationLines(zoomRef.current, boresight);
    drawSelectionRing(zoomRef.current, boresight);
  };
  reprojectAllRef.current = reprojectAll;

  // Load Star Catalog & API data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 1. Load real stars database
    fetch("/data/real_stars.json")
      .then((res) => res.json())
      .then((data) => setCelestialData(data))
      .catch((err) => console.error("Failed to load real stars catalog:", err));

    // 2. Fetch live planets positions from API
    fetch(`/api/planets?lat=${latLon.lat}&lon=${latLon.lon}&lang=${lang === "en" ? "en" : "uk"}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.items) {
          const list = [...data.items];
          if (data.sun) list.push(data.sun);
          if (data.moon) list.push(data.moon);
          setPlanetsData(list);
        }
      })
      .catch((err) => console.error("Failed to load planets data:", err));

    // 3. Fetch galaxies from API
    fetch(`/api/galaxies?lang=${lang === "en" ? "en" : "uk"}`)
      .then((res) => res.json())
      .then((data) => setGalaxiesData(data && data.items ? data.items : []))
      .catch((err) => console.error("Failed to load galaxies data:", err));
  }, [latLon, lang]);

  // Fetch full galaxy details dynamically when selected
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedObj && selectedObj.type === "galaxy") {
      setDetailedGalaxy(null);
      fetch(`/api/galaxies/${selectedObj.slug}?lang=${lang === "en" ? "en" : "uk"}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.available) {
            setDetailedGalaxy(data);
          }
        })
        .catch((err) => console.error("Failed to load galaxy detail:", err));
    } else {
      setDetailedGalaxy(null);
    }
  }, [selectedObj, lang]);

  // Get object image if available (for planets and galaxies)
  const getObjectImageUrl = (obj, detailedGal) => {
    if (!obj) return null;
    if (obj.type === "planet") {
      if (obj.name_key === "sun" || obj.name_key === "moon") return null;
      const nameKey = obj.name_key;
      const capitalized = nameKey.charAt(0).toUpperCase() + nameKey.slice(1);
      return `/planets/${capitalized}.png`;
    }
    if (obj.type === "galaxy") {
      if (detailedGal && detailedGal.photos && detailedGal.photos.length > 0) {
        return detailedGal.photos[0].thumb || detailedGal.photos[0].full;
      }
      return obj.thumb; // Fallback to list preview
    }
    return null;
  };

  const objectImageUrl = getObjectImageUrl(selectedObj, detailedGalaxy);

  // Gyro toggle only makes sense on a touch/coarse-pointer device with the
  // orientation API — desktop Chrome exposes the constructor without a real
  // sensor, so gate on pointer type too rather than API presence alone.
  useEffect(() => {
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const hasApi = typeof window.DeviceOrientationEvent !== "undefined";
    setGyroSupported(coarse && hasApi);
  }, []);

  useEffect(() => {
    gyroActiveRef.current = gyroActive;
  }, [gyroActive]);

  // Remove any live orientation listener if the component unmounts while
  // gyro mode is still on (e.g. the user closes fullscreen without toggling it off).
  useEffect(() => {
    return () => {
      if (orientationHandlerRef.current) {
        window.removeEventListener("deviceorientationabsolute", orientationHandlerRef.current);
        window.removeEventListener("deviceorientation", orientationHandlerRef.current);
      }
    };
  }, []);

  // PixiJS App Initialization (runs ONCE on mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!canvasWrapRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const app = new PIXI.Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    appRef.current = app;
    canvasWrapRef.current.appendChild(app.view);

    app.stage.eventMode = "static";
    app.stage.hitArea = app.screen;

    const world = new PIXI.Container();
    app.stage.addChild(world);
    worldRef.current = world;

    const starGraphics = new PIXI.Graphics();
    starGraphics.beginFill(0xffffff);
    starGraphics.drawCircle(0, 0, 10);
    starGraphics.endFill();
    const starTexture = app.renderer.generateTexture(starGraphics);
    starTextureRef.current = starTexture;

    const domeGraphics = new PIXI.Graphics();
    world.addChild(domeGraphics);
    domeGraphicsRef.current = domeGraphics;

    const containers = [
      new PIXI.Container(), // Bin 0: mag <= 5.0 (always visible)
      new PIXI.Container(), // Bin 1: 5.0 < mag <= 6.5 (fades in)
      new PIXI.Container(), // Bin 2: 6.5 < mag <= 7.5 (fades in)
      new PIXI.Container(), // Bin 3: 7.5 < mag <= 8.5 (fades in)
      new PIXI.Container()  // Bin 4: 8.5 < mag <= 10.5 (fades in)
    ];
    containers.forEach((c) => world.addChild(c));
    starsContainersRef.current = containers;

    const linesGraphics = new PIXI.Graphics();
    world.addChild(linesGraphics);
    linesGraphicsRef.current = linesGraphics;

    const labelsContainer = new PIXI.Container();
    world.addChild(labelsContainer);
    labelsContainerRef.current = labelsContainer;

    const objectsContainer = new PIXI.Container();
    world.addChild(objectsContainer);
    objectsContainerRef.current = objectsContainer;

    // Added last so the selection ring always draws on top of stars/planets/galaxies.
    const selectionRing = new PIXI.Graphics();
    world.addChild(selectionRing);
    selectionRingRef.current = selectionRing;

    const cx = width / 2;
    const cy = height / 2;
    const rHor = Math.min(width, height) * 0.43;

    world.scale.set(zoomRef.current);
    world.pivot.set(cx, cy);
    world.position.set(cx + panOffsetRef.current.x, cy + panOffsetRef.current.y);

    // Shared dome redraw (used by the initial draw, the wheel handler, and the
    // pinch handler so the grid lines stay thin and sharp at any zoom).
    const redrawDome = (z) => {
      domeGraphics.clear();
      domeGraphics.lineStyle({
        width: 0.8 / z,
        color: 0x1f2e4d,
        alpha: 0.4
      });
      domeGraphics.beginFill(0x060c18, 0.82);
      domeGraphics.drawCircle(cx, cy, rHor);
      domeGraphics.endFill();

      domeGraphics.drawCircle(cx, cy, rHor * 0.68);
      domeGraphics.drawCircle(cx, cy, rHor * 0.36);
      domeGraphics.drawCircle(cx, cy, 10);

      domeGraphics.moveTo(cx, cy - rHor);
      domeGraphics.lineTo(cx, cy + rHor);
      domeGraphics.moveTo(cx - rHor, cy);
      domeGraphics.lineTo(cx + rHor, cy);

      const dVal = rHor * 0.704;
      domeGraphics.moveTo(cx - dVal, cy - dVal);
      domeGraphics.lineTo(cx + dVal, cy + dVal);
      domeGraphics.moveTo(cx + dVal, cy - dVal);
      domeGraphics.lineTo(cx - dVal, cy + dVal);
    };
    redrawDomeRef.current = redrawDome;

    // Draw static dome circles and grid lines to match mini-map exactly
    redrawDome(zoomRef.current);

    // LOD updating in the render loop
    const updateLOD = () => {
      const z = zoomRef.current;
      containers[0].alpha = 1.0;
      containers[1].alpha = Math.max(0.0, Math.min(1.0, (z - 1.5) / 1.3));
      containers[2].alpha = Math.max(0.0, Math.min(1.0, (z - 2.8) / 2.2));
      containers[3].alpha = Math.max(0.0, Math.min(1.0, (z - 5.0) / 3.0));
      containers[4].alpha = Math.max(0.0, Math.min(1.0, (z - 10.0) / 8.0));
    };
    app.ticker.add(updateLOD);

    // Event listener functions for window events (to keep pan/zoom extremely fast)
    // Apply a zoom step centered on a screen point (clientX/clientY). Used by
    // the wheel handler, pinch-to-zoom, and double-tap-to-zoom so they all share
    // the same "point under the cursor/finger stays put" math.
    const applyZoomToward = (clientX, clientY, nextZoom) => {
      const prevZoom = zoomRef.current;
      const clamped = Math.max(1.0, Math.min(6000.0, nextZoom));
      zoomRef.current = clamped;

      const rect = app.view.getBoundingClientRect();
      const Ax = (clientX - rect.left) * (width / rect.width);
      const Ay = (clientY - rect.top) * (height / rect.height);
      const ratio = 1 - clamped / prevZoom;
      panOffsetRef.current = {
        x: panOffsetRef.current.x + (Ax - cx - panOffsetRef.current.x) * ratio,
        y: panOffsetRef.current.y + (Ay - cy - panOffsetRef.current.y) * ratio
      };

      world.scale.set(clamped);
      world.position.set(cx + panOffsetRef.current.x, cy + panOffsetRef.current.y);

      if (redrawDomeRef.current) redrawDomeRef.current(clamped);
      if (updateElementsScaleRef.current) updateElementsScaleRef.current(clamped);
    };

    const handleWindowPointerDown = (e) => {
      if (gyroActiveRef.current) return; // gyro drives the view; manual pan/pinch is disabled
      if (!canvasWrapRef.current || !canvasWrapRef.current.contains(e.target)) return;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointersRef.current.size === 1) {
        // Begin single-pointer pan.
        movedRef.current = false;
        spriteTapRef.current = false;
        downPosRef.current = { x: e.clientX, y: e.clientY };
        isDraggingRef.current = true;
        dragStartRef.current = {
          x: e.clientX - panOffsetRef.current.x,
          y: e.clientY - panOffsetRef.current.y
        };
      } else if (pointersRef.current.size === 2) {
        // Begin pinch-to-zoom (pan pauses while two fingers are down).
        isDraggingRef.current = false;
        const pts = [...pointersRef.current.values()];
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        pinchRef.current = {
          startDist: Math.hypot(dx, dy) || 1,
          startZoom: zoomRef.current
        };
        movedRef.current = true; // a pinch is a move, not a tap
      }
    };

    const handleWindowPointerMove = (e) => {
      if (gyroActiveRef.current) return; // gyro drives the view; manual pan/pinch is disabled
      const pt = pointersRef.current.get(e.pointerId);
      if (pt) {
        pt.x = e.clientX;
        pt.y = e.clientY;
      }

      // Tap-vs-drag threshold.
      if (pointersRef.current.size === 1 && isDraggingRef.current && !movedRef.current) {
        if (Math.hypot(e.clientX - downPosRef.current.x, e.clientY - downPosRef.current.y) > 6) {
          movedRef.current = true;
        }
      }

      if (pointersRef.current.size >= 2 && pinchRef.current) {
        // Update the moving finger, then recompute from both.
        const pts = [...pointersRef.current.values()].slice(0, 2);
        const curDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const ratio = curDist / pinchRef.current.startDist;
        applyZoomToward(mid.x, mid.y, pinchRef.current.startZoom * ratio);
        return;
      }

      if (!isDraggingRef.current) return;
      panOffsetRef.current = {
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      };
      world.position.set(cx + panOffsetRef.current.x, cy + panOffsetRef.current.y);
    };

    const handleDoubleTap = (clientX, clientY) => {
      const now = performance.now();
      const last = lastTapRef.current;
      const isDouble =
        now - last.t < 300 &&
        Math.abs(clientX - last.x) < 24 &&
        Math.abs(clientY - last.y) < 24;

      if (isDouble) {
        lastTapRef.current = { t: 0, x: 0, y: 0 };
        if (zoomRef.current >= 8.0) {
          // Zoomed in → reset to default.
          zoomRef.current = 3.0;
          panOffsetRef.current = { x: 0, y: 0 };
          world.scale.set(3.0);
          world.position.set(cx, cy);
          if (redrawDomeRef.current) redrawDomeRef.current(3.0);
          if (updateElementsScaleRef.current) updateElementsScaleRef.current(3.0);
        } else {
          // Zoom in 2.5× toward the tap point.
          applyZoomToward(clientX, clientY, zoomRef.current * 2.5);
        }
      } else {
        lastTapRef.current = { t: now, x: clientX, y: clientY };
      }
    };

    const handleWindowPointerUp = (e) => {
      pointersRef.current.delete(e.pointerId);

      if (pinchRef.current && pointersRef.current.size < 2) {
        // Pinch ended. If one finger remains down, re-seed pan from it so the
        // sky doesn't jump when the second finger lifts.
        pinchRef.current = null;
        if (pointersRef.current.size === 1) {
          const rem = [...pointersRef.current.values()][0];
          isDraggingRef.current = true;
          dragStartRef.current = {
            x: rem.x - panOffsetRef.current.x,
            y: rem.y - panOffsetRef.current.y
          };
        }
        return;
      }

      if (isDraggingRef.current && pointersRef.current.size === 0) {
        isDraggingRef.current = false;
        // A tap on empty sky (no sprite selected, negligible movement)?
        if (!movedRef.current && !spriteTapRef.current) {
          handleDoubleTap(e.clientX, e.clientY);
        }
      }
    };

    const handleWindowWheel = (e) => {
      if (!canvasWrapRef.current || !canvasWrapRef.current.contains(e.target)) return;
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      applyZoomToward(e.clientX, e.clientY, zoomRef.current * zoomFactor);
    };

    window.addEventListener("pointerdown", handleWindowPointerDown);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("pointercancel", handleWindowPointerUp);
    app.view.addEventListener("wheel", handleWindowWheel, { passive: false });

    // Handle Resize
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      app.renderer.resize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      app.ticker.remove(updateLOD);
      window.removeEventListener("pointerdown", handleWindowPointerDown);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("pointercancel", handleWindowPointerUp);
      window.removeEventListener("resize", handleResize);
      pointersRef.current.clear();

      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, []);

  // Re-draw scene when data, active selection, or coordinates change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const app = appRef.current;
    const world = worldRef.current;
    const starTexture = starTextureRef.current;
    const containers = starsContainersRef.current;
    const linesGraphics = linesGraphicsRef.current;
    const labelsContainer = labelsContainerRef.current;
    const objectsContainer = objectsContainerRef.current;

    if (!app || !world || !starTexture || !containers || !containers.length || !linesGraphics || !labelsContainer || !objectsContainer || !celestialData) return;

    const { cx, cy, rHor } = getViewportParams();
    const z = zoomRef.current;

    // Clear previous elements
    containers.forEach((c) => c.removeChildren());
    linesGraphics.clear();
    labelsContainer.removeChildren();
    objectsContainer.removeChildren();
    constLabelsRef.current = [];
    cardinalLabelsRef.current = [];

    // --- 1. Populate Star Sprites ---
    celestialData.forEach((s) => {
      const starLoc = raDecToAltAz(s[1], s[2], latLon.lat, latLon.lon, currentTime);
      if (starLoc.alt <= -12) return; // Horizon cutoff

      const xy = altAzToXY(starLoc.alt, starLoc.az, cx, cy, rHor);
      const sprite = new PIXI.Sprite(starTexture);
      sprite.anchor.set(0.5);
      sprite.position.set(xy.x, xy.y);
      sprite.userAlt = starLoc.alt; // true sky position, used to re-project in gyro mode
      sprite.userAz = starLoc.az;

      // Star size with inverse-scaling applied directly at creation
      const r = dotRadius(s[3]);
      sprite.starRadius = r; // Cache base radius
      sprite.scale.set(r / (10 * z)); // Screen-space size remains strictly equal to r * 2
      
      // Set a comfortable hit testing area of 14px radius on screen
      sprite.hitArea = new PIXI.Circle(0, 0, Math.max(10, 140 / r));
      
      // Base opacity based on magnitude (scaled dynamically to 10.5)
      const baseAlpha = 0.15 + (10.5 - s[3]) * 0.08;
      sprite.alpha = Math.max(0.1, Math.min(1.0, baseAlpha));

      // TINT COLORING matching mini-map active/season states
      const conAbbr = s[6];
      if (conAbbr) {
        const isActive = activeConst === conAbbr;
        const details = getConstellationDetails(conAbbr, lang);
        const isSeason = seasonFilter ? details.seasonKey === seasonFilter : false;

        if (isActive) {
          sprite.tint = s[3] <= 2.2 ? 0xffffff : 0x4fd1c5; // Teal (white for bright stars)
        } else if (isSeason) {
          sprite.tint = 0xffc873; // Yellow-gold in-season
        } else {
          sprite.tint = 0xffffff;
        }
      } else {
        sprite.tint = 0xffffff;
      }

      // Interactivity for all stars (including dim ones)
      sprite.eventMode = "static";
      sprite.cursor = "pointer";
      
      const starObj = {
        type: "star",
        id: s[0],
        name: s[4] || s[5] || `HIP ${s[0]}`,
        bayer: s[5] || "",
        mag: s[3],
        ra: s[1],
        dec: s[2],
        alt: starLoc.alt,
        az: starLoc.az,
        const: s[6] || ""
      };

      sprite.on("pointerover", (e) => {
        if (e.pointerType === "touch") return; // no hover concept on touch — avoid tooltip flicker while panning
        setHoveredObj({
          ...starObj,
          x: e.global.x + 15,
          y: e.global.y + 15
        });
      });
      sprite.on("pointerout", () => setHoveredObj(null));
      sprite.on("pointertap", (e) => {
        if (movedRef.current) return; // pan/drag gesture, not a real tap — the object rode along under the finger
        e.stopPropagation();
        spriteTapRef.current = true; // selection tap — suppress double-tap zoom
        setSelectedObj(starObj);
        if (s[6]) setActiveConst(s[6]);
      });

      // Put in corresponding LOD container
      const mag = s[3];
      if (mag <= 5.0) {
        containers[0].addChild(sprite);
      } else if (mag <= 6.5) {
        containers[1].addChild(sprite);
      } else if (mag <= 7.5) {
        containers[2].addChild(sprite);
      } else if (mag <= 8.5) {
        containers[3].addChild(sprite);
      } else {
        containers[4].addChild(sprite);
      }
    });

    // --- 2. Draw Constellations ---
    fetch("/data/celestial_data.json")
      .then((res) => res.json())
      .then((jsonData) => {
        if (!jsonData || !jsonData.constellations) return;
        constellationsDataRef.current = jsonData.constellations;

        jsonData.constellations.forEach((c) => {
          const centerLoc = raDecToAltAz(c.ra, c.dec, latLon.lat, latLon.lon, currentTime);
          if (centerLoc.alt <= -12) return;

          const xyCenter = altAzToXY(centerLoc.alt, centerLoc.az, cx, cy, rHor);
          const details = getConstellationDetails(c.id, lang);
          const isSeason = seasonFilter ? details.seasonKey === seasonFilter : false;
          const isActive = activeConst === c.id;

          // Draw lines matching mini-map active/season colors
          let lColor = 0x415b77;
          let lAlpha = 0.35;
          let lWidth = 1.1 / z;

          if (isActive) {
            lColor = 0x4fd1c5; // Teal active lines
            lAlpha = 1.0;
            lWidth = 1.8 / z;
          } else if (isSeason) {
            lColor = 0xe8b94d; // Yellow-gold in-season lines
            lAlpha = 0.45;
          }

          linesGraphics.lineStyle({
            width: lWidth,
            color: lColor,
            alpha: lAlpha
          });
          
          c.lines.forEach((line) => {
            line.forEach((pt, idx) => {
              const ptLoc = raDecToAltAz(pt[0], pt[1], latLon.lat, latLon.lon, currentTime);
              const xyPt = altAzToXY(ptLoc.alt, ptLoc.az, cx, cy, rHor);
              if (idx === 0) {
                linesGraphics.moveTo(xyPt.x, xyPt.y);
              } else {
                linesGraphics.lineTo(xyPt.x, xyPt.y);
              }
            });
          });

          const labelText = lang === "en" ? c.name : c.uk;

          // Label text style matching mini-map active/season colors
          let labelColor = 0x8a99ad;
          if (isActive) {
            labelColor = 0x4fd1c5;
          } else if (isSeason) {
            labelColor = 0xffc873;
          }

          const style = new PIXI.TextStyle({
            fontFamily: "var(--font-body)",
            fontSize: 10 / z,
            fill: labelColor,
            fontWeight: isActive ? "600" : "normal",
            align: "center"
          });
          const textNode = new PIXI.Text(labelText, style);
          textNode.anchor.set(0.5);
          textNode.position.set(xyCenter.x, xyCenter.y);
          
          // Make label clickable to select constellation
          textNode.eventMode = "static";
          textNode.cursor = "pointer";
          textNode.on("pointertap", (e) => {
            if (movedRef.current) return; // pan/drag gesture, not a real tap
            e.stopPropagation();
            spriteTapRef.current = true; // selection tap — suppress double-tap zoom
            setActiveConst(c.id);
            setSelectedObj({
              type: "constellation",
              id: c.id,
              name: lang === "en" ? c.name : c.uk,
              la: c.la,
              ra: c.ra,
              dec: c.dec,
              alt: centerLoc.alt,
              az: centerLoc.az,
              star: details.star,
              season: details.season,
              myth: details.myth
            });
          });

          labelsContainer.addChild(textNode);
          constLabelsRef.current.push({ node: textNode, alt: centerLoc.alt, az: centerLoc.az });
        });

        // Data arrived after the initial layout — if gyro mode is already on,
        // re-project these freshly created labels/lines onto the current
        // boresight immediately instead of flashing at their zenith-centered spots.
        if (gyroActiveRef.current && reprojectAllRef.current) {
          reprojectAllRef.current(boresightRef.current);
        }
      })
      .catch((err) => console.error("Failed to load constellations metadata:", err));

    // --- 3. Draw Cardinal & Coordinate grid labels (matching mini-map labels) ---
    const cardinalStyle = new PIXI.TextStyle({
      fontFamily: "var(--font-mono)",
      fontSize: 13 / z,
      fill: 0x8a99ad,
      alpha: 0.5,
      align: "center"
    });
    
    // N
    const textN = new PIXI.Text("N", cardinalStyle);
    textN.anchor.set(0.5, 1);
    textN.position.set(cx, cy - rHor - 8);
    labelsContainer.addChild(textN);
    cardinalLabelsRef.current.push({ node: textN, alt: 0, az: 0 });

    // S
    const textS = new PIXI.Text("S", cardinalStyle);
    textS.anchor.set(0.5, 0);
    textS.position.set(cx, cy + rHor + 16);
    labelsContainer.addChild(textS);
    cardinalLabelsRef.current.push({ node: textS, alt: 0, az: 180 });

    // E
    const textE = new PIXI.Text("E", cardinalStyle);
    textE.anchor.set(1, 0.5);
    textE.position.set(cx - rHor - 8, cy);
    labelsContainer.addChild(textE);
    cardinalLabelsRef.current.push({ node: textE, alt: 0, az: 90 });

    // W
    const textW = new PIXI.Text("W", cardinalStyle);
    textW.anchor.set(0, 0.5);
    textW.position.set(cx + rHor + 8, cy);
    labelsContainer.addChild(textW);
    cardinalLabelsRef.current.push({ node: textW, alt: 0, az: 270 });

    const ringStyle = new PIXI.TextStyle({
      fontFamily: "var(--font-mono)",
      fontSize: 10 / z,
      fill: 0x8a99ad,
      alpha: 0.5,
      align: "center"
    });

    // 30° Ring label (matching the 0.68 altitude ring)
    const text30 = new PIXI.Text("30°", ringStyle);
    text30.anchor.set(0.5);
    text30.position.set(cx, cy - rHor * 0.68 - 8);
    labelsContainer.addChild(text30);

    // 60° Ring label (matching the 0.36 altitude ring)
    const text60 = new PIXI.Text("60°", ringStyle);
    text60.anchor.set(0.5);
    text60.position.set(cx, cy - rHor * 0.36 - 8);
    labelsContainer.addChild(text60);

    // Zenith Center label
    const textZenith = new PIXI.Text(lang === "en" ? "Zenith" : "Зеніт", ringStyle);
    textZenith.anchor.set(0.5);
    textZenith.position.set(cx, cy - 14);
    labelsContainer.addChild(textZenith);

    // --- 4. Draw Planets, Sun, and Moon (with inverse scale applied) ---
    planetsData.forEach((p) => {
      if (p.alt <= -12) return;
      const xy = altAzToXY(p.alt, p.az, cx, cy, rHor);

      const objGraphics = new PIXI.Graphics();
      let color = 0xffffff;
      let size = 5;
      if (p.name_key === "sun") { color = 0xffa500; size = 8; }
      else if (p.name_key === "moon") { color = 0xdcdcdc; size = 7; }
      else if (p.name_key === "mars") { color = 0xff5a5f; size = 5.5; }
      else if (p.name_key === "jupiter") { color = 0xe0a96d; size = 6.5; }
      else if (p.name_key === "saturn") { color = 0xf4e0a5; size = 6; }
      else if (p.name_key === "venus") { color = 0xffeb60; size = 5.5; }
      else if (p.name_key === "mercury") { color = 0x8d8d8d; size = 4; }
      else if (p.name_key === "uranus") { color = 0xa5f4f4; size = 4.5; }
      else if (p.name_key === "neptune") { color = 0x4f73f4; size = 4.5; }

      objGraphics.beginFill(color);
      objGraphics.drawCircle(0, 0, size);
      objGraphics.endFill();

      if (p.name_key === "saturn") {
        objGraphics.lineStyle({
          width: 1.5,
          color: 0xd4c294,
          alpha: 0.7
        });
        objGraphics.drawEllipse(0, 0, size * 1.8, size * 0.4);
      }

      const objSprite = new PIXI.Container();
      objSprite.addChild(objGraphics);
      objSprite.position.set(xy.x, xy.y);
      objSprite.userAlt = p.alt; // true sky position, used to re-project in gyro mode
      objSprite.userAz = p.az;
      objSprite.scale.set(1 / z); // Inverse scaled to keep screen size constant
      
      // Set a comfortable hit testing area of 14px radius on screen
      objSprite.hitArea = new PIXI.Circle(0, 0, Math.max(size, 14));
      
      objSprite.eventMode = "static";
      objSprite.cursor = "pointer";

      const planetObj = {
        type: "planet",
        name_key: p.name_key,
        name: p.name,
        emoji: p.emoji,
        alt: p.alt,
        az: p.az,
        mag: p.mag,
        visible: p.visible,
        phase: p.phase,
        illum: p.illum
      };

      objSprite.on("pointerover", (e) => {
        if (e.pointerType === "touch") return; // no hover concept on touch — avoid tooltip flicker while panning
        setHoveredObj({
          ...planetObj,
          x: e.global.x + 15,
          y: e.global.y + 15
        });
      });
      objSprite.on("pointerout", () => setHoveredObj(null));
      objSprite.on("pointertap", (e) => {
        if (movedRef.current) return; // pan/drag gesture, not a real tap — the object rode along under the finger
        e.stopPropagation();
        spriteTapRef.current = true; // selection tap — suppress double-tap zoom
        setSelectedObj(planetObj);
      });

      objectsContainer.addChild(objSprite);
    });

    // --- 5. Draw Galaxies (with inverse scale applied) ---
    galaxiesData.forEach((g) => {
      const galLoc = raDecToAltAz(g.ra, g.dec, latLon.lat, latLon.lon, currentTime);
      if (galLoc.alt <= -12) return;
      const xy = altAzToXY(galLoc.alt, galLoc.az, cx, cy, rHor);

      const galGraphics = new PIXI.Graphics();
      galGraphics.lineStyle({
        width: 1.5,
        color: 0xa29bfe,
        alpha: 0.85
      });
      galGraphics.drawEllipse(0, 0, 10, 4);
      galGraphics.beginFill(0xe8dbff);
      galGraphics.drawCircle(0, 0, 3);
      galGraphics.endFill();

      const galContainer = new PIXI.Container();
      galContainer.addChild(galGraphics);
      galContainer.position.set(xy.x, xy.y);
      galContainer.userAlt = galLoc.alt; // true sky position, used to re-project in gyro mode
      galContainer.userAz = galLoc.az;
      galContainer.rotation = 0.35;
      galContainer.scale.set(1 / z); // Inverse scaled to keep screen size constant
      
      // Set a comfortable hit testing area of 16px radius on screen
      galContainer.hitArea = new PIXI.Circle(0, 0, 16);
 
      galContainer.eventMode = "static";
      galContainer.cursor = "pointer";

      const galObj = {
        type: "galaxy",
        key: g.key,
        slug: g.slug,
        name: lang === "en" ? g.name_en : g.name_uk,
        designation: g.designation,
        dist_ly: g.dist_ly,
        dist_text: lang === "en" ? g.dist_text_en : g.dist_text_uk,
        diameter: g.diameter_ly,
        mag: g.magnitude,
        desc: lang === "en" ? g.description_en : g.description_uk,
        ra: g.ra,
        dec: g.dec,
        alt: galLoc.alt,
        az: galLoc.az
      };

      galContainer.on("pointerover", (e) => {
        if (e.pointerType === "touch") return; // no hover concept on touch — avoid tooltip flicker while panning
        setHoveredObj({
          ...galObj,
          x: e.global.x + 15,
          y: e.global.y + 15
        });
      });
      galContainer.on("pointerout", () => setHoveredObj(null));
      galContainer.on("pointertap", (e) => {
        if (movedRef.current) return; // pan/drag gesture, not a real tap — the object rode along under the finger
        e.stopPropagation();
        spriteTapRef.current = true; // selection tap — suppress double-tap zoom
        setSelectedObj(galObj);
      });

      objectsContainer.addChild(galContainer);
    });

    // Stars/planets/galaxies/cardinal labels above were just recreated at their
    // zenith-centered positions — if gyro mode is already on, immediately
    // re-project them onto the current boresight (constellation lines/labels
    // get the same treatment once their async fetch resolves, above).
    if (gyroActiveRef.current && reprojectAllRef.current) {
      reprojectAllRef.current(boresightRef.current);
    }
  }, [celestialData, planetsData, galaxiesData, currentTime, seasonFilter, latLon, activeConst, lang, setActiveConst]);

  // Highlight the tapped star/planet/galaxy with a ring on the sky itself (not
  // just the detail card). Constellations already get their own highlight via
  // tinted stars/lines, so they're excluded here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedObj || selectedObj.type === "constellation" || selectedObj.alt == null || selectedObj.az == null) {
      selectedWorldPosRef.current = null;
    } else {
      selectedWorldPosRef.current = { alt: selectedObj.alt, az: selectedObj.az };
    }
    drawSelectionRing(zoomRef.current, gyroActiveRef.current ? boresightRef.current : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObj]);

  // Handle zooming using floating UI buttons
  const handleUiZoom = (zoomIn) => {
    const world = worldRef.current;
    if (!world) return;

    const prevZoom = zoomRef.current;
    const nextZoom = zoomIn ? Math.min(6000.0, prevZoom * 1.3) : Math.max(1.0, prevZoom * 0.75);
    zoomRef.current = nextZoom;

    panOffsetRef.current = {
      x: panOffsetRef.current.x * (nextZoom / prevZoom),
      y: panOffsetRef.current.y * (nextZoom / prevZoom)
    };

    world.scale.set(nextZoom);
    world.position.set(window.innerWidth / 2 + panOffsetRef.current.x, window.innerHeight / 2 + panOffsetRef.current.y);

    // Apply inverse scaling to elements during UI zoom events
    updateElementsScale(nextZoom);
  };

  const handleUiReset = () => {
    const world = worldRef.current;
    if (!world) return;
    zoomRef.current = 3.0;
    panOffsetRef.current = { x: 0, y: 0 };
    world.scale.set(3.0);
    world.position.set(window.innerWidth / 2, window.innerHeight / 2);

    // Apply base scale to elements
    updateElementsScale(3.0);
  };

  // Orientation-sensor tick: derive where the phone points, smooth it (compass
  // sensors are noisy), throttle to ~10Hz to bound the re-projection cost of
  // potentially tens of thousands of star sprites, and re-render the scene
  // around that boresight.
  const GYRO_TICK_MS = 100;
  const GYRO_SMOOTHING = 0.25;
  const handleOrientation = (event) => {
    const now = performance.now();
    if (now - lastGyroTickRef.current < GYRO_TICK_MS) return;
    lastGyroTickRef.current = now;

    const result = computeHeadingAlt(event);
    if (!result) return;

    const prev = boresightRef.current;
    const nextBoresight = {
      alt: prev.alt + (result.alt - prev.alt) * GYRO_SMOOTHING,
      az: lerpAngleDeg(prev.az, result.az, GYRO_SMOOTHING)
    };
    boresightRef.current = nextBoresight;
    setGyroHeading(Math.round(nextBoresight.az));

    if (reprojectAllRef.current) reprojectAllRef.current(nextBoresight);
  };

  const handleToggleGyro = async () => {
    const world = worldRef.current;

    if (gyroActive) {
      // Turn off: drop the listener, snap the scene back to zenith-centered,
      // and restore whatever zoom/pan the user had before enabling it.
      if (orientationHandlerRef.current) {
        window.removeEventListener("deviceorientationabsolute", orientationHandlerRef.current);
        window.removeEventListener("deviceorientation", orientationHandlerRef.current);
        orientationHandlerRef.current = null;
      }
      boresightRef.current = { alt: 90, az: 0 };
      gyroActiveRef.current = false;
      setGyroHeading(null);
      setGyroActive(false);

      const saved = savedViewRef.current;
      savedViewRef.current = null;
      const restoredZoom = saved ? saved.zoom : 3.0;
      const restoredPan = saved ? saved.pan : { x: 0, y: 0 };
      zoomRef.current = restoredZoom;
      panOffsetRef.current = restoredPan;
      if (world) {
        world.scale.set(restoredZoom);
        world.position.set(window.innerWidth / 2 + restoredPan.x, window.innerHeight / 2 + restoredPan.y);
      }
      if (redrawDomeRef.current) redrawDomeRef.current(restoredZoom);
      if (reprojectAllRef.current) reprojectAllRef.current(null);
      if (updateElementsScaleRef.current) updateElementsScaleRef.current(restoredZoom);
      return;
    }

    setGyroError(null);

    // iOS 13+ Safari requires an explicit, gesture-triggered permission prompt;
    // every other browser exposing the API grants it implicitly.
    let granted = true;
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const res = await DeviceOrientationEvent.requestPermission();
        granted = res === "granted";
      } catch (e) {
        granted = false;
      }
    }
    if (!granted) {
      setGyroError(
        lang === "en"
          ? "Motion access denied — enable it in Settings to use sky-pointing mode."
          : "Доступ до датчиків руху відхилено — увімкни його в налаштуваннях, щоб користуватись режимом наведення на небо."
      );
      return;
    }

    savedViewRef.current = { zoom: zoomRef.current, pan: { ...panOffsetRef.current } };
    boresightRef.current = { alt: 45, az: 0 };
    lastGyroTickRef.current = 0;

    orientationHandlerRef.current = handleOrientation;
    if ("ondeviceorientationabsolute" in window) {
      window.addEventListener("deviceorientationabsolute", handleOrientation);
    } else {
      window.addEventListener("deviceorientation", handleOrientation);
    }

    const arZoom = 8;
    zoomRef.current = arZoom;
    panOffsetRef.current = { x: 0, y: 0 };
    if (world) {
      world.scale.set(arZoom);
      world.position.set(window.innerWidth / 2, window.innerHeight / 2);
    }
    if (redrawDomeRef.current) redrawDomeRef.current(arZoom);
    if (updateElementsScaleRef.current) updateElementsScaleRef.current(arZoom);
    if (reprojectAllRef.current) reprojectAllRef.current(boresightRef.current);

    gyroActiveRef.current = true;
    setGyroActive(true);
  };

  // Keyboard navigation Escape to close
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sidebar detail panel render fragment
  const renderDetailCard = selectedObj && (
    <div className="cfm-fs-card open">
      <button className="cfm-fs-card-close" onClick={() => setSelectedObj(null)} aria-label={t("jupiter.system.close")}>
        ✕
      </button>
      <div className="cfm-fs-card-header">
        {selectedObj.emoji && <span className="cfm-fs-card-emoji">{selectedObj.emoji}</span>}
        <div>
          <div className="cfm-fs-card-title">{selectedObj.name}</div>
          <div className="cfm-fs-card-subtitle">
            {selectedObj.type === "galaxy" ? selectedObj.designation : (selectedObj.type === "constellation" ? selectedObj.la : selectedObj.bayer || selectedObj.type)}
          </div>
        </div>
      </div>

      {objectImageUrl && (
        <div className="cfm-fs-card-media">
          <img
            src={objectImageUrl}
            alt={selectedObj.name}
            className={`cfm-fs-card-img ${selectedObj.type === "planet" ? "contain-planet" : ""}`}
          />
        </div>
      )}

      {selectedObj.type === "star" && (
        <div className="cfm-fs-card-star-glow">
          <div className="airy-disk" style={{ "--glow-color": getStarColorInfo(selectedObj.id).color }} />
          <div className="star-spikes">
            <div className="star-spike-h" style={{ "--glow-color": getStarColorInfo(selectedObj.id).color }} />
            <div className="star-spike-v" style={{ "--glow-color": getStarColorInfo(selectedObj.id).color }} />
            <div className="star-spike-d1" style={{ "--glow-color": getStarColorInfo(selectedObj.id).color }} />
            <div className="star-spike-d2" style={{ "--glow-color": getStarColorInfo(selectedObj.id).color }} />
          </div>
          <div
            className="star-sphere"
            style={{
              "--glow-color": getStarColorInfo(selectedObj.id).color
            }}
          />
          <span style={{ position: "absolute", bottom: 8, right: 12, fontSize: "9px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {getStarColorInfo(selectedObj.id).name}
          </span>
        </div>
      )}

      <div className="cfm-fs-card-body">
        {selectedObj.type === "star" && (
          <div className="cfm-card-rows">
            <div className="cfm-card-row"><span>{hudLabels.bayer}</span><b>{selectedObj.bayer || "—"}</b></div>
            <div className="cfm-card-row"><span>{hudLabels.catalog}</span><b>HIP {selectedObj.id}</b></div>
            <div className="cfm-card-row"><span>{hudLabels.mag}</span><b>{selectedObj.mag.toFixed(2)}m</b></div>
            <div className="cfm-card-row"><span>{hudLabels.radec}</span><b>{formatRA(selectedObj.ra)} / {formatDec(selectedObj.dec)}</b></div>
            <div className="cfm-card-row"><span>{hudLabels.altaz}</span><b>{selectedObj.alt.toFixed(1)}° / {selectedObj.az.toFixed(1)}°</b></div>
            {selectedObj.const && (
              <div className="cfm-card-row"><span>{hudLabels.constellation}</span><b>{selectedObj.const}</b></div>
            )}
          </div>
        )}

        {selectedObj.type === "constellation" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="cfm-card-rows">
              <div className="cfm-card-row"><span>{lang === "en" ? "Latin Name" : "Латинська назва"}</span><b>{selectedObj.la}</b></div>
              <div className="cfm-card-row"><span>{hudLabels.season}</span><b>{selectedObj.season}</b></div>
              <div className="cfm-card-row"><span>{hudLabels.stars}</span><b>{selectedObj.star}</b></div>
              <div className="cfm-card-row"><span>{hudLabels.altaz}</span><b>{selectedObj.alt.toFixed(1)}° / {selectedObj.az.toFixed(1)}°</b></div>
            </div>
            <p className="cfm-fs-card-desc">{selectedObj.myth}</p>
          </div>
        )}
        
        {selectedObj.type === "planet" && (
          <div className="cfm-card-rows">
            <div className="cfm-card-row"><span>{hudLabels.mag}</span><b>{selectedObj.mag != null ? `${selectedObj.mag.toFixed(1)}m` : "—"}</b></div>
            <div className="cfm-card-row"><span>{hudLabels.altaz}</span><b>{selectedObj.alt.toFixed(1)}° / {selectedObj.az.toFixed(1)}°</b></div>
            <div className="cfm-card-row"><span>{hudLabels.visibility}</span><b>{selectedObj.visible ? (lang === "en" ? "Visible" : "Видно") : (lang === "en" ? "Below horizon" : "Під горизонтом")}</b></div>
            {selectedObj.phase != null && (
              <div className="cfm-card-row"><span>{hudLabels.phase}</span><b>{Math.round(selectedObj.illum * 100)}%</b></div>
            )}
          </div>
        )}

        {selectedObj.type === "galaxy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="cfm-card-rows">
              <div className="cfm-card-row"><span>{hudLabels.distance}</span><b>{selectedObj.dist_text}</b></div>
              <div className="cfm-card-row"><span>{hudLabels.diameter}</span><b>{selectedObj.diameter}</b></div>
              <div className="cfm-card-row"><span>{hudLabels.mag}</span><b>{selectedObj.mag}m</b></div>
            </div>
            <p className="cfm-fs-card-desc">
              {detailedGalaxy ? detailedGalaxy.description : (lang === "en" ? "Loading description..." : "Завантаження опису...")}
            </p>
            {detailedGalaxy && detailedGalaxy.fact && (
              <p className="cfm-fs-card-desc" style={{ fontStyle: "italic", borderLeft: "2px solid var(--accent)", paddingLeft: "10px", marginTop: "4px" }}>
                {detailedGalaxy.fact}
              </p>
            )}
            <a href={pathFor("galaxies", lang) + "/" + selectedObj.slug} className="btn primary cfm-fs-card-link">
              {lang === "en" ? "Open galaxy profile" : "Відкрити профіль галактики"} →
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    <div className="cfm-fullscreen-wrap" role="dialog" aria-modal="true" aria-label={lang === "en" ? "Constellations map" : "Карта сузір'їв"}>
      {/* Pixi Canvas Layer */}
      <div ref={canvasWrapRef} className="cfm-map-layer" style={{ cursor: isDraggingRef.current ? "grabbing" : "grab" }} />

      {/* Floating zoom buttons */}
      <div className="const-zoom-col">
        <button className="btn ghost const-zoom-btn" onClick={() => handleUiZoom(true)} title={lang === "en" ? "Zoom In" : "Збільшити"}>+</button>
        <button className="btn ghost const-zoom-btn" onClick={() => handleUiZoom(false)} title={lang === "en" ? "Zoom Out" : "Зменшити"}>−</button>
        <button className="btn ghost const-zoom-btn" onClick={handleUiReset} title={lang === "en" ? "Reset View" : "Скинути вигляд"}>↺</button>
      </div>

      {/* Top-left title bar */}
      <div className="cfm-top-bar">
        <div>
          <div className="cfm-title">{lang === "en" ? "Space explorer" : "Дослідник космосу"}</div>
          <div className="cfm-sub">
            {lang === "en"
              ? "Immersive WebGL sky chart — zoom to view 60,000+ real stars, planets, and galaxies."
              : "Повноекранна WebGL-карта — наближуй, щоб вивчати 60 000+ реальних зірок, планет та галактик."}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {gyroSupported && (
            <div className="cfm-gyro-group">
              <button
                type="button"
                className={`cfm-btn ${gyroActive ? "cfm-btn-active" : ""}`}
                onClick={handleToggleGyro}
                title={lang === "en" ? "Point your phone at the sky" : "Наведи телефон на небо"}
                aria-pressed={gyroActive}
                aria-label={lang === "en" ? "Toggle sky-pointing mode" : "Перемкнути режим наведення на небо"}
              >
                🧭
              </button>
              {gyroActive && gyroHeading != null && <div className="cfm-gyro-badge">{gyroHeading}°</div>}
              {gyroError && <div className="cfm-gyro-error">{gyroError}</div>}
            </div>
          )}
          <button className="cfm-btn cfm-btn-close" onClick={onClose} aria-label={lang === "en" ? "Close" : "Закрити"}>✕</button>
        </div>
      </div>

      {/* Bottom floating controls panel */}
      <div className={`cfm-bottom-bar ${hideBottomBar ? "collapsed" : ""}`}>
        <button
          type="button"
          className="cfm-toggle-bar-btn"
          onClick={() => setHideBottomBar(!hideBottomBar)}
          aria-label={hideBottomBar ? (lang === "en" ? "Show Panel" : "Показати панель") : (lang === "en" ? "Hide Panel" : "Сховати панель")}
        >
          {hideBottomBar ? "▲" : "▼"} {lang === "en" ? (hideBottomBar ? "Show Panel" : "Hide Panel") : (hideBottomBar ? "Показати панель" : "Сховати панель")}
        </button>
        <div className="cfm-control-row">
          {geoControlsCompact}
        </div>
        {statusMsg && (
          <div className={`geo-status cfm-status ${statusMsg.includes("Не вдалося") || statusMsg.includes("failed") ? "err" : (seasonFilter || geoInfo ? "ok" : "")}`}>
            {statusMsg}
          </div>
        )}
        <div className="cfm-pills-row" style={{ justifyContent: "center" }}>
          {pillsInner}
        </div>
      </div>

      {/* Interactive Tooltip (fixed position in screen coordinates) */}
      {hoveredObj && (
        <div className="const-tooltip show" style={{ left: hoveredObj.x, top: hoveredObj.y, padding: "12px 14px", minWidth: 260 }}>
          <div className="tt-name" style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.15)", paddingBottom: 6, marginBottom: 6, color: "#FFC873" }}>
            {hoveredObj.emoji && <span style={{ marginRight: 6 }}>{hoveredObj.emoji}</span>}
            {hoveredObj.name}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "4px 8px", fontSize: "11px", color: "var(--text-light)", fontFamily: "var(--font-mono)" }}>
            {hoveredObj.type === "star" && (
              <>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Catalog number" : "Номер каталогу"}:</span>
                <span>HIP {hoveredObj.id}</span>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Magnitude" : "Зоряна величина"}:</span>
                <span style={{ color: "#FFC873", fontWeight: "bold" }}>{hoveredObj.mag.toFixed(2)}m</span>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Alt / Az" : "Висота / Азимут"}:</span>
                <span style={{ color: "#50e3c2" }}>{hoveredObj.alt.toFixed(1)}° / {hoveredObj.az.toFixed(1)}°</span>
              </>
            )}
            
            {hoveredObj.type === "planet" && (
              <>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Type" : "Тип"}:</span>
                <span>{lang === "en" ? "Solar System Body" : "Тіло Сонячної системи"}</span>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Magnitude" : "Зоряна величина"}:</span>
                <span style={{ color: "#FFC873", fontWeight: "bold" }}>{hoveredObj.mag != null ? `${hoveredObj.mag.toFixed(1)}m` : "—"}</span>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Alt / Az" : "Висота / Азимут"}:</span>
                <span style={{ color: "#50e3c2" }}>{hoveredObj.alt.toFixed(1)}° / {hoveredObj.az.toFixed(1)}°</span>
              </>
            )}

            {hoveredObj.type === "galaxy" && (
              <>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Designation" : "Позначення"}:</span>
                <span>{hoveredObj.designation}</span>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Distance" : "Відстань"}:</span>
                <span>{hoveredObj.dist_text}</span>
                <span style={{ color: "var(--text-dim)" }}>{lang === "en" ? "Magnitude" : "Зоряна величина"}:</span>
                <span style={{ color: "#FFC873", fontWeight: "bold" }}>{hoveredObj.mag}m</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Detailed sidebar panel */}
      {renderDetailCard}
    </div>,
    document.body
  );
}

// Path navigation helper (for router)
function pathFor(name, lang) {
  const prefix = lang === "uk" ? "/ua" : "";
  if (name === "home") return prefix || "/";
  if (name === "galaxies") return `${prefix}/galaxies`;
  return `${prefix}/${name}`;
}
