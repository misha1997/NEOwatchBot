// Space news page (news.html template): featured article + stat cards +
// keyword search + category filter + cards/rows view toggle + paginated feed.
// Wired to /api/news — a SpaceflightNow archive stored in MySQL with a live
// parser fallback. Pagination, category filtering and search all run on the
// backend (DB LIKE query + LIMIT/OFFSET) — the client only holds the current
// page's items. Items with an `id` link to the on-site article page
// (/news/:slug); live-without-DB items (id === null) link out to the source.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { useSeo } from "../hooks/useSeo";
import { getNews, getNewsKeywords } from "../lib/api";
import { pathFor } from "../lib/seo";
import LocalizedLink from "../components/primitives/LocalizedLink";
import "../styles/news.css";
import "../styles/gallery.css"; // .pagination / .pg-btn

const PAGE_SIZE = 12;
const CATS = ["all", "launches", "missions", "discoveries", "tech"];
const SEARCH_DEBOUNCE_MS = 350;

export default function News() {
  const { t } = useTranslation();
  const { lang } = useLang();
  useSeo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    document.body.classList.add("p-news");
    return () => document.body.classList.remove("p-news");
  }, []);

  const [filter, setFilter] = useState("all");
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState(""); // debounced, drives the API call
  const [view, setView] = useState("cards");

  // Page number lives in the URL (?page=N, 0-indexed, omitted at 0) so it's
  // shareable/bookmarkable and survives a reload — same convention as the
  // APOD gallery (Gallery.js).
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(0, parseInt(searchParams.get("page") || "0", 10) || 0);
  const setPage = (p, opts) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p === 0) next.delete("page"); else next.set("page", String(p));
      return next;
    }, opts);
  };

  // Debounce the free-text search box so we don't hit the backend on every
  // keystroke; keyword chips / category pills set `query` immediately below.
  useEffect(() => {
    const id = setTimeout(() => setQuery(rawQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [rawQuery]);

  // Reset to the first page whenever the active filter / search changes.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPage(0, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query]);

  const isDefaultView = filter === "all" && !query;

  const { data, loading, error } = useApi(
    () => getNews(lang, { page, pageSize: PAGE_SIZE, q: query, category: filter }),
    { deps: [lang, page, query, filter] }
  );
  const items = (data && data.items) || [];

  // Trending keywords mined server-side from recent article titles (not a
  // hardcoded list) — refetch only when the language changes.
  const { data: kwData } = useApi(() => getNewsKeywords(lang), { deps: [lang] });
  const keywords = (kwData && kwData.keywords) || [];
  const total = (data && data.total) || 0;
  const totalPages = (data && data.total_pages) || 1;
  const safePage = (data && data.page) || 0;
  const pageItems = items;
  // The featured hero only makes sense on the plain, unfiltered first page.
  const featured = isDefaultView && safePage === 0 ? items[0] : null;

  const pageHref = (n) => pathFor("news", lang) + (n === 0 ? "" : `?page=${n}`);
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const setKeyword = (kw) => {
    setFilter("all");
    setRawQuery(kw);
    setQuery(kw); // skip the debounce for an explicit chip click
  };

  // Compact pagination: first, last, current ±1, with ellipses.
  const pageBtns = [];
  if (totalPages <= 7) {
    for (let i = 0; i < totalPages; i++) pageBtns.push(i);
  } else {
    pageBtns.push(0);
    if (safePage > 2) pageBtns.push("…");
    for (let i = Math.max(1, safePage - 1); i <= Math.min(totalPages - 2, safePage + 1); i++) pageBtns.push(i);
    if (safePage < totalPages - 3) pageBtns.push("…");
    pageBtns.push(totalPages - 1);
  }

  const catLabel = (c) => t(`news.cat.${c}`, { defaultValue: c });

  return (
    <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
      <section className="page-head">
        <span className="icon-badge">{t("news.badge")}</span>
        <h1 className="page-title">{t("news.title")}</h1>
        <p className="page-desc">{t("news.desc")}</p>

        {loading ? null : error ? null : featured ? (
          <div className="news-featured">
            <div className="cat-tag" style={{ color: "var(--teal)" }}>
              {catLabel(featured.category)}
            </div>
            <h2>{featured.title}</h2>
            <div className="meta">
              {featured.source} · {featured.date}
            </div>
            <p>{featured.excerpt}</p>
            {featured.id && featured.slug ? (
              <LocalizedLink className="read-more" to={`${pathFor("news", lang)}/${featured.slug}`}>
                {t("news.readFull")}
              </LocalizedLink>
            ) : (
              <a
                className="read-more"
                href={featured.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("news.readFull")}
              </a>
            )}
          </div>
        ) : null}
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="section-head">
          <div>
            <div className="eyebrow">{t("news.feed.eyebrow")}</div>
            <h2 className="section-title">{t("news.feed.title")}</h2>
          </div>
        </div>

        <div className="news-search">
          <input
            type="text"
            placeholder={t("news.search.placeholder")}
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
          />
        </div>
        {keywords.length ? (
          <div className="kw-row">
            <span className="lbl">{t("news.kw.label")}</span>
            {keywords.map((kw) => (
              <button
                key={kw}
                className={"kw-chip" + (query.toLowerCase() === kw.toLowerCase() ? " on" : "")}
                type="button"
                onClick={() => setKeyword(kw)}
              >
                {kw}
              </button>
            ))}
          </div>
        ) : null}

        <div className="news-cat-filters">
          {CATS.map((c) => (
            <button
              key={c}
              className={"filter-pill" + (filter === c ? " on" : "")}
              type="button"
              onClick={() => setFilter(c)}
            >
              {catLabel(c)}
            </button>
          ))}
        </div>

        <div className="news-count">
          <span
            dangerouslySetInnerHTML={{
              __html: t("news.count", {
                n: `<b>${total}</b>`,
                q: query.trim(),
                defaultValue: `Знайдено <b>${total}</b> новин`,
              }),
            }}
          />
          <div className="view-toggle">
            <button
              className={"vt-btn" + (view === "cards" ? " active" : "")}
              type="button"
              title={t("news.view.cards")}
              aria-label={t("news.view.cards")}
              onClick={() => setView("cards")}
            >
              ▦
            </button>
            <button
              className={"vt-btn" + (view === "rows" ? " active" : "")}
              type="button"
              title={t("news.view.rows")}
              aria-label={t("news.view.rows")}
              onClick={() => setView("rows")}
            >
              ☰
            </button>
          </div>
        </div>

        {loading ? (
          <div className="news-list view-rows">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="news-card" key={i} aria-hidden="true">
                <div className="top-row">
                  <span className="cat-pill missions">—</span>
                </div>
                <h4 style={{ color: "var(--text-dim)" }}>—</h4>
                <p style={{ color: "var(--text-dim)" }}>—</p>
              </div>
            ))}
            <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              {t("news.loading")}
            </p>
          </div>
        ) : error ? (
          <p style={{ color: "var(--coral)", marginTop: 18 }}>{t("news.empty")}</p>
        ) : pageItems.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 18 }}>
            {t("news.noMatch")}
          </p>
        ) : (
          <>
            <div className={"news-list view-" + view}>
              {pageItems.map((it, i) => {
                // Whole card is a link — to the on-site article page when we
                // have a slug, else out to the source (live-without-DB items).
                const hasSlug = !!(it.id && it.slug);
                const preview = it.image ? (
                  <div
                    className="news-card-preview"
                    style={{ backgroundImage: `url("${it.image}")` }}
                  />
                ) : (
                  <div className={"news-card-preview news-card-preview-ph cat-" + (it.category || "missions")} />
                );
                const body = (
                  <div className="news-card-body">
                    <div className="top-row">
                      <span className={"cat-pill " + (it.category || "missions")}>
                        {catLabel(it.category)}
                      </span>
                    </div>
                    <h4>{it.title || "—"}</h4>
                    <p>{it.excerpt}</p>
                    <div className="bottom-row">
                      <span>{it.source} · {it.date}</span>
                    </div>
                  </div>
                );
                if (hasSlug) {
                  return (
                    <LocalizedLink className="news-card" to={`${pathFor("news", lang)}/${it.slug}`} key={it.slug}>
                      {preview}
                      {body}
                    </LocalizedLink>
                  );
                }
                return (
                  <a
                    className="news-card"
                    href={it.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    key={"live" + i}
                  >
                    {preview}
                    {body}
                  </a>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                {safePage === 0 ? (
                  <span className="pg-btn arrow disabled" aria-hidden="true">‹</span>
                ) : (
                  <LocalizedLink
                    className="pg-btn arrow"
                    to={pageHref(safePage - 1)}
                    onClick={scrollTop}
                    aria-label={t("gallery.prev", "Попередня")}
                  >‹</LocalizedLink>
                )}
                {pageBtns.map((n, i) =>
                  n === "…" ? (
                    <span className="pg-dots" key={"d" + i}>…</span>
                  ) : n === safePage ? (
                    <span className="pg-btn active" key={n} aria-current="page">{n + 1}</span>
                  ) : (
                    <LocalizedLink
                      key={n}
                      className="pg-btn"
                      to={pageHref(n)}
                      onClick={scrollTop}
                    >{n + 1}</LocalizedLink>
                  )
                )}
                {safePage === totalPages - 1 ? (
                  <span className="pg-btn arrow disabled" aria-hidden="true">›</span>
                ) : (
                  <LocalizedLink
                    className="pg-btn arrow"
                    to={pageHref(safePage + 1)}
                    onClick={scrollTop}
                    aria-label={t("gallery.next", "Наступна")}
                  >›</LocalizedLink>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}