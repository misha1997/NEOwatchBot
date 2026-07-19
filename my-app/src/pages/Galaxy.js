// Single galaxy detail page (/galaxies/:slug). Mirrors the news article page:
// the server injects per-galaxy SEO meta (title/desc/canonical) for crawlers;
// this component fetches /api/galaxies/:slug and renders a hero, a key-data
// table, the curated description, and the full NASA Image Library photo gallery
// with a lightbox (prev/next/Esc, link to the NASA details page).
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getGalaxy } from "../lib/api";
import { pathFor, SITE_URL } from "../lib/seo";
import LocalizedLink from "../components/primitives/LocalizedLink";
import "../styles/gallery.css"; // .photo-modal lightbox
import "../styles/news.css"; // .article-back / .article-head / .article-hero / .article-body
import "../styles/constellations.css"; // .const-info-card / .const-info-row (data table)

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

export default function Galaxy({ slug }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data, loading, error } = useApi(() => getGalaxy(slug, lang), {
    deps: [slug, lang],
  });
  const [modalIdx, setModalIdx] = useState(null);

  const g = data && data.available ? data : null;
  const photos = (g && g.photos) || [];

  // Keep the tab title + canonical in sync on SPA navigation (the server sets
  // them for the initial load; this handles client-side route changes).
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

  const photo = modalIdx != null ? photos[modalIdx] : null;

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
          <>
            <div className="article-head">
              <span className="filter-pill on">{t(`galaxies.filters.${g.category}`)}</span>
              <h1 className="page-title" style={{ marginTop: 14 }}>{g.name}</h1>
              <div className="article-meta-row">
                {g.designation ? <span>{g.designation}</span> : null}
                {g.dist_text ? <><span>·</span><span>{g.dist_text}</span></> : null}
                {g.ned_prefname ? <><span>·</span><span>NED: {g.ned_prefname}</span></> : null}
              </div>
            </div>

            {photos[0] && photos[0].full ? (
              <img
                className="article-hero"
                src={photos[0].full}
                alt={g.name}
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            ) : (
              <div className="article-hero" style={{
                background: "radial-gradient(ellipse at 50% 40%, #2a2340, #0d0f1c 70%)",
              }} />
            )}
          </>
        )}
      </section>

      {g ? (
        <>
          <section className="section" style={{ paddingTop: 0 }}>
            <div className="const-info-card">
              <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>
                {t("galaxy.dataTitle")}
              </h3>
              <div className="const-info-row">
                <span>{t("galaxy.distance")}</span>
                <span>{g.dist_text || "—"}</span>
              </div>
              {g.redshift != null && (
                <div className="const-info-row">
                  <span>{t("galaxy.redshift")}</span>
                  <span>{Number(g.redshift).toFixed(5)}</span>
                </div>
              )}
              {g.ned_type && (
                <div className="const-info-row">
                  <span>{t("galaxy.type")}</span>
                  <span>{g.ned_type}</span>
                </div>
              )}
              <div className="const-info-row">
                <span>{t("galaxy.diameter")}</span>
                <span>{g.diameter_ly || "—"}</span>
              </div>
              <div className="const-info-row">
                <span>{t("galaxy.magnitude")}</span>
                <span>{g.magnitude || "—"}</span>
              </div>
              {g.ra != null && g.dec != null && (
                <div className="const-info-row">
                  <span>{t("galaxy.coords")}</span>
                  <span>{fmtRa(g.ra)} · {fmtDec(g.dec)}</span>
                </div>
              )}
              {g.ned_prefname && (
                <div className="const-info-row">
                  <span>{t("galaxy.nedName")}</span>
                  <span>{g.ned_prefname}</span>
                </div>
              )}
              {g.designation && (
                <div className="const-info-row">
                  <span>{t("galaxy.designation")}</span>
                  <span>{g.designation}</span>
                </div>
              )}
            </div>

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

          <section className="section" id="gallery" style={{ paddingTop: 8 }}>
            <div className="section-head">
              <div>
                <div className="eyebrow gold">{t("galaxy.galleryTitle")}</div>
                <h2 className="section-title">{g.name}</h2>
                <p className="section-sub" style={{ marginTop: 10 }}>{t("galaxy.gallerySub")}</p>
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
                    style={{
                      aspectRatio: "4/5",
                      cursor: "pointer",
                      backgroundImage: `url("${p.thumb || p.full}")`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                    title={t("galaxy.photoHint")}
                    onClick={() => setModalIdx(i)}
                  >
                    <div className="info">
                      <b>{(p.title || "").slice(0, 60)}</b>
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
        <div className="photo-modal open" onClick={(e) => { if (e.target.classList.contains("photo-modal")) setModalIdx(null); }}>
          <div className="photo-modal-inner">
            <div
              className="photo-modal-img"
              style={{
                backgroundImage: `url("${photo.full || photo.thumb}")`,
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundColor: "#06070d",
              }}
            >
              <button className="photo-modal-close" type="button" onClick={() => setModalIdx(null)}>✕</button>
              {photos.length > 1 && (
                <>
                  <button
                    className="photo-modal-nav prev"
                    type="button"
                    onClick={() => setModalIdx((i) => (i - 1 + photos.length) % photos.length)}
                  >‹</button>
                  <button
                    className="photo-modal-nav next"
                    type="button"
                    onClick={() => setModalIdx((i) => (i + 1) % photos.length)}
                  >›</button>
                </>
              )}
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
              {photo.nasa_id && (
                <a
                  className="section-link"
                  style={{ display: "inline-block", marginTop: 20 }}
                  href={`https://images.nasa.gov/details/${photo.nasa_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("galaxy.openFull")} ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}