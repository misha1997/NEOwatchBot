"""Server-side per-route SEO meta injection for the OrbitLight React SPA.

The SPA is client-rendered, so crawlers that don't execute JavaScript
(Facebook/Twitter/Telegram scrapers, Bing, …) would otherwise see the *same*
index.html shell for every URL — i.e. the homepage's title/description/OG.
FastAPI's catch-all already returns ``index.html`` for every route, so this
module rewrites that shell per requested **language + route** before sending
it: unique ``<title>``, meta description, canonical, Open Graph / Twitter tags,
hreflang alternates (uk/en/x-default) and JSON-LD ``WebPage`` +
``BreadcrumbList`` (and ``NewsArticle`` for news pages). Strings are read from
the same i18n dictionaries the client uses (``my-app/src/i18n/{uk,en}.json``)
so there is a single source of truth.

URL scheme: every public page lives under a language path prefix —
``/ua/<slug>`` (Ukrainian, default) or ``/en/<slug>`` (English). Slugs are
**translated** per language (see ``SLUGS`` below): Ukrainian slugs are Latin
transliterations, English slugs are English. The site root ``/`` 301-redirects
to the right language home (Accept-Language + the ``neowatch.lang`` cookie).
There is no unprefixed content — no duplicate-content URLs.

Public API:
    - ``render_html(index_html, name, lang) -> str``
    - ``render_head(name, lang) -> str``
    - ``build_sitemap_index_xml()`` / ``build_sitemap_pages_xml()``
      / ``build_sitemap_news_xml()``
    - ``build_robots_txt() -> str``
    - ``SITE_URL``, ``SLUGS``, ``name_for_slug(lang, slug)``, ``slug_for_name(name, lang)``
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

import os

SITE_URL = os.getenv("SITE_URL", "https://orbitlight.space").rstrip("/")
DEFAULT_LANG = "uk"
LANGS = ("uk", "en")

# Internal language code (ISO 639-1, used for hreflang values + i18n dict keys)
# → URL path prefix. Ukrainian's URL prefix is ``ua`` (the spec's /ua/...),
# not ``uk`` — hreflang still uses the ISO ``uk`` value. English is identity.
_LANG_PREFIX = {"uk": "ua", "en": "en"}
_PREFIX_TO_LANG = {v: k for k, v in _LANG_PREFIX.items()}


def prefix_for(lang: str) -> str:
    """URL path prefix for a language code: uk→'ua', en→'en'."""
    return _LANG_PREFIX.get(lang, "en")


def lang_for_prefix(prefix: str) -> str:
    """Inverse of prefix_for: 'ua'→'uk', 'en'→'en'."""
    return _PREFIX_TO_LANG.get(prefix, "en")

_I18N_DIR = Path(__file__).resolve().parent.parent / "my-app" / "src" / "i18n"


def _load_dict(lang: str) -> dict:
    with open(_I18N_DIR / f"{lang}.json", encoding="utf-8") as fh:
        return json.load(fh)


# Loaded once at import. If the build hasn't placed the dictionaries yet (e.g.
# during a partial dev setup), fall back to empty strings so the site still
# serves — the client will set the right title once it loads.
try:
    _UK = _load_dict("uk")
    _EN = _load_dict("en")
except FileNotFoundError:
    _UK = {}
    _EN = {}

_DICTS = {"uk": _UK, "en": _EN}

# i18n_name -> {uk_slug, en_slug}. Ukrainian slugs are Latin transliterations,
# English slugs are English. This is the authoritative source of truth for the
# URL space; ``my-app/src/lib/seo.js`` mirrors it for the client. Keep parity.
# News articles use the dynamic ``/news/<slug>`` path under each lang prefix
# (``novyny`` for UA, ``news`` for EN); the article slug itself comes from the
# DB and is shared across languages (see build_sitemap_news_xml / NewsArticle).
SLUGS: dict[str, dict[str, str]] = {
    "home":         {"uk": "",                  "en": ""},
    "iss":          {"uk": "mks",               "en": "iss"},
    "satellites":   {"uk": "suputnyky",         "en": "satellites"},
    "weather":      {"uk": "kosmichna-pogoda",   "en": "weather"},
    "sky":          {"uk": "nebo",              "en": "sky"},
    "constellations": {"uk": "suzirya",         "en": "constellations"},
    "mast":         {"uk": "mast",              "en": "mast"},
    "meteors":      {"uk": "meteory",           "en": "meteors"},
    "asteroids":    {"uk": "asteroidy",         "en": "asteroids"},
    "events":       {"uk": "podiyi",            "en": "events"},
    "launches":     {"uk": "zapusky",           "en": "launches"},
    "news":         {"uk": "novyny",            "en": "news"},
    "deep":         {"uk": "dalniy-kosmos",     "en": "deep"},
    "voyager":      {"uk": "voyadzher",         "en": "voyager"},
    "comets":       {"uk": "komety",            "en": "comets"},
    "exoplanets":   {"uk": "ekzoplanety",       "en": "exoplanets"},
    "gallery":      {"uk": "galereya",          "en": "gallery"},
    "planetarium":  {"uk": "planetariy",        "en": "planetarium"},
    "mars":         {"uk": "planetariy/mars",   "en": "planetarium/mars"},
    "jupiter":      {"uk": "planetariy/yupiter","en": "planetarium/jupiter"},
    "mercury":      {"uk": "planetariy/merkuriy","en": "planetarium/mercury"},
}

# Reverse map: lang -> {slug -> name}. Built once at import.
_SLUG_TO_NAME: dict[str, dict[str, str]] = {
    lang: {entry[lang]: name for name, entry in SLUGS.items()}
    for lang in LANGS
}

# Pages excluded from the sitemap (none currently; rtl-sdr/community are
# unlinked and have no entry in SLUGS at all, so they're already absent).
_SITEMAP_NAMES = [n for n in SLUGS.keys()]


def slug_for_name(name: str, lang: str) -> str:
    entry = SLUGS.get(name)
    if not entry:
        return ""
    return entry.get(lang, entry.get("en", ""))


def name_for_slug(lang: str, slug: str) -> str:
    """Resolve a URL slug (under a lang prefix) to the i18n route name.

    ``""`` (the language home, e.g. ``/ua/``) resolves to ``"home"``.
    Unknown slugs resolve to ``"404"`` so non-JS crawlers of a deep link that
    404s still get a sensible head — and the server returns HTTP 404.
    """
    if slug == "" or slug == "/":
        return "home"
    return _SLUG_TO_NAME.get(lang, {}).get(slug, "404")


def _t(lang: str, *keys: str, default: str = "") -> str:
    node: object = _DICTS.get(lang) or _DICTS.get("uk")
    for k in keys:
        if isinstance(node, dict):
            node = node.get(k)
        else:
            return default
    return node if isinstance(node, str) else default


def _title(lang: str, name: str) -> str:
    return _t(lang, "title", name, default="OrbitLight — небо зараз")


def _desc(lang: str, name: str) -> str:
    val = _t(lang, "seo", "desc", name)
    if val:
        return val
    if lang != "uk":
        return _desc("uk", name)
    return ""


def _nav_name(lang: str, name: str) -> str:
    """Short label for breadcrumb (e.g. 'МКС'); home → 'OrbitLight'."""
    if name == "home":
        return "OrbitLight"
    return _t(lang, "nav", name, default=_title(lang, name))


def _loc(name: str, lang: str) -> str:
    """Absolute canonical URL for a (route name, language). Home → ``/ua/`` or
    ``/en/``. Uses the URL prefix (uk→ua), not the ISO code."""
    slug = slug_for_name(name, lang)
    pfx = prefix_for(lang)
    if not slug:
        return f"{SITE_URL}/{pfx}/"
    return f"{SITE_URL}/{pfx}/{slug}"


_OG_IMAGE = SITE_URL + "/web-app-manifest-512x512.png"


def _render_webpage_jsonld(name: str, lang: str) -> str:
    canonical = _loc(name, lang)
    is_home = name == "home"
    breadcrumb_items = [
        {"@type": "ListItem", "position": 1, "name": "OrbitLight",
         "item": f"{SITE_URL}/{prefix_for(lang)}/"},
    ]
    if not is_home:
        breadcrumb_items.append(
            {"@type": "ListItem", "position": 2, "name": _nav_name(lang, name),
             "item": canonical},
        )
    web_page = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": _title(lang, name),
        "description": _desc(lang, name) or "OrbitLight — небо зараз.",
        "url": canonical,
        "inLanguage": _og_locale(lang),
        "isPartOf": {"@type": "WebSite", "url": f"{SITE_URL}/{prefix_for(lang)}/", "name": "OrbitLight"},
        "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": breadcrumb_items},
    }
    return json.dumps(web_page, ensure_ascii=False)


def _render_news_jsonld(article: dict, lang: str) -> str:
    """NewsArticle JSON-LD for a /news/<slug> page. ``article`` is a row from
    ``database.get_news_article_by_slug``. Localized headline via title_uk in
    UA mode. Returns "" if no usable article."""
    if not article:
        return ""
    title = article.get("title_uk") or article.get("title") if lang == "uk" else article.get("title")
    slug = article.get("slug") or ""
    news_slug = slug_for_name("news", lang)
    url = f"{SITE_URL}/{prefix_for(lang)}/{news_slug}/{slug}" if slug else ""
    image = article.get("image") or _OG_IMAGE
    pub = article.get("published_date") or article.get("fetched_at") or ""
    obj = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": title or "",
        "inLanguage": _og_locale(lang),
        "url": url,
        "image": image if image else _OG_IMAGE,
        "datePublished": pub.isoformat() if hasattr(pub, "isoformat") else str(pub) if pub else "",
        "author": {"@type": "Organization", "name": article.get("source") or "OrbitLight"},
        "publisher": {"@type": "Organization", "name": "OrbitLight",
                      "logo": {"@type": "ImageObject", "url": _OG_IMAGE}},
        "isPartOf": {"@type": "WebSite", "url": f"{SITE_URL}/{prefix_for(lang)}/", "name": "OrbitLight"},
    }
    return json.dumps(obj, ensure_ascii=False)


def _og_locale(lang: str) -> str:
    return "uk_UA" if lang == "uk" else "en_US"


def render_head(name: str, lang: str, extra_jsonld: str = "",
                overrides: dict | None = None) -> str:
    """Return the HTML <head> fragment to splice between the SEO markers.

    ``name`` is the i18n route name (e.g. ``"iss"``), ``lang`` the URL language.
    ``extra_jsonld`` (optional) is an already-serialized JSON-LD string to
    append (used for NewsArticle on news pages).
    ``overrides`` (optional) may carry ``title``, ``desc``, ``canonical``,
    ``uk_alt``, ``en_alt`` — used for dynamic pages like news articles whose
    meta must be unique per article (per-page title/description, §4).
    """
    if lang not in _DICTS:
        lang = DEFAULT_LANG
    if name not in SLUGS and name != "404":
        name = "404"
    ov = overrides or {}
    title = ov.get("title") or _title(lang, name)
    desc = ov.get("desc") or _desc(lang, name) or "OrbitLight — небо зараз."
    canonical = ov.get("canonical") or (_loc(name, lang) if name != "404" else f"{SITE_URL}/{prefix_for(lang)}/404")
    uk_alt = ov.get("uk_alt") or (_loc(name, "uk") if name != "404" else f"{SITE_URL}/ua/404")
    en_alt = ov.get("en_alt") or (_loc(name, "en") if name != "404" else f"{SITE_URL}/en/404")
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    jsonld = _render_webpage_jsonld(name, lang) if name != "404" else ""
    head = (
        f'<title>{e(title)}</title>\n'
        f'    <meta name="description" content="{e(desc)}" />\n'
        f'    <link rel="canonical" href="{e(canonical)}" />\n'
        f'    <link rel="alternate" hreflang="uk" href="{e(uk_alt)}" />\n'
        f'    <link rel="alternate" hreflang="en" href="{e(en_alt)}" />\n'
        f'    <link rel="alternate" hreflang="x-default" href="{e(en_alt)}" />\n'
        f'    <meta property="og:type" content="website" />\n'
        f'    <meta property="og:site_name" content="OrbitLight" />\n'
        f'    <meta property="og:locale" content="{_og_locale(lang)}" />\n'
        f'    <meta property="og:locale:alternate" content="{"en_US" if lang == "uk" else "uk_UA"}" />\n'
        f'    <meta property="og:title" content="{e(title)}" />\n'
        f'    <meta property="og:description" content="{e(desc)}" />\n'
        f'    <meta property="og:url" content="{e(canonical)}" />\n'
        f'    <meta property="og:image" content="{e(_OG_IMAGE)}" />\n'
        f'    <meta property="og:image:type" content="image/png" />\n'
        f'    <meta property="og:image:width" content="512" />\n'
        f'    <meta property="og:image:height" content="512" />\n'
        f'    <meta property="og:image:alt" content="OrbitLight — лого" />\n'
        f'    <meta name="twitter:card" content="summary_large_image" />\n'
        f'    <meta name="twitter:title" content="{e(title)}" />\n'
        f'    <meta name="twitter:description" content="{e(desc)}" />\n'
        f'    <meta name="twitter:image" content="{e(_OG_IMAGE)}" />\n'
    )
    if jsonld:
        head += f'    <script type="application/ld+json">{jsonld}</script>'
    if extra_jsonld:
        head += f'\n    <script type="application/ld+json">{extra_jsonld}</script>'
    return head


_HEAD_BLOCK_RE = re.compile(
    r'<meta\s+name="seo-head"\s+content="start"\s*/>.*?'
    r'<meta\s+name="seo-head"\s+content="end"\s*/>',
    re.DOTALL,
)
_HTML_LANG_RE = re.compile(r'<html\s+lang="[a-zA-Z\-]+">')


def render_html(index_html: str, name: str, lang: str, extra_jsonld: str = "",
                overrides: dict | None = None) -> str:
    """Splice per-route head into the built index.html and set <html lang>.

    The replaceable block is delimited by ``<meta name="seo-head"
    content="start|end" />`` markers — meta tags (not HTML comments) so they
    survive Create React App's production build, which strips comments.
    """
    head = render_head(name, lang, extra_jsonld=extra_jsonld, overrides=overrides)
    out, n = _HEAD_BLOCK_RE.subn(head, index_html, count=1)
    if n == 0:
        # Markers missing (e.g. an older build) — inject before </head> as a
        # graceful fallback so crawlers still get per-route meta.
        out = index_html.replace("</head>", head + "\n  </head>", 1)
    out = _HTML_LANG_RE.sub(f'<html lang="{lang}">', out, count=1)
    return out


def build_sitemap_index_xml() -> str:
    """sitemap-index pointing at the pages + news sitemaps."""
    today = _today()
    subs = [
        (f"{SITE_URL}/sitemap-pages.xml", today),
        (f"{SITE_URL}/sitemap-news.xml", today),
    ]
    items = "\n".join(
        f"  <sitemap>\n    <loc>{html.escape(loc)}</loc>\n    <lastmod>{lm}</lastmod>\n  </sitemap>"
        for loc, lm in subs
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + items + "\n</sitemapindex>\n"
    )


def _priority_changefreq(name: str) -> tuple[str, str]:
    if name == "home":
        return "1.0", "daily"
    if name in ("news", "events", "iss", "satellites", "weather", "launches"):
        return "0.8", "daily"
    return "0.6", "weekly"


def build_sitemap_pages_xml() -> str:
    """Sitemap for the static pages — both languages, with hreflang alternates."""
    today = _today()
    urls = []
    for name in _SITEMAP_NAMES:
        if name == "home":
            # Home: emit one <url> per language, alternates point at both.
            for lang in LANGS:
                loc = _loc(name, lang)
                uk_alt = _loc(name, "uk")
                en_alt = _loc(name, "en")
                pri, freq = _priority_changefreq(name)
                urls.append(_sitemap_url(loc, today, freq, pri, uk_alt, en_alt))
        else:
            for lang in LANGS:
                loc = _loc(name, lang)
                uk_alt = _loc(name, "uk")
                en_alt = _loc(name, "en")
                pri, freq = _priority_changefreq(name)
                urls.append(_sitemap_url(loc, today, freq, pri, uk_alt, en_alt))
    return _wrap_urlset(urls)


def _sitemap_url(loc, lastmod, changefreq, priority, uk_alt, en_alt) -> str:
    return (
        f"  <url>\n"
        f"    <loc>{html.escape(loc)}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f'    <xhtml:link rel="alternate" hreflang="uk" href="{html.escape(uk_alt)}" />\n'
        f'    <xhtml:link rel="alternate" hreflang="en" href="{html.escape(en_alt)}" />\n'
        f'    <xhtml:link rel="alternate" hreflang="x-default" href="{html.escape(en_alt)}" />\n'
        f"  </url>"
    )


def _wrap_urlset(urls: list[str]) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls) + "\n</urlset>\n"
    )


def build_sitemap_news_xml() -> str:
    """Sitemap for news articles (``/ua/novyny/<slug>`` + ``/en/news/<slug>``).

    Reads recent articles from the DB; returns an empty (but valid) urlset if
    the DB is unavailable so the site never 500s on /sitemap-news.xml. Article
    slugs are language-neutral (one slug per article, shared across prefixes).
    """
    today = _today()
    urls: list[str] = []
    try:
        from database import get_news_articles  # local import — avoid hard DB dep at import
        articles = get_news_articles(limit=500)
    except Exception:  # noqa: BLE001 — must never break the sitemap
        articles = []

    news_slugs = {lang: slug_for_name("news", lang) for lang in LANGS}
    seen = set()
    for a in articles:
        slug = a.get("slug")
        if not slug or slug in seen:
            continue
        seen.add(slug)
        pub = a.get("published_date") or a.get("fetched_at") or today
        pub_iso = pub.isoformat() if hasattr(pub, "isoformat") else str(pub) if pub else today
        title_uk = a.get("title_uk") or a.get("title") or ""
        title_en = a.get("title") or ""
        for lang in LANGS:
            loc = f"{SITE_URL}/{prefix_for(lang)}/{news_slugs[lang]}/{slug}"
            uk_alt = f"{SITE_URL}/ua/{news_slugs['uk']}/{slug}"
            en_alt = f"{SITE_URL}/en/{news_slugs['en']}/{slug}"
            # news:news markup
            news_block = (
                "    <news:news>\n"
                f"      <news:publication>\n"
                f"        <news:name>OrbitLight</news:name>\n"
                f"        <news:language>{lang}</news:language>\n"
                f"        <news:publication_date>{pub_iso}</news:publication_date>\n"
                f"        <news:title>{html.escape(title_uk if lang == 'uk' else title_en)}</news:title>\n"
                "      </news:publication>\n"
                "    </news:news>\n"
            )
            url = (
                f"  <url>\n"
                f"    <loc>{html.escape(loc)}</loc>\n"
                f"    <lastmod>{today}</lastmod>\n"
                f"    {news_block}"
                f'    <xhtml:link rel="alternate" hreflang="uk" href="{html.escape(uk_alt)}" />\n'
                f'    <xhtml:link rel="alternate" hreflang="en" href="{html.escape(en_alt)}" />\n'
                f'    <xhtml:link rel="alternate" hreflang="x-default" href="{html.escape(en_alt)}" />\n'
                f"  </url>"
            )
            urls.append(url)
    # Empty news sitemap must still be valid + declare the news namespace so
    # GSC accepts it even before any articles are indexed.
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml"\n'
        '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n'
        + "\n".join(urls) + "\n</urlset>\n"
    )


def build_robots_txt() -> str:
    return (
        "User-agent: *\n"
        "Allow: /ua/\n"
        "Allow: /en/\n"
        "Disallow: /api/\n"
        "Disallow: /admin/\n"
        "Disallow: /*?lang=\n"
        f"\nSitemap: {SITE_URL}/sitemap.xml\n"
    )


def _today() -> str:
    from datetime import date
    return date.today().isoformat()