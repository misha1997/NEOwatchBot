// Photo/video archive — NASA APOD over a date range. Ported from the static
// templates/gallery.html mockup, but wired to the live /api/apod/archive
// endpoint instead of the mockup's hardcoded gradient tiles.
import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { getApodArchive } from "../lib/api";
import {
  videoEmbed,
  posterCandidates,
  withAutoplay,
  PosterImg,
} from "../lib/apodVideo";
import "../styles/gallery.css";

const PAGE_SIZE = 12;
const WINDOW_DAYS = 30;
// NASA APOD began 1995-06-16 — don't try to fetch beyond it.
const APOD_OLDEST = "1995-06-16";

// UTC date helpers (APOD dates are calendar days, not instants).
const toISO = (d) => d.toISOString().slice(0, 10);
const shift = (iso, days) => {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
};

export default function Gallery() {
  const { t } = useTranslation();
  const { lang } = useLang();

  const [entries, setEntries] = useState([]); // most-recent first
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [exhausted, setExhausted] = useState(false);
  const [modalIndex, setModalIndex] = useState(null);
  const [playing, setPlaying] = useState(false);

  // Initial load: the last WINDOW_DAYS days.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    // Omit start/end → backend defaults to the last 30 days ending yesterday
    // (today's APOD isn't published yet in US time and would 400 at NASA).
    getApodArchive(null, null, lang)
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setEntries(list);
        // NASA's earliest APOD is 1995-06-16; stop "load older" past it.
        const oldestLoaded = list.length ? list[list.length - 1].date : null;
        setExhausted(!oldestLoaded || oldestLoaded <= APOD_OLDEST);
      })
      .catch((e) => {
        if (alive) setError(t("gallery.error", "Не вдалося завантажити архів."));
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Fetch another WINDOW_DAYS window before the oldest entry already loaded.
  const loadOlder = useCallback(async () => {
    if (loadingMore || exhausted || entries.length === 0) return;
    setLoadingMore(true);
    const oldest = entries[entries.length - 1].date;
    const end = shift(oldest, -1); // exclusive of what we already have
    const start = shift(end, 1 - WINDOW_DAYS);
    try {
      const data = await getApodArchive(start, end, lang);
      const fresh = (Array.isArray(data) ? data : [])
        .filter((e) => e.date && e.date < oldest); // dedupe vs already-loaded
      setEntries((prev) => [...prev, ...fresh]);
      if (fresh.length === 0 || start <= APOD_OLDEST) setExhausted(true);
    } catch (e) {
      setExhausted(true);
    } finally {
      setLoadingMore(false);
    }
  }, [entries, loadingMore, exhausted, lang]);

  // Reset to page 0 if the list shrank below the current page (e.g. lang switch).
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    if (page > totalPages - 1) setPage(0);
  }, [entries, page]);

  // Lightbox keyboard nav.
  useEffect(() => {
    if (modalIndex === null) return;
    // Switching entries (nav buttons / arrows) tears down any playing video.
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

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const pageItems = entries.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
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

  const goPage = (p) => {
    setPage(Math.max(0, Math.min(totalPages - 1, p)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Compact pagination: first, last, current ±1, with ellipses.
  const pageBtns = [];
  const add = (n) => pageBtns.push(n);
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) add(i);
  } else {
    add(0);
    if (page > 2) pageBtns.push("…");
    for (let i = Math.max(1, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) add(i);
    if (page < totalPages - 3) pageBtns.push("…");
    add(totalPages - 1);
  }

  return (
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
              {pageItems.map((e, i) => {
                const idx = page * PAGE_SIZE + i;
                const isVideo = e.media_type === "video";
                return (
                  <div
                    className="photo-card"
                    key={e.date || idx}
                    onClick={() => setModalIndex(idx)}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pg-btn arrow"
                  onClick={() => goPage(page - 1)}
                  disabled={page === 0}
                  aria-label={t("gallery.prev", "Попередня")}
                >‹</button>
                {pageBtns.map((n, i) =>
                  n === "…" ? (
                    <span className="pg-dots" key={"d" + i}>…</span>
                  ) : (
                    <button
                      key={n}
                      className={"pg-btn" + (n === page ? " active" : "")}
                      onClick={() => goPage(n)}
                    >{n + 1}</button>
                  )
                )}
                <button
                  className="pg-btn arrow"
                  onClick={() => goPage(page + 1)}
                  disabled={page === totalPages - 1}
                  aria-label={t("gallery.next", "Наступна")}
                >›</button>
              </div>
            )}

            {/* Load older window */}
            {!exhausted && (
              <div className="gallery-loadmore">
                <button
                  className="btn ghost"
                  onClick={loadOlder}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? t("gallery.loadingMore", "Завантаження…")
                    : t("gallery.loadOlder", "Завантажити старіші ↓")}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Lightbox */}
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
    </div>
  );
}