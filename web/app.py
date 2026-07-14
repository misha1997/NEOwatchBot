"""FastAPI application that serves the NEOwatch website and runs the Telegram
bot in the same process.

Why one process: the bot's ``services/*`` modules and MySQL pool are shared
with the site, and a single event loop lets FastAPI and ``python-telegram-bot``
coexist without a second runtime. Uvicorn owns the loop; the bot is started
manually via PTB's async lifecycle (``initialize`` → ``start`` →
``updater.start_polling``) inside the FastAPI lifespan, and torn down in
reverse on shutdown.

Run with::

    uvicorn web.app:app --host 0.0.0.0 --port 8000

If ``BOT_TOKEN`` is unset (local site-only dev) the bot is skipped and only
the site + API are served.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from database import init_db
from web.api import router as api_router
from web.seo import build_robots_txt, build_sitemap_xml, render_html

logger = logging.getLogger(__name__)

# Make scheduler/service INFO logs visible in the journal. Uvicorn's default
# root logger level can be WARNING, which silently hides the scheduler's
# "Checking…/No subscribers/Sent …/Scheduler started" progress lines — leaving
# us blind to why notifications don't go out. Force root (and its handlers) to
# INFO so these reach stdout/journal alongside uvicorn's own logs.
logging.getLogger().setLevel(logging.INFO)
for _h in logging.getLogger().handlers:
    _h.setLevel(logging.INFO)

# React SPA build (production). The SPA is the only served frontend; build it
# first with `npm run build` in my-app/ before starting the server.
REACT_BUILD_DIR = Path(__file__).resolve().parent.parent / "my-app" / "build"


def _build_bot_application():
    """Build the Telegram Application, or return None if no token is configured."""
    token = os.getenv("BOT_TOKEN")
    if not token:
        logger.warning("BOT_TOKEN not set — running site without the Telegram bot.")
        return None

    # Imported lazily so the site can boot without telegram deps in the env.
    from telegram.ext import Application

    from handlers import CommandHandlers, CallbackHandlers, MessageHandlers
    from telegram import Update
    from telegram.ext import (
        CallbackQueryHandler, CommandHandler, MessageHandler, filters,
    )
    from services.scheduler import NotificationScheduler

    async def post_init(application):
        scheduler = NotificationScheduler()
        application.create_task(scheduler.run_scheduled_tasks())
        logger.info("Scheduler started")

    application = (
        Application.builder()
        .token(token)
        .post_init(post_init)
        .build()
    )
    application.add_handler(CommandHandler("start", CommandHandlers.start))
    application.add_handler(CommandHandler("help", CommandHandlers.help))
    application.add_handler(CommandHandler("fact", CommandHandlers.fact))
    application.add_handler(CallbackQueryHandler(CallbackHandlers.handle))
    application.add_handler(MessageHandler(filters.LOCATION, MessageHandlers.handle_location))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, MessageHandlers.handle)
    )
    return application


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the bot alongside the site, then shut both down cleanly.

    The public dashboard endpoints (weather, sky, launches …) don't touch the
    database, so a DB failure must not take the whole site down: we log it and
    skip the bot (which is useless without its tables) but keep serving the
    site and API.
    """
    db_ok = False
    try:
        init_db()
        db_ok = True
        logger.info("Database initialized")
    except Exception as exc:  # noqa: BLE001 — boot must not crash the site
        logger.error("Database init failed, running site without bot: %s", exc)

    ptb = None
    if db_ok:
        ptb = _build_bot_application()
        if ptb is not None:
            from telegram import Update
            try:
                await ptb.initialize()
                await ptb.start()
                await ptb.updater.start_polling(allowed_updates=Update.ALL_TYPES)
                logger.info("Telegram bot polling started")
                app.state.bot = ptb
            except Exception as exc:  # noqa: BLE001
                logger.error("Bot startup failed, continuing site-only: %s", exc)
                ptb = None

    try:
        yield
    finally:
        if ptb is not None:
            await ptb.updater.stop()
            await ptb.stop()
            await ptb.shutdown()
            logger.info("Telegram bot stopped")


app = FastAPI(title="NEOwatch", lifespan=lifespan)
app.include_router(api_router)


@app.middleware("http")
async def _no_cache_api(request, call_next):
    """Keep /api/* responses fresh — the live map and dashboard must not show
    stale JSON from the browser disk cache (e.g. after a server-side color or
    data change). Static site files are still cacheable."""
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, max-age=0"
    return response

# Static site: serve the React SPA build with a SPA fallback (any unknown path
# returns index.html so client-side routing works). The build must exist —
# run `npm run build` in my-app/ before starting the server.
if not (REACT_BUILD_DIR.is_dir() and (REACT_BUILD_DIR / "index.html").exists()):
    raise RuntimeError(
        f"React build not found at {REACT_BUILD_DIR}. "
        "Run `npm run build` in my-app/ first."
    )

_SPA_INDEX = REACT_BUILD_DIR / "index.html"
_SPA_STATIC = REACT_BUILD_DIR / "static"
if _SPA_STATIC.is_dir():
    app.mount("/static", StaticFiles(directory=_SPA_STATIC), name="react-static")

# Locally-mirrored APOD images (data/apod/YYYY/MM/DD-<full|thumb>.<ext>),
# populated by the scheduler's poll_apod_archive + the one-shot backfill.
# Served at /apod-img/<rel> so the gallery loads cards from our own server
# instead of hotlinking apod.nasa.gov. Created on demand; the dir may not
# exist on a fresh deploy until the first APOD ingest runs.
_APOD_IMG_DIR = Path(__file__).resolve().parent.parent / "data" / "apod"
_APOD_IMG_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/apod-img", StaticFiles(directory=_APOD_IMG_DIR), name="apod-img")


def _spa_html(full_path: str, lang: str) -> HTMLResponse:
    """Serve the SPA shell with per-route SEO meta injected server-side.

    Crawlers that don't run JavaScript (FB/Twitter/Telegram scrapers, Bing) get
    a correct, unique <title>/description/canonical/OG/JSON-LD for the requested
    URL instead of the homepage's. See web/seo.py.
    """
    body = render_html(_SPA_INDEX.read_text(encoding="utf-8"), full_path, lang)
    return HTMLResponse(content=body, headers={"Cache-Control": "public, max-age=300"})


@app.get("/sitemap.xml", include_in_schema=False)
async def _sitemap():
    return Response(build_sitemap_xml(), media_type="application/xml; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


@app.get("/robots.txt", include_in_schema=False)
async def _robots():
    return Response(build_robots_txt(), media_type="text/plain; charset=utf-8",
                    headers={"Cache-Control": "public, max-age=3600"})


@app.get("/{full_path:path}")
async def _spa(full_path: str, lang: str = Query("uk", pattern="uk|en")):
    """Serve a built asset if it exists, else the SPA shell (client route).

    Route requests (no matching file) get server-injected per-route meta for
    non-JS crawlers; the client still hydrates and takes over navigation.
    """
    if full_path:
        target = (REACT_BUILD_DIR / full_path).resolve()
        try:
            target.relative_to(REACT_BUILD_DIR.resolve())
        except ValueError:
            return _spa_html(full_path, lang)
        if target.is_file():
            return FileResponse(target)
    return _spa_html(full_path, lang)
logger.info("Serving React build from %s", REACT_BUILD_DIR)