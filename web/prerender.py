"""Headless-Chrome prerendering for SEO bots.

The site is a client-rendered React SPA. ``web/seo.py`` already injects correct
per-route ``<head>`` meta into the shell so non-JS crawlers get the right
title/canonical/hreflang/OG, but the *body* (the actual page content) is still
rendered by JavaScript. Most crawlers that matter (Googlebot) execute JS, but
Bing, Facebook/Twitter/Telegram scrapers and others often don't — they'd see
an empty body. This module renders the full page with headless Chrome for
known bot User-Agents and caches the result, so those crawlers get indexable
HTML with the content in the initial response.

Env-gated: only active when ``PRERENDER_ENABLED=1``. Default off — the
meta-injected shell is a fine baseline; enable once Playwright + Chromium are
installed on the host. Recursion is prevented with an ``X-Prerender-Internal``
header: when the headless browser fetches the page from this same server, the
request carries that header and the SPA catch-all skips prerendering for it
(see ``web/app.py`` ``_spa_lang``).

Public API:
    - ``get_rendered(lang, rest, name) -> str | None``  (async)
    - ``launch_browser(app)`` / ``close_browser(app)``  (lifespan hooks)

Provider alternative: set ``PRERENDER_PROVIDER=prerenderio`` and
``PRERENDER_IO_TOKEN`` to proxy to Prerender.io instead of running Chromium
locally (no heavy browser dep, but external + paid at scale). Not implemented
here beyond the dispatch hook — wire it in ``get_rendered`` if needed.
"""
from __future__ import annotations

import logging
import os
import time
from pathlib import Path

logger = logging.getLogger(__name__)

_PROVIDER = os.getenv("PRERENDER_PROVIDER", "self")  # self | prerenderio
_TTL = int(os.getenv("PRERENDER_TTL", "86400"))  # seconds; default 24h
_PORT = os.getenv("PORT", "8000")
_TIMEOUT_MS = int(os.getenv("PRERENDER_TIMEOUT_MS", "8000"))

_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "prerender"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# In-memory LRU-ish cache: (lang, rest) -> (expires_at, html). Bounded to avoid
# unbounded growth; overflow evicts the oldest entry (good enough — the disk
# cache is the durable layer).
_MEM: dict[tuple[str, str], tuple[float, str]] = {}
_MEM_MAX = 256


def _disk_path(lang: str, rest: str) -> Path:
    safe = rest.replace("/", "__") or "_home"
    return _CACHE_DIR / lang / f"{safe}.html"


def _read_disk(path: Path) -> str | None:
    try:
        if path.is_file() and (time.time() - path.stat().st_mtime) < _TTL:
            return path.read_text(encoding="utf-8")
    except OSError:
        return None
    return None


def _write_disk(path: Path, html: str) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding="utf-8")
    except OSError as exc:  # disk full / perms — non-fatal
        logger.warning("prerender disk write failed (%s): %s", path, exc)


def _mem_get(lang: str, rest: str) -> str | None:
    entry = _MEM.get((lang, rest))
    if entry and entry[0] > time.time():
        return entry[1]
    if entry:
        _MEM.pop((lang, rest), None)
    return None


def _mem_put(lang: str, rest: str, html: str) -> None:
    if len(_MEM) >= _MEM_MAX:
        _MEM.pop(next(iter(_MEM)), None)
    _MEM[(lang, rest)] = (time.time() + _TTL, html)


async def launch_browser(app) -> None:
    """Start the shared headless Chromium. Called from the FastAPI lifespan
    when ``PRERENDER_ENABLED=1``. Stored on ``app.state.prerender_browser``."""
    if _PROVIDER != "self":
        return  # Prerender.io — no local browser
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error(
            "PRERENDER_ENABLED=1 but playwright is not installed. "
            "Run `pip install playwright` and `playwright install chromium`, "
            "or set PRERENDER_PROVIDER=prerenderio. Falling back to shell."
        )
        return
    pw = await async_playwright().start()
    try:
        app.state.prerender_playwright = pw
        app.state.prerender_browser = await pw.chromium.launch(
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        logger.info("Prerender headless Chromium started")
    except Exception as exc:  # noqa: BLE001
        logger.error("Prerender browser launch failed: %s — serving shell", exc)
        await pw.stop()
        app.state.prerender_playwright = None
        app.state.prerender_browser = None


async def close_browser(app) -> None:
    browser = getattr(app.state, "prerender_browser", None)
    pw = getattr(app.state, "prerender_playwright", None)
    if browser is not None:
        try:
            await browser.close()
        except Exception:  # noqa: BLE001
            pass
    if pw is not None:
        try:
            await pw.stop()
        except Exception:  # noqa: BLE001
            pass
    app.state.prerender_browser = None
    app.state.prerender_playwright = None


async def _render_self(app, lang: str, rest: str) -> str | None:
    """Render /<prefix>/<rest> by loading this server's own URL in headless
    Chrome, with the X-Prerender-Internal header so the server serves the SPA
    shell (not a prerendered copy) and the client JS fills the body."""
    from web.seo import prefix_for
    browser = getattr(app.state, "prerender_browser", None)
    if browser is None:
        return None
    pfx = prefix_for(lang)
    url = f"http://127.0.0.1:{_PORT}/{pfx}/{rest}".rstrip("/")
    if not rest:
        url = f"http://127.0.0.1:{_PORT}/{pfx}/"
    page = await browser.new_page()
    try:
        await page.set_extra_http_headers({"X-Prerender-Internal": "1"})
        await page.goto(url, wait_until="networkidle", timeout=_TIMEOUT_MS)
        # Give lazy charts/maps a beat to paint, then grab the rendered DOM.
        await page.wait_for_timeout(500)
        return await page.content()
    except Exception as exc:  # noqa: BLE001 — timeout/navigation error → fallback
        logger.warning("prerender render failed (%s): %s", url, exc)
        return None
    finally:
        await page.close()


async def get_rendered(lang: str, rest: str, name: str) -> str | None:
    """Return cached prerendered HTML for (lang, rest), or render+cache it.

    Returns None if rendering is unavailable (no browser, timeout) so the
    caller falls back to the meta-injected shell. ``name`` is the resolved
    route name (unused by the self-renderer, but available for a future
    per-route render strategy). Caller must guard unknown/404 routes — only
    call this for known, 200 routes.
    """
    # 404 routes must not be prerendered (and shouldn't reach here).
    if name == "404":
        return None
    cached = _mem_get(lang, rest)
    if cached is not None:
        return cached
    dpath = _disk_path(lang, rest)
    cached = _read_disk(dpath)
    if cached is not None:
        _mem_put(lang, rest, cached)
        return cached

    # Need the FastAPI app state (browser). The running app instance is the
    # module-level FastAPI app defined in web.app, already constructed by the
    # time any request runs.
    from web.app import app
    html = await _render_self(app, lang, rest)
    if html:
        _mem_put(lang, rest, html)
        _write_disk(dpath, html)
    return html