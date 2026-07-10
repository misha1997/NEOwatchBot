"""Server-side per-route SEO meta injection for the OrbitLight React SPA.

The SPA is client-rendered, so crawlers that don't execute JavaScript
(Facebook/Twitter/Telegram scrapers, Bing, …) would otherwise see the *same*
index.html shell for every URL — i.e. the homepage's title/description/OG.
FastAPI's ``_spa`` catch-all already returns ``index.html`` for every route,
so this module rewrites that shell per requested path + ``?lang=`` before
sending it: unique ``<title>``, meta description, canonical, Open Graph /
Twitter tags, hreflang alternates (uk/en/x-default) and JSON-LD
``WebPage`` + ``BreadcrumbList``. Strings are read from the same i18n
dictionaries the client uses (``my-app/src/i18n/{uk,en}.json``) so there is a
single source of truth.

Public API:
    - ``render_html(index_html: str, path: str, lang: str) -> str``
    - ``build_sitemap_xml() -> str``
    - ``build_robots_txt() -> str``
    - ``SITE_URL``, ``ROUTES``
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

# Site origin used for absolute URLs (canonical, og:url, sitemap). Override
# with the SITE_URL env var in production.
import os

SITE_URL = os.getenv("SITE_URL", "https://orbitlight.space").rstrip("/")

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

# Ordered (url_path, i18n_name) for every SPA route. ``name`` is the key under
# ``title.<name>`` and ``seo.desc.<name>`` in the dictionaries. The ``rtl-sdr``
# route maps to the ``rtl`` i18n name.
ROUTES: list[tuple[str, str]] = [
    ("", "home"),
    ("iss", "iss"),
    ("satellites", "satellites"),
    ("weather", "weather"),
    ("sky", "sky"),
    ("constellations", "constellations"),
    ("mast", "mast"),
    ("meteors", "meteors"),
    ("asteroids", "asteroids"),
    ("events", "events"),
    ("launches", "launches"),
    ("deep", "deep"),
    ("voyager", "voyager"),
    ("comets", "comets"),
    ("exoplanets", "exoplanets"),
    # /rtl-sdr and /community pages are kept on disk but currently unlinked
    # (routes disabled in App.js). They resolve to the 404 head here and are
    # omitted from the sitemap. Re-add to restore indexing.
]

# path -> name for O(1) lookup; unknown paths resolve to the 404 entry.
_ROUTE_MAP = dict(ROUTES)
_NAME_404 = "404"

_OG_IMAGE = SITE_URL + "/web-app-manifest-512x512.png"


def _route_for(path: str) -> str:
    """Resolve a request path (as passed by the SPA catch-all) to an i18n name.

    ``path`` is the FastAPI ``full_path`` capture: ``""`` for the root, ``"iss"``
    for ``/iss``, etc. Unknown paths return the 404 name so non-JS crawlers of
    a deep link that 404s still get a sensible, indexable head.
    """
    p = path.strip("/")
    if p in _ROUTE_MAP:
        return _ROUTE_MAP[p]
    return _NAME_404


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
    return _t(lang, "seo", "desc", name, default=_desc("uk", name) if lang != "uk" else "")


def _nav_name(lang: str, name: str) -> str:
    """Short label for breadcrumb (e.g. 'МКС'); home → 'OrbitLight'."""
    if name == "home":
        return "OrbitLight"
    return _t(lang, "nav", name, default=_title(lang, name))


def _loc(path: str, lang_qs: str | None = None) -> str:
    """Absolute URL for a route path, optionally with ?lang=en."""
    url = SITE_URL + "/" + path.strip("/")
    if not path.strip("/"):
        url = SITE_URL + "/"
    if lang_qs:
        url += ("?lang=" + lang_qs) if "?" not in url else ("&lang=" + lang_qs)
    return url


def _render_jsonld(path: str, lang: str, name: str) -> str:
    canonical = _loc(path)
    is_home = name == "home"
    breadcrumb_items = [
        {"@type": "ListItem", "position": 1, "name": "OrbitLight",
         "item": SITE_URL + "/"},
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
        "description": _desc(lang, name),
        "url": canonical,
        "inLanguage": lang,
        "isPartOf": {"@type": "WebSite", "url": SITE_URL + "/", "name": "OrbitLight"},
        "breadcrumb": {"@type": "BreadcrumbList", "itemListElement": breadcrumb_items},
    }
    return json.dumps(web_page, ensure_ascii=False)


def render_head(path: str, lang: str) -> str:
    """Return the HTML <head> fragment to splice between the SEO markers."""
    if lang not in _DICTS:
        lang = "uk"
    name = _route_for(path)
    title = _title(lang, name)
    desc = _desc(lang, name) or "OrbitLight — небо зараз."
    canonical = _loc(path)
    en_alt = _loc(path, "en")
    og_image = _OG_IMAGE
    e = lambda s: html.escape(s, quote=True)  # noqa: E731
    return (
        f'<title>{e(title)}</title>\n'
        f'    <meta name="description" content="{e(desc)}" />\n'
        f'    <link rel="canonical" href="{e(canonical)}" />\n'
        f'    <link rel="alternate" hreflang="uk" href="{e(canonical)}" />\n'
        f'    <link rel="alternate" hreflang="en" href="{e(en_alt)}" />\n'
        f'    <link rel="alternate" hreflang="x-default" href="{e(canonical)}" />\n'
        f'    <meta property="og:type" content="website" />\n'
        f'    <meta property="og:site_name" content="OrbitLight" />\n'
        f'    <meta property="og:locale" content="{"uk_UA" if lang == "uk" else "en_US"}" />\n'
        f'    <meta property="og:locale:alternate" content="{"en_US" if lang == "uk" else "uk_UA"}" />\n'
        f'    <meta property="og:title" content="{e(title)}" />\n'
        f'    <meta property="og:description" content="{e(desc)}" />\n'
        f'    <meta property="og:url" content="{e(canonical)}" />\n'
        f'    <meta property="og:image" content="{e(og_image)}" />\n'
        f'    <meta property="og:image:type" content="image/png" />\n'
        f'    <meta property="og:image:width" content="512" />\n'
        f'    <meta property="og:image:height" content="512" />\n'
        f'    <meta property="og:image:alt" content="OrbitLight — лого" />\n'
        f'    <meta name="twitter:card" content="summary_large_image" />\n'
        f'    <meta name="twitter:title" content="{e(title)}" />\n'
        f'    <meta name="twitter:description" content="{e(desc)}" />\n'
        f'    <meta name="twitter:image" content="{e(og_image)}" />\n'
        f'    <script type="application/ld+json">{_render_jsonld(path, lang, name)}</script>'
    )


_HEAD_BLOCK_RE = re.compile(
    r'<meta\s+name="seo-head"\s+content="start"\s*/>.*?'
    r'<meta\s+name="seo-head"\s+content="end"\s*/>',
    re.DOTALL,
)
_HTML_LANG_RE = re.compile(r'<html\s+lang="[a-zA-Z\-]+">')


def render_html(index_html: str, path: str, lang: str) -> str:
    """Splice per-route head into the built index.html and set <html lang>.

    The replaceable block is delimited by ``<meta name="seo-head"
    content="start|end" />`` markers — meta tags (not HTML comments) so they
    survive Create React App's production build, which strips comments.
    """
    head = render_head(path, lang)
    out, n = _HEAD_BLOCK_RE.subn(head, index_html, count=1)
    if n == 0:
        # Markers missing (e.g. an older build) — inject before </head> as a
        # graceful fallback so crawlers still get per-route meta.
        out = index_html.replace("</head>", head + "\n  </head>", 1)
    out = _HTML_LANG_RE.sub(f'<html lang="{lang}">', out, count=1)
    return out


def build_sitemap_xml() -> str:
    """Sitemap with hreflang uk/en/x-default alternates for every route."""
    from datetime import date
    lastmod = date.today().isoformat()
    urls = []
    for path, _name in ROUTES:
        loc = _loc(path)
        en = _loc(path, "en")
        urls.append(
            f"    <url>\n"
            f"      <loc>{html.escape(loc)}</loc>\n"
            f"      <lastmod>{lastmod}</lastmod>\n"
            f'      <xhtml:link rel="alternate" hreflang="uk" href="{html.escape(loc)}" />\n'
            f'      <xhtml:link rel="alternate" hreflang="en" href="{html.escape(en)}" />\n'
            f'      <xhtml:link rel="alternate" hreflang="x-default" href="{html.escape(loc)}" />\n'
            f"    </url>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )


def build_robots_txt() -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n"
    )