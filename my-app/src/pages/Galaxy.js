// Single galaxy detail page (/galaxies/:slug). The server injects per-galaxy
// SEO meta (title/desc/canonical) for crawlers; this component fetches
// /api/galaxies/:slug and renders an animated full-bleed hero with spec chips,
// a stat-tile grid (count-up numbers, click-to-scroll), a log distance scale,
// an interactive all-sky "where to find it" chart (hover RA/Dec readout,
// toggleable Milky Way / ecliptic / grid layers, the galaxy's own constellation
// stick-figure highlighted), the curated description, and a masonry gallery
// with a zoom/pan lightbox.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { useCountUp } from "../hooks/useCountUp";
import { useReveal } from "../hooks/useReveal";
import { getGalaxy } from "../lib/api";
import { pathFor, SITE_URL } from "../lib/seo";
import { constellationName } from "../lib/constellation_names";
import LocalizedLink from "../components/primitives/LocalizedLink";
import GalaxySkyMap from "../components/GalaxySkyMap";
import MorphologyBadge from "../components/MorphologyBadge";
import "../styles/gallery.css"; // .photo-modal lightbox
import "../styles/news.css"; // .article-back / .article-body
import "../styles/constellations.css"; // .sky-map + .const-info-row

// RA (deg) → h m s, Dec (deg) → ° ′ ″ for a proper equatorial readout.
function fmtRa(deg) {
  if (deg == null || isNaN(deg)) return "—";
  const h = deg / 15;
  const hi = Math.floor(h);
  const mi = Math.floor((h - hi) * 60);
  const s = ((h - hi) * 60 - mi) * 60;
  return `${hi}h ${mi}m ${s.toFixed(1)}s`;
}
function fmtDec(deg) {
  if (deg == null || isNaN(deg)) return "—";
  const sign = deg < 0 ? "−" : "+";
  const a = Math.abs(deg);
  const d = Math.floor(a);
  const mi = Math.floor((a - d) * 60);
  const s = ((a - d) * 60 - mi) * 60;
  return `${sign}${d}° ${mi}′ ${s.toFixed(0)}″`;
}

// Log-scale distance mini-bar: 10⁴ → 10⁹ light-years. Plots the galaxy's
// dist_ly plus reference landmarks (Andromeda, Virgo cluster).
const LOG_MIN = 4, LOG_MAX = 9;
const distX = (ly) => {
  if (!ly || ly <= 0) return null;
  const v = Math.log10(ly);
  return Math.max(0, Math.min(1, (v - LOG_MIN) / (LOG_MAX - LOG_MIN)));
};
const SCALE_TICKS = [4, 5, 6, 7, 8, 9];

function DistanceScale({ distLy, distText, t, id }) {
  const x = distX(distLy);
  const { ref, shown } = useReveal({ threshold: 0.3 });
  if (x == null) return null; // MW (dist_ly=0) — no meaningful distance
  const refs = [
    { ly: 2.5e6, label: t("galaxy.scaleLegend").split("→")[1]?.trim() || "Andromeda" },
    { ly: 5e7, label: t("galaxy.scaleLegend").split("→")[2]?.trim() || "Virgo" },
  ].filter((r) => r.label);
  return (
    <div className={"dist-scale reveal" + (shown ? " in" : "")} ref={ref} id={id}>
      <div className="dist-scale-head">
        <span className="dist-scale-title">{t("galaxy.distanceScale")}</span>
        <span className="dist-scale-now">{distText}</span>
      </div>
      <div className="dist-scale-track">
        {SCALE_TICKS.map((tk) => (
          <span key={tk} className="dist-scale-tick" style={{ left: `${((tk - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100}%` }}>
            10{tk === 4 ? "⁴" : tk === 5 ? "⁵" : tk === 6 ? "⁶" : tk === 7 ? "⁷" : tk === 8 ? "⁸" : "⁹"}
          </span>
        ))}
        <span className="dist-scale-bar" />
        {refs.map((r) => {
          const rx = distX(r.ly);
          return rx == null ? null : (
            <span key={r.ly} className="dist-scale-ref" style={{ left: `${rx * 100}%` }} title={`${r.label}`} />
          );
        })}
        <span
          className="dist-scale-dot"
          style={{ left: `${x * 100}%`, transitionDelay: shown ? "0.2s" : "0s", opacity: shown ? 1 : 0 }}
          title={distText}
        />
      </div>
      <div className="dist-scale-legend">{t("galaxy.scaleLegend")}</div>
    </div>
  );
}

