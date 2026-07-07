// Keeps the document head in sync with the active SPA route + language.
//
// The server (web/seo.py) already injects correct per-route meta into the
// initial HTML for non-JS crawlers. This hook handles the *live* case: when a
// user navigates client-side (or Googlebot's JS pass re-renders), it updates
// <title>, meta description, canonical, og:* and twitter:* to match the new
// route, so the browser tab and any second-pass indexing stay correct.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { nameForPath, SITE_URL } from "../lib/seo";

function upsertMeta(selector, attrKey, attrVal, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrKey, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const { lang } = useLang();

  useEffect(() => {
    const name = nameForPath(pathname);
    const title = t(`title.${name}`);
    const desc = t(`seo.desc.${name}`);
    const canonical = SITE_URL + (pathname === "/" ? "/" : pathname);

    if (title) document.title = title;
    if (desc) upsertMeta('meta[name="description"]', "name", "description", desc);
    upsertLink("canonical", canonical);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title || "");
    upsertMeta('meta[property="og:description"]', "property", "og:description", desc || "");
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title || "");
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", desc || "");
  }, [pathname, lang, t]);
}