// Single article page (/news/:slug) — ported from templates/article.html.
// article-back, article-head (cat-pill + title + meta row), hero image,
// body (lead paragraph styled larger via CSS p:first-of-type), topic tags
// derived from the slug, share buttons, and a real «Пов'язані новини» grid
// (same-category articles from the DB). Body is fetched lazily from
// SpaceflightNow on first request, translated, and cached server-side.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getNewsArticle } from "../lib/api";
import { SITE_URL } from "../lib/seo";
import "../styles/news.css";

const STOP = new Set([
  "live", "coverage", "to", "for", "from", "on", "the", "a", "of", "and",
  "with", "in", "at", "as", "by", "is", "it", "its", "be", "an", "or", "up",
  "via", "sfb", "fb", "launches", "launch", "news",
]);

export default function NewsArticle() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { slug } = useParams();
  const { data, loading, error } = useApi(() => getNewsArticle(slug, lang), {
    deps: [slug, lang],
  });
  const [copied, setCopied] = useState(false);

  const article = data && data.available ? data : null;
  const shareUrl = article ? `${SITE_URL}/news/${article.slug || slug}` : "";

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

  // Reading-time estimate from the body (or excerpt fallback). ~200 wpm.
  const readMins = useMemo(() => {
    const txt = (article && (article.body || article.excerpt)) || "";
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
      <section className="page-head">
        <Link to="/news" className="article-back">← {t("news.article.back")}</Link>

        {loading ? (
          <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 14 }}>
            {t("news.article.loading")}
          </p>
        ) : error || !article ? (
          <div className="news-article-unavailable">
            <h3>{t("news.article.unavailable")}</h3>
            <p>{t("news.article.unavailableSub")}</p>
            <Link to="/news" className="section-link" style={{ display: "inline-block", marginTop: 16 }}>
              ← {t("news.article.back")}
            </Link>
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
              <img
                className="article-hero"
                src={article.image}
                alt={article.title}
                referrerPolicy="no-referrer"
                loading="lazy"
              />
            ) : (
              <div className="article-hero article-hero-ph" />
            )}
          </>
        )}
      </section>

      {article ? (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="article-body">
            {(article.body || article.excerpt || "")
              .split("\n\n")
              .map((para, i) => para.trim() ? <p key={i}>{para}</p> : null)}
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

          <div className="article-share">
            <span className="share-label">{t("news.article.share")}</span>
            <button className="share-btn" type="button" title="Telegram" onClick={() => share("tg")}>✈</button>
            <button className="share-btn" type="button" title={t("news.article.copy", "Скопіювати посилання")} onClick={() => share("copy")}>
              {copied ? "✓" : "🔗"}
            </button>
            <button className="share-btn" type="button" title="X / Twitter" onClick={() => share("x")}>𝕏</button>
          </div>

          <a
            className="article-source-link"
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("news.article.readSource")}
          </a>
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
              <Link
                key={r.slug || r.id}
                to={r.slug ? `/news/${r.slug}` : "#"}
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
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}