// Single article page (/news/:slug) — ported from templates/article.html,
// upgraded into a two-column "professional" layout: breadcrumb nav, a
// reading-progress bar, article-head (cat-pill + title + meta row), hero
// image with a source credit line, body (lead paragraph styled larger via
// CSS p:first-of-type) + topic tags in the main column, and a sticky aside
// with a quick-facts card + share buttons. Related articles (same-category,
// from the DB) render as a full-width grid below. Body is fetched lazily
// from the source on first request, translated, and cached server-side.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getNewsArticle } from "../lib/api";
import { SITE_URL, pathFor } from "../lib/seo";
import LocalizedLink from "../components/primitives/LocalizedLink";
import { TelegramShareIcon, LinkIcon, CheckIcon, XShareIcon } from "../lib/icons";
import "../styles/news.css";

const STOP = new Set([
  "live", "coverage", "to", "for", "from", "on", "the", "a", "of", "and",
  "with", "in", "at", "as", "by", "is", "it", "its", "be", "an", "or", "up",
  "via", "sfb", "fb", "launches", "launch", "news",
]);

export default function NewsArticle({ slug }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data, loading, error } = useApi(() => getNewsArticle(slug, lang), {
    deps: [slug, lang],
  });
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);

  const article = data && data.available ? data : null;
  const shareUrl = article
    ? `${SITE_URL}${pathFor("news", lang)}/${article.slug || slug}`
    : "";

  // Per-article client-side title + canonical (no server meta for dynamic
  // /news/:slug). Keeps the tab + crawlable head in sync on SPA navigation.
  useEffect(() => {
    if (article && article.title) document.title = article.title;
    if (shareUrl) {
      let el = document.head.querySelector('link[rel="canonical"]');
      if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
      el.setAttribute("href", shareUrl);
    }
    document.body.classList.add("p-news");
    return () => document.body.classList.remove("p-news");
  }, [article, shareUrl]);

  // Thin fixed progress bar tracking how far the reader has scrolled.
  useEffect(() => {
    if (!article) return;
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [article]);

  // Reading-time estimate from the body (or excerpt fallback). ~200 wpm.
  // Strip [IMG:n] inline-image placeholders first so they don't count as words.
  const readMins = useMemo(() => {
    const txt = ((article && (article.body || article.excerpt)) || "").replace(/\[IMG:\d+\]/g, "");
    const words = txt.trim().split(/\s+/).filter(Boolean).length;
    if (!words) return 0;
    return Math.max(1, Math.round(words / 200));
  }, [article]);

  // Topic tags: derive a few from the source-URL slug (English, topical) and
  // prepend the category label. Keeps cards honest — no fake hardcoded tags.
  const tags = useMemo(() => {
    if (!article) return [];
    const out = [t(`news.cat.${article.category}`, { defaultValue: article.category })];
    const words = (article.slug || "")
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .filter((w) => w && w.length > 2 && !STOP.has(w.toLowerCase()));
    const seen = new Set(out.map((s) => s.toLowerCase()));
    for (const w of words) {
      const lw = w.toLowerCase();
      if (!seen.has(lw)) { out.push(w); seen.add(lw); }
      if (out.length >= 5) break;
    }
    return out.slice(0, 5);
  }, [article, t]);

  const catLabel = (c) => t(`news.cat.${c}`, { defaultValue: c || "missions" });

  const share = (kind) => {
    if (!article) return;
    const u = encodeURIComponent(shareUrl);
    const ti = encodeURIComponent(article.title || "");
    if (kind === "tg") {
      window.open(`https://t.me/share/url?url=${u}&text=${ti}`, "_blank", "noopener");
    } else if (kind === "x") {
      window.open(`https://twitter.com/intent/tweet?url=${u}&text=${ti}`, "_blank", "noopener");
    } else if (kind === "copy") {
      navigator.clipboard?.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }).catch(() => {});
    }
  };

  return (
    <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
      {article ? (
        <div className="reading-progress" aria-hidden="true">
          <div className="reading-progress-bar" style={{ width: progress + "%" }} />
        </div>
      ) : null}

      <section className="page-head">
        <nav className="article-breadcrumb" aria-label="breadcrumb">
          <LocalizedLink to="home">{t("nav.home")}</LocalizedLink>
          <span className="sep">/</span>
          <LocalizedLink to="news">{t("nav.news")}</LocalizedLink>
          {article ? (
            <>
              <span className="sep">/</span>
              <span className="crumb-current">{catLabel(article.category)}</span>
            </>
          ) : null}
        </nav>

        {loading ? (
          <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 14 }}>
            {t("news.article.loading")}
          </p>
        ) : error || !article ? (
          <div className="news-article-unavailable">
            <h3>{t("news.article.unavailable")}</h3>
            <p>{t("news.article.unavailableSub")}</p>
            <LocalizedLink to="news" className="section-link" style={{ display: "inline-block", marginTop: 16 }}>
              ← {t("news.article.back")}
            </LocalizedLink>
          </div>
        ) : (
          <>
            <div className="article-head">
              <span className={"cat-pill " + (article.category || "missions")}>
                {catLabel(article.category)}
              </span>
              <h1 className="page-title" style={{ marginTop: 14 }}>{article.title}</h1>
              <div className="article-meta-row">
                <span>{article.source}</span>
                {article.date ? <><span>·</span><span>{article.date}</span></> : null}
                {readMins ? <><span>·</span><span>{t("news.article.readTime", { n: readMins })}</span></> : null}
                <span>·</span>
                <span>{t("news.article.translation")}</span>
              </div>
            </div>

            {article.image ? (
              <>
                <img
                  className="article-hero"
                  src={article.image}
                  alt={article.title}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="article-hero-credit">{article.source}</div>
              </>
            ) : (
              <div className="article-hero article-hero-ph" />
            )}
          </>
        )}
      </section>

      {article ? (
        <section className="section article-layout" style={{ paddingTop: 0 }}>
          <div className="article-main">
            <div className="article-body">
              {(article.body || article.excerpt || "")
                .split("\n\n")
                .map((para, i) => {
                  const trimmed = para.trim();
                  if (!trimmed) return null;
                  const imgMatch = trimmed.match(/^\[IMG:(\d+)\]$/);
                  if (imgMatch) {
                    const img = (article.body_images || [])
                      .find((im) => String(im.position) === imgMatch[1]);
                    if (!img) return null;
                    return (
                      <img
                        key={i}
                        className="article-inline-img"
                        src={img.src}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    );
                  }
                  return <p key={i}>{trimmed}</p>;
                })}
              {!article.body && article.excerpt ? (
                <p className="note">{t("news.article.bodyNa")}</p>
              ) : null}
            </div>

            {tags.length ? (
              <div className="article-tags">
                {tags.map((tag, i) => (
                  <span className="filter-pill" key={i}>{tag}</span>
                ))}
              </div>
            ) : null}

            <a
              className="article-source-link"
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("news.article.readSource")}
            </a>
          </div>

          <aside className="article-aside">
            <div className="article-facts-card">
              <div className="facts-title">{t("news.article.facts")}</div>
              <div className="fact-row">
                <span>{t("news.article.factsSource")}</span>
                <b>{article.source}</b>
              </div>
              {article.date ? (
                <div className="fact-row">
                  <span>{t("news.article.factsDate")}</span>
                  <b>{article.date}</b>
                </div>
              ) : null}
              <div className="fact-row">
                <span>{t("news.article.factsCategory")}</span>
                <b>{catLabel(article.category)}</b>
              </div>
              {readMins ? (
                <div className="fact-row">
                  <span>{t("news.article.factsRead")}</span>
                  <b>{t("news.article.readTime", { n: readMins })}</b>
                </div>
              ) : null}
            </div>

            <div className="article-share-aside">
              <span className="share-label">{t("news.article.share")}</span>
              <div className="share-btn-col">
                <button className="share-btn" type="button" title="Telegram" onClick={() => share("tg")}>
                  <TelegramShareIcon />
                </button>
                <button className="share-btn" type="button" title={t("news.article.copy", "Скопіювати посилання")} onClick={() => share("copy")}>
                  {copied ? <CheckIcon /> : <LinkIcon />}
                </button>
                <button className="share-btn" type="button" title="X / Twitter" onClick={() => share("x")}>
                  <XShareIcon />
                </button>
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      {article && article.related && article.related.length ? (
        <section className="section" id="related" style={{ paddingTop: 8 }}>
          <div className="section-head">
            <div>
              <div className="eyebrow">{t("news.article.relatedEyebrow")}</div>
              <h2 className="section-title">{t("news.article.relatedTitle")}</h2>
            </div>
          </div>
          <div className="related-grid">
            {article.related.map((r) => (
              <LocalizedLink
                key={r.slug || r.id}
                to={r.slug ? `${pathFor("news", lang)}/${r.slug}` : "#"}
                className="news-card related-card"
              >
                {r.image ? (
                  <div className="related-thumb" style={{ backgroundImage: `url("${r.image}")` }} />
                ) : (
                  <div className={"related-thumb related-thumb-ph cat-" + (r.category || "missions")} />
                )}
                <div className="top-row">
                  <span className={"cat-pill " + (r.category || "missions")}>{catLabel(r.category)}</span>
                </div>
                <h4>{r.title}</h4>
                <div className="bottom-row">
                  <span>{r.source} · {r.date}</span>
                </div>
              </LocalizedLink>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}