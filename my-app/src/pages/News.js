// Space news page (news.html template): featured article + stat cards +
// keyword search + category filter + cards/rows view toggle + paginated feed.
// Wired to /api/news — a SpaceflightNow archive stored in MySQL with a live
// parser fallback. Items with an `id` link to the on-site article page
// (/news/:id); live-without-DB items (id === null) link out to the source.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { useSeo } from "../hooks/useSeo";
import { getNews } from "../lib/api";
import "../styles/news.css";
import "../styles/gallery.css"; // .pagination / .pg-btn

const PAGE_SIZE = 6;
const CATS = ["all", "launches", "missions", "discoveries", "tech"];
const KEYWORDS = ["Starship", "JWST", "Voyager", "Mars", "Neutron", "Proxima"];

export default function News() {
  const { t } = useTranslation();
  const { lang } = useLang();
  useSeo();
  useEffect(() => {
    document.body.classList.add("p-news");
    return () => document.body.classList.remove("p-news");
  }, []);

  const { data, loading, error } = useApi(() => getNews(lang), { deps: [lang] });
  const items = (data && data.items) || [];

  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [view, setView] = useState("cards");

  // Reset to the first page whenever the active filter / search changes.
  useEffect(() => {
    setPage(0);
  }, [filter, query]);

  const featured = items[0];

  // Most frequent category among the loaded items (the "top category" stat).
  const topCat = useMemo(() => {
    const counts = {};
    for (const it of items) {
      const c = it.category || "missions";
      counts[c] = (counts[c] || 0) + 1;
    }
    let best = "missions", n = 0;
    for (const [c, k] of Object.entries(counts)) {
      if (k > n) { best = c; n = k; }
    }
    return { cat: best, n };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const matchesCat = filter === "all" || it.category === filter;
      if (!matchesCat) return false;
      if (!q) return true;
      return (
        (it.title || "").toLowerCase().includes(q) ||
        (it.excerpt || "").toLowerCase().includes(q)
      );
    });
  }, [items, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const goPage = (p) => {
    setPage(Math.max(0, Math.min(totalPages - 1, p)));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
              <Link className="read-more" to={`/news/${featured.slug}`}>
                {t("news.readFull")}
              </Link>
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
        {/* Stat cards — reuse the shared .grid.cols-3 + .card (k/v/foot). */}
        <div className="grid cols-3">
          <div className="card">
            <div className="k">{t("news.stats.count")}</div>
            <div className="v">{loading ? "—" : items.length}</div>
            <div className="foot">{t("news.stats.countFoot")}</div>
          </div>
          <div className="card">
            <div className="k">{t("news.stats.topCat")}</div>
            <div className="v" style={{ fontSize: 20 }}>
              {loading ? "—" : catLabel(topCat.cat)}
            </div>
            <div className="foot">
              {t("news.stats.topCatFoot", { n: topCat.n })}
            </div>
          </div>
          <div className="card">
            <div className="k">{t("news.stats.lastUpdate")}</div>
            <div className="v" style={{ fontSize: 20 }}>
              {loading || !items.length ? "—" : items[0].date}
            </div>
            <div className="foot">{t("news.stats.lastUpdateFoot")}</div>
          </div>
        </div>
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="kw-row">
          <span className="lbl">{t("news.kw.label")}</span>
          {KEYWORDS.map((kw) => (
            <button
              key={kw}
              className="kw-chip"
              type="button"
              onClick={() => {
                setQuery(kw);
                setFilter("all");
              }}
            >
              {t(`news.kw.${kw}`, { defaultValue: kw })}
            </button>
          ))}
        </div>

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
                n: `<b>${filtered.length}</b>`,
                q: query.trim(),
                defaultValue: `Знайдено <b>${filtered.length}</b> новин`,
              }),
            }}
          />
          <div className="view-toggle">
            <button
              className={"vt-btn" + (view === "cards" ? " active" : "")}
              type="button"
              onClick={() => setView("cards")}
            >
              ▦ {t("news.view.cards")}
            </button>
            <button
              className={"vt-btn" + (view === "rows" ? " active" : "")}
              type="button"
              onClick={() => setView("rows")}
            >
              ☰ {t("news.view.rows")}
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
                    <Link className="news-card" to={`/news/${it.slug}`} key={it.slug}>
                      {preview}
                      {body}
                    </Link>
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
                <button
                  className="pg-btn arrow"
                  onClick={() => goPage(safePage - 1)}
                  disabled={safePage === 0}
                  aria-label={t("gallery.prev", "Попередня")}
                >‹</button>
                {pageBtns.map((n, i) =>
                  n === "…" ? (
                    <span className="pg-dots" key={"d" + i}>…</span>
                  ) : (
                    <button
                      key={n}
                      className={"pg-btn" + (n === safePage ? " active" : "")}
                      onClick={() => goPage(n)}
                    >{n + 1}</button>
                  )
                )}
                <button
                  className="pg-btn arrow"
                  onClick={() => goPage(safePage + 1)}
                  disabled={safePage === totalPages - 1}
                  aria-label={t("gallery.next", "Наступна")}
                >›</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}