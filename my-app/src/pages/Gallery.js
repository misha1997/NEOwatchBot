// Photo/video archive — NASA APOD, paginated by the backend. The current page
// lives in the URL (?page=N) so it's shareable/bookmarkable and survives a
// reload. Each page = PAGE_SIZE days of APODs, newest first; paging forward
// into territory not yet mirrored is fetched live from NASA and ingested to
// the DB in the same request (backend-driven lazy backfill).
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { getApodArchivePage } from "../lib/api";
import {
  videoEmbed,
  posterCandidates,
  withAutoplay,
  PosterImg,
} from "../lib/apodVideo";
import "../styles/gallery.css";

const PAGE_SIZE = 12;

export default function Gallery() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();

  // Page number is the source of truth in the URL (0-indexed, 0 = newest).
  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);

  const [data, setData] = useState(null); // {items, page, page_size, total_pages, has_more}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalIndex, setModalIndex] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Fetch the current page from the backend. The backend clamps an out-of-range
  // page to the last one and returns the effective page in `data.page`; sync
  // the URL to it so the active page button and the address bar agree.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getApodArchivePage(page, PAGE_SIZE, lang)
      .then((res) => {
        if (!alive) return;
        setData(res);
        if (res && typeof res.page === "number" && res.page !== page) {
          setSearchParams(res.page === 0 ? {} : { page: String(res.page) }, { replace: true });
        }
      })
      .catch(() => {
        if (alive) setError(t("gallery.error", "Не вдалося завантажити архів."));
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, lang]);

  // Close the lightbox whenever the page changes.
  useEffect(() => { setModalIndex(null); }, [page]);

  const entries = (data && Array.isArray(data.items)) ? data.items : [];
  const totalPages = (data && data.total_pages) || 1;
  const activePage = (data && typeof data.page === "number") ? data.page : page;
  const hasMore = (data && data.has_more) || false;

  const goPage = useCallback((p) => {
    const n = Math.max(0, Math.min(totalPages - 1, p));
    setSearchParams(n === 0 ? {} : { page: String(n) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setSearchParams, totalPages]);

  // Lightbox keyboard nav (within the current page).
  useEffect(() => {
    if (modalIndex === null) return;
    setPlaying(false);
    const onKey = (e) => {
      if (e.key === "Escape") setModalIndex(null);
      else if (e.key === "ArrowLeft")
        setModalIndex((i) => (i - 1 + entries.length) % entries.length);
      else if (e.key === "ArrowRight")
        setModalIndex((i) => (i + 1) % entries.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIndex, entries.length]);

  const modal = modalIndex !== null ? entries[modalIndex] : null;

  const fmtDate = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso + "T00:00:00Z").toLocaleDateString(
        lang === "en" ? "en-GB" : "uk-UA",
        { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
      );
    } catch {
      return iso;
    }
  };

  // Compact pagination: first, last, current ±1, with ellipses.
  const pageBtns = [];
  const add = (n) => pageBtns.push(n);
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) add(i);
  } else {
    add(0);
    if (activePage > 2) pageBtns.push("…");
    for (let i = Math.max(1, activePage - 1); i <= Math.min(totalPages - 2, activePage + 1); i++) add(i);
    if (activePage < totalPages - 3) pageBtns.push("…");
    add(totalPages - 1);
  }

  return (
    <>
    <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
      <section className="page-head">
        <span className="icon-badge">NASA APOD · архів</span>
        <h1 className="page-title">
          {t("gallery.title", "Фотоархів")}{" "}
          <span className="accent" style={{ color: "var(--gold)" }}>
            {t("gallery.titleAccent", "космосу")}
          </span>
        </h1>
        <p className="page-desc">
          {t("gallery.desc",
            "Астрономічне фото дня NASA — по одному на кожну добу. Знімки телескопів Hubble і James Webb, зондів і марсоходів, від далеких галактик до нашого власного неба. Клікни на знімок, щоб роздивитись деталі.")}
        </p>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        {loading ? (
          <>
            <div className="photo-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div className="photo-card" key={i} aria-hidden="true">
                  <div className="ph"><div className="skeleton" /></div>
                  <div className="cap">
                    <h4 style={{ color: "var(--text-dim)" }}>—</h4>
                    <div className="d">—</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="gallery-status">
              {t("gallery.loading", "Завантаження архіву NASA…")}
            </div>
          </>
        ) : error ? (
          <div className="gallery-status err">{error}</div>
        ) : entries.length === 0 ? (
          <div className="gallery-status">
            {t("gallery.empty", "Архів тимчасово недоступний. Спробуй пізніше.")}
          </div>
        ) : (
          <>
            <div className="photo-grid">
              {entries.map((e, i) => {
                const isVideo = e.media_type === "video";
                return (
                  <div
                    className="photo-card"
                    key={e.date || i}
                    onClick={() => setModalIndex(i)}
                  >
                    <div className="ph">
                      {isVideo ? (() => {
                        // Direct media file → render its first frame as the
                        // preview (NASA ships most video APODs as raw .mp4 with
                        // no still). YouTube/etc. → PosterImg walks still candidates.
                        const ve = videoEmbed(e.video_url);
                        if (ve && ve.kind === "file") {
                          return (
                            <video
                              className="gallery-thumb-frame"
                              src={`${ve.src}#t=0.5`}
                              preload="metadata"
                              muted
                              playsInline
                              tabIndex={-1}
                            />
                          );
                        }
                        return (
                          <PosterImg
                            candidates={posterCandidates(e.video_url, e.image)}
                            alt={e.title}
                            className="gallery-thumb"
                          />
                        );
                      })() : (e.thumb || e.image) ? (
                        <img
                          className="gallery-img"
                          src={e.thumb || e.image}
                          alt={e.title}
                          loading="lazy"
                          decoding="async"
                          onLoad={(ev) => ev.currentTarget.classList.add("loaded")}
                        />
                      ) : null}
                      <span className="cat">{fmtDate(e.date).split(" ").slice(0, 2).join(" ")}</span>
                      {isVideo && <span className="vid">▶ {t("gallery.video", "Відео")}</span>}
                    </div>
                    <div className="cap">
                      <h4>{e.title || "—"}</h4>
                      <div className="d">{e.credit ? `© ${e.credit}` : "NASA APOD"}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination — backend-driven, page number in the URL. The next
                arrow stays enabled all the way to the last page (total_pages is
                the true archive extent, not what's mirrored); the backend
                live-fetches + ingests any page not yet in the DB. */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pg-btn arrow"
                  onClick={() => goPage(activePage - 1)}
                  disabled={activePage === 0}
                  aria-label={t("gallery.prev", "Попередня")}
                >‹</button>
                {pageBtns.map((n, i) =>
                  n === "…" ? (
                    <span className="pg-dots" key={"d" + i}>…</span>
                  ) : (
                    <button
                      key={n}
                      className={"pg-btn" + (n === activePage ? " active" : "")}
                      onClick={() => goPage(n)}
                    >{n + 1}</button>
                  )
                )}
                <button
                  className="pg-btn arrow"
                  onClick={() => goPage(activePage + 1)}
                  disabled={!hasMore}
                  aria-label={t("gallery.next", "Наступна")}
                >›</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>

      {/* Lightbox — rendered outside .wrap so its z-index isn't trapped
          in the .wrap stacking context (which sits below the sticky header). */}
      {modal && (() => {
        const isVideo = modal.media_type === "video";
        const embed = isVideo ? videoEmbed(modal.video_url) : null;
        const poster = isVideo ? posterCandidates(modal.video_url, modal.image) : [];
        const embeddable = embed && (embed.kind === "file" || embed.kind === "iframe");
        return (
          <div className="photo-modal open" onClick={() => setModalIndex(null)}>
            <div className="photo-modal-inner" onClick={(ev) => ev.stopPropagation()}>
              <div
                className="photo-modal-img"
                style={
                  isVideo
                    ? { backgroundImage: "none" }
                    : {
                        backgroundImage: modal.image
                          ? `url("${modal.image}")`
                          : "linear-gradient(150deg,#1a2b4d,#06070d)",
                      }
                }
              >
                {/* Video: lazy-load the player only after the user clicks the
                    poster, so opening the lightbox never pulls a 3rd-party
                    iframe (or a multi-MB media file) until asked. */}
                {isVideo && playing && embeddable && (
                  embed.kind === "file" ? (
                    <video
                      className="gallery-player"
                      src={`${embed.src}#t=0.5`}
                      controls autoPlay muted playsInline
                      title={modal.title}
                    >
                      {t("home.apod.noVideoSupport", "Ваш браузер не підтримує відео.")}
                      <a href={embed.src} target="_blank" rel="noopener noreferrer">
                        {t("gallery.openVideo", "Відкрити відео")} ↗
                      </a>
                    </video>
                  ) : (
                    <iframe
                      className="gallery-player"
                      src={withAutoplay(embed.src)}
                      title={modal.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  )
                )}
                {isVideo && !playing && embeddable && (
                  <button
                    type="button"
                    className="gallery-media-btn"
                    onClick={() => setPlaying(true)}
                    aria-label={t("home.apod.play", "Відтворити")}
                  >
                    {embed.kind === "file" ? (
                      <video
                        className="apod-thumb-frame"
                        src={`${embed.src}#t=0.5`}
                        preload="metadata"
                        muted playsInline
                        tabIndex={-1}
                      />
                    ) : (
                      <PosterImg candidates={poster} alt={modal.title} className="apod-thumb-img" />
                    )}
                    <span className="apod-play" aria-hidden="true">▶</span>
                  </button>
                )}
                {isVideo && !embeddable && modal.video_url && (
                  // Unrecognized video host — can't embed, open externally.
                  <a
                    className="gallery-media-link"
                    href={modal.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <PosterImg candidates={poster.length ? poster : [modal.image].filter(Boolean)} alt={modal.title} className="apod-thumb-img" />
                    <span className="apod-play" aria-hidden="true">▶</span>
                  </a>
                )}

                <button
                  className="photo-modal-close"
                  onClick={() => setModalIndex(null)}
                  aria-label={t("gallery.close", "Закрити")}
                >✕</button>
                <button
                  className="photo-modal-nav prev"
                  onClick={() => setModalIndex((i) => (i - 1 + entries.length) % entries.length)}
                  aria-label={t("gallery.prev", "Попередня")}
                >‹</button>
                <button
                  className="photo-modal-nav next"
                  onClick={() => setModalIndex((i) => (i + 1) % entries.length)}
                  aria-label={t("gallery.next", "Наступна")}
                >›</button>
              </div>
              <div className="photo-modal-info">
                <div className="cat">
                  {isVideo ? t("gallery.video", "Відео") : t("gallery.photo", "Фото")}
                  {" · "}{fmtDate(modal.date)}
                </div>
                <h3>{modal.title}</h3>
                <div className="d">NASA APOD · {modal.date}</div>
                <p>{modal.explanation}</p>
                {modal.credit && <div className="credit">© {modal.credit}</div>}
                {isVideo && modal.video_url && (
                  <div className="vid-link">
                    <a href={modal.video_url} target="_blank" rel="noopener noreferrer">
                      ▶ {t("gallery.openVideo", "Відкрити відео")} ↗
                    </a>
                  </div>
                )}
                <a
                  className="section-link"
                  style={{ marginTop: "auto", paddingTop: 18 }}
                  href={`https://apod.nasa.gov/apod/ap${(modal.date || "").replace(/-/g, "").slice(2)}.html`}
                  target="_blank" rel="noopener noreferrer"
                >
                  {t("gallery.source", "Джерело: APOD NASA")} ↗
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}