// ---- stat-tile icons (inline 24×24 stroke SVGs, gold) ---------------------
function TileIcon({ name }) {
  const common = { fill: "none", stroke: "var(--gold)", strokeWidth: 1.7,
    strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "distance": return (<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 12h18M3 12l5-5M3 12l5 5M21 12l-5-5M21 12l-5 5" {...common} /></svg>);
    case "diameter": return (<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" {...common} /><path d="M3 12h18M12 3v18" {...common} opacity="0.5" /></svg>);
    case "magnitude": return (<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z" {...common} /></svg>);
    case "redshift": return (<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 18l6-6 4 3 8-9" {...common} /><path d="M21 6h-5M21 6v5" {...common} /></svg>);
    case "type": return (<svg viewBox="0 0 24 24" width="22" height="22"><ellipse cx="12" cy="12" rx="9" ry="5" {...common} /><circle cx="12" cy="12" r="2" fill="var(--gold)" /></svg>);
    case "constellation": return (<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="6" cy="6" r="1.6" fill="var(--gold)" /><circle cx="18" cy="8" r="1.6" fill="var(--gold)" /><circle cx="15" cy="18" r="1.6" fill="var(--gold)" /><circle cx="7" cy="17" r="1.6" fill="var(--gold)" /><path d="M6 6l12 2-3 10-8-1z" {...common} opacity="0.5" /></svg>);
    case "season": return (<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="4" {...common} /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" {...common} /></svg>);
    case "coords": return (<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="9" {...common} /><path d="M12 3v18M3 12h18" {...common} opacity="0.5" /></svg>);
    default: return null;
  }
}

function StatTile({ icon, label, value, sub, onClick, numeric }) {
  const { ref, shown } = useReveal({ threshold: 0.25 });
  return (
    <button
      type="button"
      className={"stat-tile reveal" + (shown ? " in" : "") + (onClick ? " clickable" : "")}
      ref={ref}
      onClick={onClick}
      style={{ textAlign: "left" }}
    >
      <span className="stat-tile-ico"><TileIcon name={icon} /></span>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">{value}</span>
      {sub ? <span className="stat-tile-sub">{sub}</span> : null}
    </button>
  );
}

// Animated numeric stat tile — counts up once scrolled into view.
function CountTile({ icon, label, target, decimals = 0, suffix = "", sub, onClick }) {
  const { ref, value } = useCountUp(target, { decimals, duration: 1200 });
  return (
    <button
      type="button"
      className={"stat-tile clickable" + (onClick ? "" : " no-click")}
      ref={ref}
      onClick={onClick || (() => {})}
      style={{ textAlign: "left" }}
    >
      <span className="stat-tile-ico"><TileIcon name={icon} /></span>
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value">
        {value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}
      </span>
      {sub ? <span className="stat-tile-sub">{sub}</span> : null}
    </button>
  );
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function Galaxy({ slug }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data, loading, error } = useApi(() => getGalaxy(slug, lang), {
    deps: [slug, lang],
  });
  const [modalIdx, setModalIdx] = useState(null);
  const [loaded, setLoaded] = useState({});
  // Lightbox zoom/pan
  const [zoom, setZoom] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const heroBgRef = useRef(null);

  const g = data && data.available ? data : null;
  const photos = (g && g.photos) || [];
  const months = (g && g.best_month) ? t("galaxy.months", { returnObjects: true }) : null;
  const constName = g && g.constellation_abbr ? constellationName(g.constellation_abbr, lang) : null;

  useEffect(() => {
    if (g && g.name) document.title = `${g.name} — ${t("nav.galaxies")}`;
    if (g && g.slug) {
      const url = `${SITE_URL}${pathFor("galaxies", lang)}/${g.slug}`;
      let el = document.head.querySelector('link[rel="canonical"]');
      if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
      el.setAttribute("href", url);
    }
    document.body.classList.add("p-galaxy");
    return () => document.body.classList.remove("p-galaxy");
  }, [g, lang, t]);

  // Hero parallax — move the background slower than the page on scroll.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (heroBgRef.current) {
          heroBgRef.current.style.transform = `translate3d(0, ${y * 0.18}px, 0)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [g]);

  // Reset transient UI when navigating between galaxies (same component
  // instance is reused by the router, so close the lightbox + clear the
  // per-photo "loaded" map for the previous galaxy).
  useEffect(() => {
    setModalIdx(null);
    setZoom(false);
    setPan({ x: 0, y: 0 });
    setLoaded({});
  }, [slug]);

  // Lightbox keyboard nav + scroll lock.
  useEffect(() => {
    if (modalIdx === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModalIdx(null);
      else if (e.key === "ArrowLeft")
        setModalIdx((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
      else if (e.key === "ArrowRight")
        setModalIdx((i) => (i === null ? null : (i + 1) % photos.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIdx, photos.length]);

  // Reset zoom/pan when switching photos.
  useEffect(() => { setZoom(false); setPan({ x: 0, y: 0 }); }, [modalIdx]);

  const photo = modalIdx != null ? photos[modalIdx] : null;
  const heroImg = photos[0] && photos[0].full ? photos[0].full : null;

  // ---- stat tiles data ----
  const distLy = g && g.dist_ly;
  const distMly = distLy && distLy > 0 ? distLy / 1e6 : null;
  const magNum = g && g.magnitude ? parseFloat(g.magnitude) : null;
  const zNum = g && g.redshift != null ? Number(g.redshift) : null;

  return (
    <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
      <section className="page-head">
        <LocalizedLink to="galaxies" className="article-back">
          ← {t("galaxy.back")}
        </LocalizedLink>

        {loading ? (
          <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 14 }}>
            {t("galaxies.loading")}
          </p>
        ) : error || !g ? (
          <div className="news-article-unavailable">
            <h3>{t("galaxy.noData")}</h3>
            <LocalizedLink to="galaxies" className="section-link" style={{ display: "inline-block", marginTop: 16 }}>
              ← {t("galaxy.back")}
            </LocalizedLink>
          </div>
        ) : (
          <div className="galaxy-hero">
            <div className="galaxy-hero-bg-wrap" ref={heroBgRef}>
              <div
                className="galaxy-hero-bg"
                style={heroImg ? {
                  backgroundImage: `url("${heroImg}")`,
                } : { background: "radial-gradient(ellipse at 50% 40%, #2a2340, #0d0f1c 70%)" }}
              />
            </div>
            <div className="galaxy-hero-scrim" />
            <div className="galaxy-hero-overlay">
              <span className="filter-pill on">{t(`galaxies.filters.${g.category}`)}</span>
              <h1 className="page-title galaxy-hero-title">{g.name}</h1>
              <div className="article-meta-row">
                {g.designation ? <span>{g.designation}</span> : null}
                {g.dist_text ? <><span>·</span><span>{g.dist_text}</span></> : null}
                {constName ? <><span>·</span><span>{constName}</span></> : null}
              </div>
              <div className="galaxy-spec-chips">
                {g.dist_text ? <button className="spec-chip" onClick={() => scrollToId("distance")}>{t("galaxy.distance")}: {g.dist_text}</button> : null}
                {g.ned_type ? <button className="spec-chip" onClick={() => scrollToId("data")}>{g.ned_type}</button> : null}
                {constName ? <button className="spec-chip" onClick={() => scrollToId("sky-pos")}>{constName}</button> : null}
                {g.magnitude ? <button className="spec-chip" onClick={() => scrollToId("data")}>m {g.magnitude}</button> : null}
              </div>
            </div>
          </div>
        )}
      </section>

      {g ? (
        <>
          <section className="section" id="data" style={{ paddingTop: 28 }}>
            <div className="galaxy-data-head">
              <div className="galaxy-data-head-left">
                <MorphologyBadge category={g.category} />
              </div>
              <div className="galaxy-data-head-right">
                <div className="eyebrow gold">{t("galaxy.dataTitle")}</div>
                <h2 className="section-title" style={{ margin: 0 }}>{g.name}</h2>
              </div>
            </div>

            <div className="stat-tiles">
              {distMly != null ? (
                <CountTile icon="distance" label={t("galaxy.distance")} target={distMly} decimals={distMly < 10 ? 2 : 1} suffix=" Mly" sub={g.dist_text} onClick={() => scrollToId("distance")} />
              ) : (
                <StatTile icon="distance" label={t("galaxy.distance")} value={g.dist_text || "—"} onClick={() => scrollToId("distance")} />
              )}
              <StatTile icon="diameter" label={t("galaxy.diameter")} value={g.diameter_ly || "—"} />
              {magNum != null && !isNaN(magNum) ? (
                <CountTile icon="magnitude" label={t("galaxy.magnitude")} target={magNum} decimals={1} />
              ) : (
                <StatTile icon="magnitude" label={t("galaxy.magnitude")} value={g.magnitude || "—"} />
              )}
              {zNum != null && !isNaN(zNum) ? (
                <CountTile icon="redshift" label={t("galaxy.redshift")} target={zNum} decimals={5} />
              ) : null}
              {g.ned_type ? <StatTile icon="type" label={t("galaxy.type")} value={g.ned_type} /> : null}
              {constName ? (
                <StatTile icon="constellation" label={t("galaxy.constellation")} value={constName} onClick={() => scrollToId("sky-pos")} />
              ) : null}
              {months && g.best_month ? (
                <StatTile icon="season" label={t("galaxy.bestTime")} value={months[g.best_month - 1]} />
              ) : null}
              {g.ra != null && g.dec != null ? (
                <StatTile icon="coords" label={t("galaxy.coords")} value={`${fmtRa(g.ra)} · ${fmtDec(g.dec)}`} />
              ) : null}
            </div>

            <DistanceScale distLy={distLy} distText={g.dist_text} t={t} id="distance" />

            {g.fact && (
              <div className="article-pullquote" style={{ marginTop: 26 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", letterSpacing: ".06em", marginBottom: 8 }}>
                  {t("galaxy.factLabel")}
                </div>
                {g.fact}
              </div>
            )}

            {g.description && (
              <div className="article-body" style={{ marginTop: 28 }}>
                {g.description.split("\n\n").map((p, i) => p.trim() ? <p key={i}>{p}</p> : null)}
              </div>
            )}
          </section>

          {(g.ra != null && g.dec != null) && (
            <section className="section" id="sky-pos" style={{ paddingTop: 8 }}>
              <div className="section-head">
                <div>
                  <div className="eyebrow gold">{t("galaxy.skyPosTitle")}</div>
                  <h2 className="section-title">{constName || g.name}</h2>
                  <p className="section-sub" style={{ marginTop: 10 }}>{t("galaxy.skyPosSub")}</p>
                </div>
              </div>
              <GalaxySkyMap
                ra={g.ra} dec={g.dec}
                name={g.name}
                abbr={g.constellation_abbr}
                constName={constName}
              />
            </section>
          )}

          <section className="section" id="gallery" style={{ paddingTop: 32 }}>
            <div className="section-head">
              <div>
                <div className="eyebrow gold">{t("galaxy.galleryTitle")}</div>
                <h2 className="section-title">{g.name}</h2>
                <p className="section-sub" style={{ marginTop: 10 }}>
                  {photos.length} {t("galaxy.photosCount")} · {t("galaxy.gallerySub")}
                </p>
              </div>
            </div>

            {photos.length === 0 ? (
              <p style={{ color: "var(--text-dim)", fontSize: 14 }}>{t("galaxy.noPhotos")}</p>
            ) : (
              <div className="gal">
                {photos.map((p, i) => (
                  <div
                    key={p.nasa_id || i}
                    className="ph"
                    title={t("galaxy.photoHint")}
                    onClick={() => setModalIdx(i)}
                  >
                    <img
                      src={p.thumb || p.full}
                      alt={p.title || g.name}
                      loading="lazy"
                      decoding="async"
                      className={loaded[p.nasa_id] ? "loaded" : ""}
                      onLoad={() => setLoaded((s) => ({ ...s, [p.nasa_id]: true }))}
                    />
                    <div className="info">
                      <b>{(p.title || "").slice(0, 70)}</b>
                      {p.credit ? <span>{p.credit}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      {photo && (
        <div
          className="photo-modal open"
          onClick={(e) => { if (e.target.classList.contains("photo-modal") || e.target.classList.contains("photo-modal-img")) setModalIdx(null); }}
        >
          <div className="photo-modal-frame">
            <div className="photo-modal-inner">
              <div
                className={"photo-modal-img" + (zoom ? " zoomed" : "")}
                style={{
                  backgroundImage: `url("${photo.full || photo.thumb}")`,
                  backgroundSize: zoom ? "auto 100%" : "contain",
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: zoom ? `${pan.x}px ${pan.y}px` : "center",
                  backgroundColor: "#06070d",
                  cursor: zoom ? "grab" : "zoom-in",
                }}
                onClick={() => setZoom((z) => !z)}
                onMouseDown={(e) => {
                  if (!zoom) return;
                  dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
                }}
                onMouseMove={(e) => {
                  if (!dragRef.current.active) return;
                  setPan({
                    x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
                    y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
                  });
                }}
                onMouseUp={() => { dragRef.current.active = false; }}
                onMouseLeave={() => { dragRef.current.active = false; }}
              >
                <button className="photo-modal-close" type="button" onClick={(e) => { e.stopPropagation(); setModalIdx(null); }}>✕</button>
                {photos.length > 1 && (
                  <>
                    <button
                      className="photo-modal-nav prev"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setModalIdx((i) => (i - 1 + photos.length) % photos.length); }}
                    >‹</button>
                    <button
                      className="photo-modal-nav next"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setModalIdx((i) => (i + 1) % photos.length); }}
                    >›</button>
                  </>
                )}
                <div className="photo-modal-zoom-hint" onClick={(e) => e.stopPropagation()}>
                  {zoom ? t("galaxy.zoomOut") : t("galaxy.zoomIn")}
                </div>
              </div>
              <div className="photo-modal-info">
                <div className="cat">{t("galaxy.galleryTitle")}</div>
                <h3>{photo.title || g?.name}</h3>
                <div className="d">
                  {modalIdx != null && (modalIdx + 1) + " " + t("galaxy.ofN") + " " + photos.length}
                  {photo.date_created ? " · " + photo.date_created.slice(0, 10) : ""}
                </div>
                {photo.description && <p>{photo.description}</p>}
                {photo.credit && (
                  <p style={{ marginTop: 12, fontSize: 12.5 }}>
                    <span style={{ color: "var(--text-dim)" }}>{t("galaxy.credit")}: </span>
                    {photo.credit}
                  </p>
                )}
                {(photo.source_url || photo.nasa_id) && (
                  <a
                    className="section-link"
                    style={{ display: "inline-block", marginTop: 20 }}
                    href={photo.source_url || `https://images.nasa.gov/details/${photo.nasa_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("galaxy.openFull")} ↗
                  </a>
                )}
              </div>
            </div>
            {photos.length > 1 && (
              <div className="photo-modal-thumbs">
                {photos.map((p, i) => (
                  <button
                    key={p.nasa_id || i}
                    type="button"
                    className={"pm-thumb" + (i === modalIdx ? " on" : "")}
                    style={{ backgroundImage: `url("${p.thumb || p.full}")` }}
                    onClick={() => setModalIdx(i)}
                    aria-label={`${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}