// Homepage "Останні новини" — the latest 6 articles from /api/news, same
// card markup/styles as the News page's cards view (news.css) so the two
// feeds look identical. Items with an id+slug link to the on-site article
// page; live-without-DB items link out to the source, same as News.js.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLang } from "../../context/LanguageContext";
import { getNews } from "../../lib/api";
import { pathFor } from "../../lib/seo";
import LocalizedLink from "../primitives/LocalizedLink";
import "../../styles/news.css";

const PAGE_SIZE = 6;

export default function NewsCards() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data, loading, error } = useApi(
    () => getNews(lang, { page: 0, pageSize: PAGE_SIZE }),
    { deps: [lang] }
  );
  const items = ((data && data.items) || []).slice(0, PAGE_SIZE);
  const catLabel = (c) => t(`news.cat.${c}`, { defaultValue: c });

  if (loading || error || items.length === 0) {
    return (
      <div className="news-list view-cards">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <div className="news-card" key={i} aria-hidden="true">
            <div className="news-card-preview news-card-preview-ph" />
            <div className="news-card-body">
              <div className="top-row"><span className="cat-pill missions">—</span></div>
              <h4 style={{ color: "var(--text-dim)" }}>—</h4>
              <p style={{ color: "var(--text-dim)" }}>—</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="news-list view-cards">
      {items.map((it, i) => {
        const hasSlug = !!(it.id && it.slug);
        const preview = it.image ? (
          <div className="news-card-preview" style={{ backgroundImage: `url("${it.image}")` }} />
        ) : (
          <div className={"news-card-preview news-card-preview-ph cat-" + (it.category || "missions")} />
        );
        const body = (
          <div className="news-card-body">
            <div className="top-row">
              <span className={"cat-pill " + (it.category || "missions")}>{catLabel(it.category)}</span>
            </div>
            <h4>{it.title || "—"}</h4>
            <p>{it.excerpt}</p>
            <div className="bottom-row">
              <span>{it.source} · {it.date}</span>
            </div>
          </div>
        );
        return hasSlug ? (
          <LocalizedLink className="news-card" to={`${pathFor("news", lang)}/${it.slug}`} key={it.slug}>
            {preview}
            {body}
          </LocalizedLink>
        ) : (
          <a className="news-card" href={it.url} target="_blank" rel="noopener noreferrer" key={"live" + i}>
            {preview}
            {body}
          </a>
        );
      })}
    </div>
  );
}
