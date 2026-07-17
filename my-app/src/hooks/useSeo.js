// Keeps the document head in sync with the active SPA route + language.
//
// The server (web/seo.py) injects correct per-route meta into the initial
// HTML for non-JS crawlers. This hook handles the *live* case: when a user
// navigates client-side (or Googlebot's JS pass re-renders), it updates
// <title>, meta description, canonical, hreflang alternates, og:* and
// twitter:* to match the new route, so the browser tab and any second-pass
// indexing stay correct.
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { nameFromPath, locFor } from "../lib/seo";

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

// hreflang alternates: one link[rel=alternate] per hreflang value. Because
// the server already injects these for the initial load, we update existing
// ones in place (matched by hreflang attr) and add any missing.
function upsertHreflang(hreflang, href) {
  let el = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "alternate");
    el.setAttribute("hreflang", hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSeo() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const resolved = nameFromPath(pathname);
  const { name, lang } = resolved;

  useEffect(() => {
    const title = t(`title.${name}`);
    const desc = t(`seo.desc.${name}`);
    const canonical = locFor(name, lang);
    const ukAlt = locFor(name, "uk");
    const enAlt = locFor(name, "en");

    if (title) document.title = title;
    if (desc) upsertMeta('meta[name="description"]', "name", "description", desc);
    upsertLink("canonical", canonical);
    upsertHreflang("uk", ukAlt);
    upsertHreflang("en", enAlt);
    upsertHreflang("x-default", enAlt);
    upsertMeta('meta[property="og:title"]', "property", "og:title", title || "");
    upsertMeta('meta[property="og:description"]', "property", "og:description", desc || "");
    upsertMeta('meta[property="og:url"]', "property", "og:url", canonical);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title || "");
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", desc || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, name, lang, t]);
}