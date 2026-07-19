"""Structured data layer for the website.

The bot's ``services/*`` classes return Telegram-formatted text. The site needs
structured JSON, so this module calls the same underlying APIs and reuses the
*internal* helpers that already return raw data (``_get_kp_index``,
``_get_solar_wind``, ``_get_bz_component``, ``_get_kp_forecast_simple`` …)
rather than duplicating fetch logic. All calls are synchronous (the services use
``requests``) and are wrapped in ``asyncio.to_thread`` by the API layer.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta, date

import requests

from services.space_weather import (
    SpaceWeatherAPI,
    NOAA_KP_URL, NOAA_SOLAR_WIND_URL, NOAA_MAG_URL, NOAA_XRAY_URL,
    NOAA_KP_FORECAST, NOAA_AURORA_MAP, XRAY_LONG_BAND,
)
from services.launch_api import LaunchAPI
from services.n2yo_api import N2YOAPI
from services.planets import PlanetsAPI, _EMOJI as PLANET_EMOJI, _az_to_code
from services.moon_mars import MoonMarsAPI
from services.mars_rover import MarsRoverAPI
from services.meteor_shower import MeteorShower
from services.astronomy import (
    get_upcoming_events, get_next_eclipse,
    _CONJUNCTIONS as ASTRO_CONJUNCTIONS, _ECLIPSES as ASTRO_ECLIPSES,
    _is_supermoon, _detect_retrogrades,
)
from services.debris import SpaceDebrisAPI
from services.jupiter import get_jupiter as _build_jupiter
from services.mercury import get_mercury as _build_mercury
from services.grb_alerts import GRBAlertAPI
from services.comets import CometAPI
from services.exoplanets import ExoplanetAPI
from services.nasa_api import NasaAPI
from services.iss_crew import (
    ISSCrewAPI, _country_name as crew_country, _position_name as crew_position,
    _flag_emoji as crew_flag,
)
from parsers import SpaceflightNowParser
from services.voyager import _PROBES as VOYAGER_PROBES, AU_KM, C_KM_S
from utils.i18n import DEFAULT_LANG, t, compass_dir, pick
from utils.translator import Translator
from config import (
    DEFAULT_LAT, DEFAULT_LON,
    NASA_NEO_URL, NASA_API_KEY,
    N2YO_BASE_URL, N2YO_API_KEY, ISS_NORAD_ID,
)
from database import (
    get_city_suggestions, reverse_geocode as db_reverse_geocode,
    get_news_articles, get_news_article, get_news_article_by_slug,
    get_related_news_articles, set_news_article_body, ingest_news_articles,
    get_apod_entries, ingest_apod_entries,
)

from web.cache import get_or_fetch

logger = logging.getLogger(__name__)

# Cache TTLs (seconds). NOAA real-time feeds update every ~1–3 min, but for a
# public dashboard 5 min is plenty and keeps us off their throttle.
WEATHER_TTL = 300
LAUNCHES_TTL = 600        # Launch Library 2: 10 min
ISS_PASSES_TTL = 600      # per location key
SKY_TTL = 600             # sky digest per location band
METEORS_TTL = 3600        # shower calendar — dates change daily
EVENTS_TTL = 3600         # eclipses / conjunctions / weekly digest
MARS_TTL = 3600           # Mars weather (InSight feed is stale; refresh gently)
DEBRIS_TTL = 86400        # curated ESA figures, ~annual
JUPITER_TTL = 3600        # moon catalog is static; live distance refreshes hourly
MERCURY_TTL = 3600        # live distance and elongation updates hourly
GRB_TTL = 1800            # GCN circulars archive
COMETS_TTL = 3600         # curated comet digest; days-to-perihelion updates daily
EXO_TTL = 3600            # exoplanet archive (TAP); new finds trickle in daily

# Ukrainian short compass abbreviations (8-point) for the dashboard, matching
# the template style ("ПнЗ → ПдС"). Collapsed from N2YO's 16-point codes.
_COMPASS_SHORT = {
    "N": "Пн", "NE": "ПнСх", "E": "Сх", "SE": "ПдСх",
    "S": "Пд", "SW": "ПдЗ", "W": "Зх", "NW": "ПнЗ",
}
from utils.i18n import _COMPASS_COLLAPSE  # noqa: E402 — reuse the collapse map


def _compass_short(code: str | None, lang: str = DEFAULT_LANG) -> str:
    if not code:
        return "—"
    code = _COMPASS_COLLAPSE.get(code.upper(), code.upper())
    if code not in _COMPASS_SHORT:
        return code
    return t(f"compass.short.{code}", lang)


import re as _re
_TAG_RE = _re.compile(r"<[^>]+>")


def _strip_tags(s: str | None) -> str:
    """Telegram <b>/<i> tags → plain text for JSON/web."""
    if not s:
        return ""
    return _TAG_RE.sub("", s).strip()


def _weather_raw(lat: float | None, lon: float | None) -> dict:
    """Synchronous fetch — runs inside a worker thread."""
    kp, kp_time = SpaceWeatherAPI._get_kp_index()
    solar = SpaceWeatherAPI._get_solar_wind()
    bz = SpaceWeatherAPI._get_bz_component()
    xray_class, xray_status = SpaceWeatherAPI._get_xray_flux()
    forecast = SpaceWeatherAPI._get_kp_forecast_simple() or {}

    aurora_key = None
    aurora_chance = None
    if lat is not None and kp is not None:
        aurora_key = SpaceWeatherAPI._can_see_aurora_simple(kp, lat)
        # Rough visibility-chance heuristic for the dashboard card.
        aurora_chance = {
            "everywhere": 90,
            "north": 65,
            "maybe_north": 35,
            "not_visible": 8,
        }.get(aurora_key, 10)

    return {
        "kp": round(kp, 1) if kp is not None else None,
        "kp_time": kp_time,
        "g_scale": SpaceWeatherAPI._get_g_scale_short(kp) if kp is not None else None,
        "solar_wind": solar,  # {speed, density, temp} or None
        "bz": round(bz, 1) if bz is not None else None,
        "xray_class": xray_class,
        "xray_status_key": xray_status,
        "forecast": {
            "today": forecast.get("today"),
            "tomorrow": forecast.get("tomorrow"),
            "day_after": forecast.get("day_after"),
        },
        "aurora": {
            "status_key": aurora_key,
            "chance_pct": aurora_chance,
        } if aurora_key else None,
        "lang": DEFAULT_LANG,
    }


async def get_space_weather(lat: float | None = None, lon: float | None = None) -> dict:
    """Return structured space-weather payload for the dashboard.

    ``lat``/``lon`` are optional and only affect the aurora-visibility estimate.
    Cached under a key that includes the rounded latitude band so different
    regions don't shadow each other.
    """
    band = round(lat) if lat is not None else "global"
    key = f"weather:{band}"
    return await asyncio.to_thread(
        get_or_fetch, key, WEATHER_TTL, lambda: _weather_raw(lat, lon)
    )


def _iso_to_ms(time_tag: str) -> int | None:
    """NOAA ``time_tag`` ("2026-07-04T12:00:00Z") → epoch ms (UTC)."""
    if not time_tag:
        return None
    try:
        return int(datetime.fromisoformat(time_tag.replace("Z", "+00:00")).timestamp() * 1000)
    except Exception:
        return None


def _weather_series_raw() -> dict:
    """Time-series for the space-weather page charts.

    Reuses the same NOAA SWPC feeds the bot already polls but returns full
    arrays (the bot's helpers only surface the latest reading). Arrays are
    ``[epoch_ms, value]`` pairs, oldest-first, sized for charting.
    """
    def _get(url):
        try:
            r = requests.get(url, timeout=10)
            return r.json() if r.ok else None
        except Exception as e:
            logger.warning("weather series %s: %s", url, e)
            return None

    def kp_history():
        d = _get(NOAA_KP_URL) or []
        out = []
        for rec in d:
            ms = _iso_to_ms(rec.get("time_tag"))
            kp = rec.get("Kp")
            if ms is None or kp is None:
                continue
            out.append([ms, float(kp)])
        return out

    def kp_forecast():
        d = _get(NOAA_KP_FORECAST) or []
        out = []
        for rec in d:
            ms = _iso_to_ms(rec.get("time_tag"))
            kp = rec.get("kp")
            if ms is None or kp is None:
                continue
            out.append([ms, float(kp), bool(rec.get("observed"))])
        return out

    def solar_wind():
        # rtsw_wind_1m is newest-first; take the last ~4h and flip oldest-first.
        d = _get(NOAA_SOLAR_WIND_URL) or []
        out = []
        for rec in reversed(d[:240]):
            ms = _iso_to_ms(rec.get("time_tag"))
            sp = rec.get("proton_speed")
            if ms is None or sp is None:
                continue
            out.append([ms, float(sp)])
        return out

    def bz():
        d = _get(NOAA_MAG_URL) or []
        out = []
        for rec in reversed(d[:240]):
            ms = _iso_to_ms(rec.get("time_tag"))
            bz = rec.get("bz_gsm")
            if ms is None or bz is None:
                continue
            out.append([ms, float(bz)])
        return out

    def xray():
        d = _get(NOAA_XRAY_URL) or []
        out = []
        for rec in d:
            if rec.get("energy") != XRAY_LONG_BAND:
                continue
            ms = _iso_to_ms(rec.get("time_tag"))
            flux = rec.get("flux")
            if ms is None or flux is None:
                continue
            out.append([ms, float(flux)])
        return out

    return {
        "kp_history": kp_history(),
        "kp_forecast": kp_forecast(),
        "solar_wind": solar_wind(),
        "bz": bz(),
        "xray": xray(),
        "aurora_map": NOAA_AURORA_MAP,
    }


async def get_weather_series() -> dict:
    """Chart time-series for the space-weather page (cached 5 min)."""
    return await asyncio.to_thread(get_or_fetch, "weather:series", WEATHER_TTL, _weather_series_raw)


# ---------------------------------------------------------------------------
# Rocket launches
# ---------------------------------------------------------------------------

# Launch Library 2 status id → short dashboard pill label/class. The bot maps
# these to localized sentences; the site just needs a compact Go/TBD/etc tag.
_LAUNCH_STATUS = {
    1: ("Go", "gold"),
    2: ("TBD", ""),
    3: ("Success", "teal"),
    4: ("Failure", "coral"),
    5: ("Hold", ""),
    6: ("In flight", "gold"),
    7: ("Partial", ""),
    8: ("Scrubs", "coral"),
}


def _launch_row(launch: dict) -> dict:
    name = launch.get("name") or "—"
    rocket = (launch.get("rocket") or {}).get("configuration", {}).get("name") or "—"
    lsp = launch.get("lsp_name") or (launch.get("launch_service_provider") or {}).get("name") or "—"
    pad = launch.get("pad") or {}
    pad_name = pad.get("name") or ""
    location = (pad.get("location") or {}).get("name") or "—"
    if pad_name and pad_name != "Unknown Pad":
        location = f"{pad_name}, {location}"
    net = launch.get("net") or ""
    date_local = "TBD"
    net_ts = None
    if net:
        try:
            dt = datetime.fromisoformat(net.replace("Z", "+00:00"))
            net_ts = int(dt.timestamp())
            # Show UTC consistently; the template already says "час — місцевий".
            date_local = dt.strftime("%d.%m · %H:%M UTC")
        except Exception:
            date_local = net[:16]
    status_id = (launch.get("status") or {}).get("id", 0)
    label, cls = _LAUNCH_STATUS.get(status_id, ("TBD", ""))

    # Webcast link (Launch Library 2.3.0). The list endpoint returns `vid_urls`
    # (snake_case) — a list of {url, title, type, source, priority}. Pick the
    # most watchable one: prefer an Official Webcast, then any YouTube URL, then
    # the first entry. `vidURLs`/`vidURL` (camelCase) are kept as a legacy
    # fallback. When no webcast is attached, fall back to a YouTube search for
    # the launch name so the link is still useful (the raw API `url` is not).
    webcast = ""
    vid_urls = launch.get("vid_urls") or launch.get("vidURLs") or []
    if vid_urls and isinstance(vid_urls, list):
        def pick(v):
            return (v or {}).get("url") or ""
        # Official webcast first.
        for v in vid_urls:
            if ((v or {}).get("type") or {}).get("id") == 1 and pick(v):
                webcast = pick(v); break
        # Then any YouTube link.
        if not webcast:
            for v in vid_urls:
                u = pick(v)
                if u and "youtube.com/watch" in u:
                    webcast = u; break
        # Then whatever is first.
        if not webcast:
            webcast = pick(vid_urls[0]) if vid_urls else ""
    if not webcast:
        webcast = launch.get("vidURL") or ""
    url = launch.get("url") or ""
    # Fallback link when there is no webcast: a YouTube search for the mission
    # name (URL-encoded). The card uses this only when `webcast` is empty.
    search = ""
    if not webcast and name and name != "—":
        from urllib.parse import quote
        search = "https://www.youtube.com/results?search_query=" + quote(name + " launch")

    return {
        "date": date_local,
        "name": name,
        "rocket": rocket,
        "lsp": lsp,
        "pad": location,
        "country": (pad.get("location") or {}).get("country_code") or "",
        "status_label": label,
        "status_class": cls,
        "net_ts": net_ts,
        "webcast": webcast,
        "url": url,
        "search": search,
    }


def _launches_raw() -> dict:
    data = LaunchAPI.get_raw_launches()
    if not data or not data.get("results"):
        return {"items": [], "source": "launchlibrary"}
    rows = [_launch_row(l) for l in data["results"][:7]]
    return {"items": rows, "source": "launchlibrary"}


async def get_launches() -> dict:
    """Upcoming rocket launches for the homepage table."""
    return await asyncio.to_thread(get_or_fetch, "launches", LAUNCHES_TTL, _launches_raw)


# ---------------------------------------------------------------------------
# ISS passes
# ---------------------------------------------------------------------------

def _iss_pass_row(p: dict, lang: str = DEFAULT_LANG) -> dict:
    """Map one N2YO visualpasses record to a dashboard card payload."""
    start_utc = datetime.fromtimestamp(p["startUTC"], tz=timezone.utc)
    # Kyiv time for display (the bot uses Europe/Kyiv too).
    try:
        from zoneinfo import ZoneInfo
        local = start_utc.astimezone(ZoneInfo("Europe/Kyiv"))
        when = local.strftime("%d.%m · %H:%M")
    except Exception:
        when = start_utc.strftime("%d.%m · %H:%M UTC")
    return {
        "start": when,
        "start_utc": p.get("startUTC"),
        "max_el": round(p.get("maxEl", 0), 0),
        "duration_sec": p.get("duration", 0),
        "mag": round(p.get("mag", 0), 1) if p.get("mag") is not None else None,
        "from_dir": _compass_short(p.get("startAzCompass"), lang),
        "to_dir": _compass_short(p.get("endAzCompass"), lang),
    }


def _iss_passes_raw(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    data = N2YOAPI.get_iss_passes_raw(lat, lon, alt=0, days=10)
    passes = (data or {}).get("passes") or []
    return {
        "lat": lat, "lon": lon,
        "items": [_iss_pass_row(p, lang) for p in passes[:4]],
    }


async def get_iss_passes(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    """Next ISS visible passes over the observer's location."""
    key = f"iss_passes:{round(lat,2)}:{round(lon,2)}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, ISS_PASSES_TTL, lambda: _iss_passes_raw(lat, lon, lang)
    )


# ---------------------------------------------------------------------------
# Sky digest ("Найцікавіше над містом") — ISS pass + planets + meteor + Moon
# ---------------------------------------------------------------------------

def _planet_row(r: dict, lang: str = DEFAULT_LANG) -> dict:
    return {
        "name_key": r["name_key"],
        "name": t(f"planets.name.{r['name_key']}", lang),
        "emoji": PLANET_EMOJI.get(r["name_key"], "🪐"),
        "alt": int(round(float(r["alt"]), 0)),
        "mag": round(float(r["mag"]), 1) if r["mag"] is not None else None,
        "visible": bool(r["visible"]),
    }


def _sky_raw(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    events: list[dict] = []

    # 1) Next ISS pass
    try:
        pdata = N2YOAPI.get_iss_passes_raw(lat, lon, alt=0, days=10)
        passes = (pdata or {}).get("passes") or []
        if passes:
            p = passes[0]
            row = _iss_pass_row(p, lang)
            events.append({
                "kind": "iss",
                "emoji": "🛰️",
                "title": t("sky.event.iss_pass", lang),
                "time": row["start"].split("· ")[-1] if "· " in row["start"] else row["start"],
                "detail": t("sky.event.max_alt", lang, n=f"{row['max_el']:.0f}",
                            frm=row["from_dir"], to=row["to_dir"]),
            })
    except Exception as e:
        logger.error("sky iss: %s", e)

    # 2) Top visible planet (highest altitude)
    try:
        rows = PlanetsAPI.compute(lat, lon)
        visible = [r for r in rows if r["visible"]]
        if visible:
            best = max(visible, key=lambda r: r["alt"])
            pr = _planet_row(best, lang)
            events.append({
                "kind": "planet",
                "emoji": pr["emoji"],
                "title": pr["name"],
                "time": t("sky.event.altitude", lang, n=f"{pr['alt']:.0f}"),
                "detail": (t("sky.event.planet", lang, mag=pr["mag"])
                           if pr["mag"] is not None
                           else t("sky.event.planet_no_mag", lang)),
            })
    except Exception as e:
        logger.error("sky planets: %s", e)

    # 3) Next meteor shower
    try:
        upcoming = MeteorShower.get_upcoming_showers(limit=1)
        if upcoming:
            s = upcoming[0]
            from utils.i18n import pick
            name = pick(s, "name", lang)
            du = s.get("days_until")
            if du == 0:
                when = t("sky.event.now", lang)
            elif du is not None:
                when = t("sky.event.in_days", lang, n=du)
            else:
                when = ""
            events.append({
                "kind": "meteor",
                "emoji": "☄️",
                "title": name,
                "time": when,
                "detail": t("sky.event.meteor", lang, rate=s.get("rate", "?")),
            })
    except Exception as e:
        logger.error("sky meteor: %s", e)

    # 4) Moon phase (phase_name already carries its emoji from i18n)
    try:
        mp = MoonMarsAPI.get_moon_phase(lang)
        if mp:
            events.append({
                "kind": "moon",
                "emoji": "🌙",
                "title": mp.get("phase_name") or t("sky.event.moon", lang),
                "time": "—",
                "detail": t("sky.event.illumination", lang,
                            pct=f"{mp.get('illumination', 0):.0f}"),
            })
    except Exception as e:
        logger.error("sky moon: %s", e)

    return {"lat": lat, "lon": lon, "events": events}


async def get_sky(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    """Tonight-in-the-sky digest for the homepage event list."""
    key = f"sky:{round(lat,2)}:{round(lon,2)}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, SKY_TTL, lambda: _sky_raw(lat, lon, lang)
    )


# ---------------------------------------------------------------------------
# Near-Earth objects (asteroids)
# ---------------------------------------------------------------------------

NEO_TTL = 1800  # 30 min — NASA NEO feed is daily

# NASA NEO lookup endpoint (per-asteroid orbital elements). The Feed endpoint
# only returns close-approach data; orbital elements (a, e, i, ω, Ω, M, q, Q)
# come from this lookup. 24 h cache — elements barely change between epochs.
NASA_NEO_LOOKUP = "https://api.nasa.gov/neo/rest/v1/neo/"
_ORBIT_TTL = 86400
_ORBIT_CACHE: dict[str, tuple[dict, float]] = {}


def _neo_orbit(neo_id: str) -> dict | None:
    """Orbital elements for one NEO from the lookup endpoint, cached 24 h."""
    if not neo_id:
        return None
    cached = _ORBIT_CACHE.get(neo_id)
    if cached and (time.time() - cached[1]) < _ORBIT_TTL:
        return cached[0]
    try:
        resp = requests.get(
            NASA_NEO_LOOKUP + str(neo_id),
            params={"api_key": NASA_API_KEY},
            timeout=6,
        )
        resp.raise_for_status()
        od = (resp.json() or {}).get("orbital_data", {}) or {}
    except Exception as e:
        logger.warning("NEO orbit lookup failed for %s: %s", neo_id, e)
        return None

    def _f(node, key):
        try:
            return float(node.get(key))
        except (TypeError, ValueError):
            return None

    orbit = {
        "a": _f(od, "semi_major_axis"),
        "e": _f(od, "eccentricity"),
        "i": _f(od, "inclination"),
        "w": _f(od, "perihelion_argument"),
        "om": _f(od, "ascending_node_longitude"),
        "q": _f(od, "perihelion_distance"),
        "Q": _f(od, "aphelion_distance"),
        "ma": _f(od, "mean_anomaly"),
        "period": _f(od, "orbital_period"),
        "epoch": _f(od, "epoch_osculation"),
        "class": ((od.get("orbit_class") or {}).get("orbit_class_type") or None),
    }
    if orbit["a"] is None or orbit["e"] is None:
        return None
    _ORBIT_CACHE[neo_id] = (orbit, time.time())
    return orbit


def _neo_row(neo: dict, lang: str = DEFAULT_LANG) -> dict:
    diam = neo.get("estimated_diameter", {}).get("meters", {})
    d_min = int(diam.get("estimated_diameter_min", 0) or 0)
    d_max = int(diam.get("estimated_diameter_max", 0) or 0)
    cad = (neo.get("close_approach_data") or [{}])[0]
    ld = cad.get("miss_distance", {}).get("lunar")
    vel = cad.get("relative_velocity", {}).get("kilometers_per_second")
    approach_date = cad.get("close_approach_date", "—")
    try:
        dt = datetime.strptime(approach_date[:10], "%Y-%m-%d")
        approach_label = t("neo.approach", lang, date=dt.strftime("%d.%m"))
    except Exception:
        approach_label = t("neo.approach", lang, date=approach_date[:10])
    hazardous = bool(neo.get("is_potentially_hazardous_asteroid"))
    return {
        "id": neo.get("id") or neo.get("neo_reference_id"),
        "name": neo.get("name", "—"),
        "approach": approach_label,
        "diameter_min": d_min,
        "diameter_max": d_max,
        "distance_ld": round(float(ld), 2) if ld is not None else None,
        "velocity_kms": round(float(vel), 1) if vel is not None else None,
        "hazardous": hazardous,
    }


def _neo_raw(lang: str = DEFAULT_LANG) -> dict:
    today = datetime.now()
    params = {
        "start_date": today.strftime("%Y-%m-%d"),
        "end_date": (today + timedelta(days=6)).strftime("%Y-%m-%d"),
        "api_key": NASA_API_KEY,
    }
    try:
        resp = requests.get(NASA_NEO_URL, params=params, timeout=12)
        data = resp.json()
    except Exception as e:
        logger.error("NEO feed error: %s", e)
        return {"items": [], "hazardous_count": 0}

    neos = data.get("near_earth_objects", {})
    flat = []
    for date_str, entries in neos.items():
        for neo in entries:
            cad = neo.get("close_approach_data") or []
            if not cad:
                continue
            # only approaches in the next 14 days
            try:
                ad = datetime.strptime(cad[0].get("close_approach_date", "")[:10], "%Y-%m-%d")
                if (ad - today).days > 14 or (ad - today).days < 0:
                    continue
            except Exception:
                pass
            flat.append(_neo_row(neo, lang))
    flat.sort(key=lambda r: r["distance_ld"] if r["distance_ld"] is not None else 999)
    items = flat[:8]
    # Fetch orbital elements for the shown asteroids concurrently (best-effort).
    # The page degrades gracefully without them — the existing LD radar + cards
    # still render; only the heliocentric orbit map is omitted.
    ids = [r.get("id") for r in items]
    if ids:
        with ThreadPoolExecutor(max_workers=min(8, len(ids))) as ex:
            orbits = dict(zip(ids, ex.map(_neo_orbit, ids)))
        for r in items:
            r["orbit"] = orbits.get(r.get("id"))
    return {
        "items": items,
        "total": len(flat),
        "hazardous_count": sum(1 for r in flat if r["hazardous"]),
    }


async def get_neo(lang: str = DEFAULT_LANG) -> dict:
    """Upcoming asteroid close approaches (NASA NEO feed, 7-day window)."""
    return await asyncio.to_thread(get_or_fetch, f"neo:{lang}", NEO_TTL, lambda: _neo_raw(lang))


# ---------------------------------------------------------------------------
# ISS — current position + crew
# ---------------------------------------------------------------------------

ISS_NOW_TTL = 120   # 2 min
CREW_TTL = 3600     # 1 h


def _iss_now_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        url = f"{N2YO_BASE_URL}/positions/{ISS_NORAD_ID}/0/0/0/1"
        resp = requests.get(url, params={"apiKey": N2YO_API_KEY}, timeout=10)
        data = resp.json()
        pos = (data or {}).get("positions") or []
        if not pos:
            return {}
        p = pos[0]
        lat = p.get("satlatitude")
        lon = p.get("satlongitude")
        alt = p.get("sataltitude")
        country = ""
        try:
            country = N2YOAPI._get_country_from_coords(lat, lon, lang)
        except Exception:
            pass
        return {
            "lat": round(lat, 4) if lat is not None else None,
            "lon": round(lon, 4) if lon is not None else None,
            "alt": round(alt, 1) if alt is not None else None,
            "country": country,
            "timestamp": p.get("timestamp"),
        }
    except Exception as e:
        logger.error("iss now error: %s", e)
        return {}


async def get_iss_now(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"iss_now:{lang}", ISS_NOW_TTL, lambda: _iss_now_raw(lang))


def _crew_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        data = ISSCrewAPI.get_iss_crew()
        if not data:
            return {}
        crew = []
        for c in (data.get("crew") or []):
            flag_code = c.get("flag_code") or ""
            crew.append({
                "name": c.get("name"),
                "country": crew_country(c.get("country") or "", lang),
                "position": crew_position(
                    c.get("position") or c.get("title") or "", lang),
                "agency": c.get("agency"),
                "days_in_space": c.get("days_in_space"),
                "spacecraft": c.get("spacecraft"),
                "flag_code": flag_code,
                "flag": crew_flag(flag_code),
            })
        # Group crew by spacecraft so the frontend can render the same
        # "🚀 Soyuz / 🚀 Crew Dragon" blocks the bot produces.
        by_craft = {}
        for person in crew:
            craft = person.get("spacecraft") or ""
            by_craft.setdefault(craft, []).append(person)
        return {
            # ``number`` from corquaid is total humans in space; the ISS page
            # card "crew on board" wants the ISS crew count.
            "count": len(crew),
            "total_in_space": data.get("number") or len(crew),
            "expedition": data.get("expedition"),
            "expedition_patch": data.get("expedition_patch") or data.get("expedition_image"),
            "expedition_url": data.get("expedition_url"),
            "expedition_start_date": data.get("expedition_start_date"),
            "crew": crew,
            "by_spacecraft": by_craft,
        }
    except Exception as e:
        logger.error("iss crew error: %s", e)
        return {}


async def get_iss_crew(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, f"iss_crew:{lang}", CREW_TTL, lambda: _crew_raw(lang))


# ---------------------------------------------------------------------------
# Voyager 1 / 2 — propagated distances
# ---------------------------------------------------------------------------

VOYAGER_TTL = 3600


def _voyager_probe(idx: int) -> dict:
    p = VOYAGER_PROBES[idx]
    seconds = (datetime.now(tz=timezone.utc) - p["epoch"]).total_seconds()
    helio_km = p["dist_km"] + p["velocity_km_s"] * seconds
    au = helio_km / AU_KM
    light_hours = helio_km / C_KM_S / 3600.0
    au_per_year = p["velocity_km_s"] * 365.25 * 86400 / AU_KM
    return {
        "au": round(au, 1),
        "km": int(helio_km),
        "speed_kms": p["velocity_km_s"],
        "light_hours": round(light_hours, 1),
        "au_per_year": round(au_per_year, 1),
        "interstellar_date": p["interstellar_date"],
    }


def _voyager_raw() -> dict:
    return {"1": _voyager_probe(1), "2": _voyager_probe(2)}


async def get_voyager() -> dict:
    return await asyncio.to_thread(get_or_fetch, "voyager", VOYAGER_TTL, _voyager_raw)


# ---------------------------------------------------------------------------
# Planets (full table) + standalone Moon phase — for sky.html
# ---------------------------------------------------------------------------

def _planets_raw(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    try:
        rows = PlanetsAPI.compute(lat, lon)
    except Exception as e:
        logger.error("planets compute: %s", e)
        return {"items": []}
    items = []
    for r in rows:
        az_code = _az_to_code(r["az"])
        items.append({
            "name_key": r["name_key"],
            "name": t(f"planets.name.{r['name_key']}", lang),
            "emoji": PLANET_EMOJI.get(r["name_key"], "🪐"),
            "alt": int(round(float(r["alt"]), 0)),
            "az": round(float(r["az"]), 1),
            "az_dir": compass_dir(az_code, lang),
            "az_short": _compass_short(az_code, lang),
            "mag": round(float(r["mag"]), 1) if r["mag"] is not None else None,
            "visible": bool(r["visible"]),
        })
    # visible first, then by altitude descending
    items.sort(key=lambda x: (not x["visible"], -x["alt"]))

    out = {"items": items}

    # Sun & Moon as separate top-level fields (not in `items`, so the
    # /sky planets table is unchanged) — consumed by the homepage sky-dome.
    try:
        sm = PlanetsAPI.compute_sun_moon(lat, lon)
    except Exception as e:
        logger.error("sun/moon compute: %s", e)
        sm = None
    if sm:
        sun, moon = sm["sun"], sm["moon"]
        out["sun"] = {
            "name_key": "sun",
            "name": t("planets.name.sun", lang),
            "emoji": "☀️",
            "alt": int(round(float(sun["alt"]), 0)),
            "az": round(float(sun["az"]), 1),
            "visible": bool(sun["alt"] > 0.0),
        }
        out["moon"] = {
            "name_key": "moon",
            "name": t("planets.name.moon", lang),
            "emoji": "🌙",
            "alt": int(round(float(moon["alt"]), 0)),
            "az": round(float(moon["az"]), 1),
            "visible": bool(moon["alt"] > 0.0),
            "phase": round(float(moon["phase"]), 3),
            "illum": round(float(moon["illum"]), 2),
        }
    return out


async def get_planets(lat: float, lon: float, lang: str = DEFAULT_LANG) -> dict:
    key = f"planets:{round(lat,1)}:{round(lon,1)}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, SKY_TTL, lambda: _planets_raw(lat, lon, lang)
    )


def _moon_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        return MoonMarsAPI.get_moon_phase(lang) or {}
    except Exception as e:
        logger.error("moon: %s", e)
        return {}


async def get_moon(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"moon:{lang}", 900, lambda: _moon_raw(lang))


# ---------------------------------------------------------------------------
# Geocoding (Nominatim proxy) for the location picker
# ---------------------------------------------------------------------------

async def geocode(q: str) -> list:
    """City suggestions via the bot's existing Nominatim helper."""
    q = (q or "").strip()
    if len(q) < 2:
        return []
    return await asyncio.to_thread(get_city_suggestions, q, DEFAULT_LANG, 6)


async def reverse_geocode(lat: float, lon: float) -> dict:
    """Reverse-geocode lat/lon to a place label for the location auto-detect."""
    try:
        res = await asyncio.to_thread(db_reverse_geocode, lat, lon, DEFAULT_LANG)
    except Exception as e:
        logger.error("reverse geocode: %s", e)
        res = None
    if not res:
        # Fall back to a bare coordinate label so the site still works without
        # a place name (Nominatim rate-limits or offline).
        return {"short_name": None, "country": None, "lat": lat, "lon": lon,
                "label": f"{lat:.2f}°, {lon:.2f}°"}
    short_name, _display, country = res
    label = short_name + (", " + country if country else "")
    return {"short_name": short_name, "country": country,
            "lat": lat, "lon": lon, "label": label}


async def ip_geocode(ip: str) -> dict | None:
    """Approximate location from the client IP (fallback when the browser
    geolocation API is unavailable, denied, or times out). Uses ip-api.com
    (free, no key; HTTP-only on the free tier, which is fine server→server).
    Returns {lat, lon, label, source:"ip"} or None on any failure (reserved
    ranges like 127.0.0.1, rate limits, network errors)."""
    if not ip:
        return None
    # Strip any IPv6 mapping prefix like "::ffff:" and take the first of a list.
    ip = ip.split(",")[0].strip()
    if ip.startswith("::ffff:"):
        ip = ip[7:]
    if not ip or ip.startswith(("127.", "10.", "192.168.", "169.254.")) or ip == "::1":
        # Loopback / private → ip-api would return a "reserved range" fail, so
        # don't even ask. Lets local dev fail fast instead of hitting the API.
        return None
    try:
        resp = await asyncio.to_thread(
            requests.get,
            "http://ip-api.com/json/" + ip,
            params={"fields": "status,message,lat,lon,city,regionName,country,countryCode"},
            timeout=8,
        )
    except Exception as e:
        logger.warning("ip geocode: %s", e)
        return None
    if resp.status_code != 200:
        return None
    try:
        d = resp.json()
    except Exception:
        return None
    if d.get("status") != "success" or d.get("lat") is None:
        return None
    label_parts = [p for p in (d.get("city"), d.get("country")) if p]
    label = ", ".join(label_parts) if label_parts else f"{d['lat']:.2f}°, {d['lon']:.2f}°"
    return {"lat": float(d["lat"]), "lon": float(d["lon"]), "label": label, "source": "ip"}


# ---------------------------------------------------------------------------
# Satellite TLEs (Celestrak) — for the live interactive map
# ---------------------------------------------------------------------------
# satellite.js propagates TLEs client-side, so the backend only needs to hand
# the browser the two TLE lines per object. Celestrak's `FORMAT=3le` gives us
# exactly that in plain text; we parse it once and cache for an hour (TLEs stay
# valid for hours, and Celestrak updates every ~6h).

TLE_TTL = 3600
CELESTAK_URL = "https://celestrak.org/NORAD/elements/gp.php"
CELESTAK_SUP_URL = "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php"

# Last-good TLE payload per cache key, kept beyond the TTL so we can survive
# Celestrak's 403 "not updated since your last download" throttle: they expect
# clients to cache and refuse to re-send unchanged data. On 403 (or any fetch
# error) we serve the stashed copy instead of an empty map. The stash is also
# persisted to ``data/tle_stash/`` so a server restart doesn't blank the map
# while Celestrak's per-group 2-hour window is still closed.
_TLE_CACHE: dict[str, tuple[float, dict]] = {}
_TLE_STASH: dict[str, dict] = {}
_TLE_STASH_DIR = os.path.join("data", "tle_stash")


class _NotModified(Exception):
    """Celestrak 403 — data unchanged since last successful download."""

# Friendly group key → Celestrak query + display metadata. `catnr` fetches a
# single object by NORAD id; `group` fetches a Celestrak group; `file` fetches
# a supplemental set via sup-gp.php (used for Starlink, whose main GROUP feed
# is heavily throttled — the supplemental endpoint is not).
TLE_GROUPS = {
    # Each group gets a distinct color so its markers are distinguishable on
    # the map and in the chip bar. Hues are spread around the wheel (≈30–80°
    # apart) at similar lightness so close pairs don't blur together on the
    # dark background: gold, violet, teal, white, sky-blue, coral, pink,
    # lime, green.
    "iss":       {"label": "МКС", "label_en": "ISS",
                  "color": "#E8B94D", "icon": "🛰️", "catnr": 25544},
    "stations":  {"label": "Орбітальні станції", "label_en": "Space stations",
                  "color": "#8B7CF6", "icon": "🛰️", "group": "stations"},
    "starlink":  {"label": "Starlink", "label_en": "Starlink",
                  "color": "#2DD4BF", "icon": "✦",  "file": "starlink"},
    "visual":    {"label": "Яскраві супутники", "label_en": "Bright satellites",
                  "color": "#FFFFFF", "icon": "✨", "group": "visual"},
    "weather":   {"label": "Метеосупутники", "label_en": "Weather satellites",
                  "color": "#38BDF8", "icon": "🌧️", "group": "weather"},
    "goes":      {"label": "GOES", "label_en": "GOES",
                  "color": "#FF6B4A", "icon": "🌍", "group": "goes"},
    "gps":       {"label": "GPS", "label_en": "GPS",
                  "color": "#EC4899", "icon": "📡", "group": "gps-ops"},
    "geo":       {"label": "Геостаціонарні", "label_en": "Geostationary",
                  "color": "#A3E635", "icon": "🌐", "group": "geo"},
    "amateur":   {"label": "Радіоаматорські", "label_en": "Amateur radio",
                  "color": "#22C55E", "icon": "📡", "group": "amateur"},
}


def _parse_3le(text: str) -> list:
    """Parse Celestrak 3-line TLE text into [{name, norad_id, tle1, tle2}]."""
    out = []
    lines = [ln.rstrip("\r") for ln in text.splitlines() if ln.strip()]
    i = 0
    while i < len(lines) - 2:
        name = lines[i]
        tle1 = lines[i + 1]
        tle2 = lines[i + 2]
        if tle1.startswith("1 ") and tle2.startswith("2 "):
            try:
                norad_id = int(tle1[2:7])
            except Exception:
                norad_id = 0
            out.append({
                "name": name.strip(),
                "norad_id": norad_id,
                "tle1": tle1,
                "tle2": tle2,
            })
            i += 3
        else:
            i += 1
    return out


def _tle_raw(group_key: str, limit: int) -> dict:
    spec = TLE_GROUPS.get(group_key)
    if not spec:
        return {"group": group_key, "label": group_key, "color": "#E8B94D",
                "icon": "🛰️", "items": [], "total": 0, "shown": 0}
    params = {"FORMAT": "3le"}
    if "catnr" in spec:
        params["CATNR"] = spec["catnr"]
        url = CELESTAK_URL
    elif "file" in spec:
        params["FILE"] = spec["file"]
        url = CELESTAK_SUP_URL
    else:
        params["GROUP"] = spec["group"]
        url = CELESTAK_URL
    resp = requests.get(url, params=params, timeout=25,
                        headers={"User-Agent": "NEOwatch/1.0"})
    if resp.status_code == 403:
        # Celestrak throttle: data unchanged since last download.
        raise _NotModified()
    resp.raise_for_status()
    items = _parse_3le(resp.text)
    total = len(items)
    if limit and total > limit:
        items = items[:limit]
    return {
        "group": group_key,
        "label": spec["label"],
        "color": spec["color"],
        "icon": spec["icon"],
        "items": items,
        "total": total,
        "shown": len(items),
    }


def _stash_path(key: str) -> str:
    safe = key.replace(":", "_").replace("/", "_")
    return os.path.join(_TLE_STASH_DIR, safe + ".json")


def _stash_save(key: str, payload: dict) -> None:
    try:
        os.makedirs(_TLE_STASH_DIR, exist_ok=True)
        with open(_stash_path(key), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)
    except Exception as e:
        logger.warning("TLE stash save %s: %s", key, e)


def _stash_load(key: str) -> dict | None:
    try:
        p = _stash_path(key)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logger.warning("TLE stash load %s: %s", key, e)
    return None


async def get_tle(group: str, limit: int = 300, lang: str = DEFAULT_LANG) -> dict:
    """Cached TLE set for a satellite group (Celestrak).

    On Celestrak's 403 "not modified" or a fetch error, falls back to the last
    good payload (kept in ``_TLE_STASH``) so the map never goes empty between
    Celestrak data updates. The TLE data itself is language-independent, so the
    cache is keyed without ``lang``; only the display ``label`` is localized at
    return time.
    """
    import time
    key = f"tle:{group}:{limit}"
    now = time.monotonic()
    spec = TLE_GROUPS.get(group, {})
    label = pick(spec, "label", lang) if spec else group

    def _with_label(p: dict) -> dict:
        p = dict(p)
        p["label"] = label
        return p

    entry = _TLE_CACHE.get(key)
    if entry and entry[0] > now:
        return _with_label(entry[1])

    empty = {"group": group, "label": label,
             "color": spec.get("color", "#E8B94D"), "icon": spec.get("icon", "🛰️"),
             "items": [], "total": 0, "shown": 0}

    try:
        payload = await asyncio.to_thread(_tle_raw, group, limit)
    except _NotModified:
        stash = _TLE_STASH.get(key) or _stash_load(key)
        if stash:
            _TLE_STASH[key] = stash
            _TLE_CACHE[key] = (now + TLE_TTL, stash)
            return _with_label(stash)
        return empty
    except Exception as e:
        logger.error("TLE fetch %s: %s", group, e)
        stash = _TLE_STASH.get(key) or _stash_load(key)
        if stash:
            _TLE_STASH[key] = stash
            _TLE_CACHE[key] = (now + 300, stash)  # short retry window
            return _with_label(stash)
        return empty

    if payload.get("items"):
        _TLE_STASH[key] = payload
        _stash_save(key, payload)
        _TLE_CACHE[key] = (now + TLE_TTL, payload)
    else:
        # Empty (e.g. parse got nothing) — keep stash if any, else cache short.
        stash = _TLE_STASH.get(key) or _stash_load(key)
        if stash:
            payload = stash
            _TLE_STASH[key] = stash
            _TLE_CACHE[key] = (now + TLE_TTL, stash)
        else:
            _TLE_CACHE[key] = (now + 300, payload)
    return _with_label(payload)


def tle_groups(lang: str = DEFAULT_LANG) -> list:
    """Group registry for the map UI (key, label, color, icon)."""
    return [
        {"key": k, "label": pick(v, "label", lang), "color": v["color"], "icon": v["icon"]}
        for k, v in TLE_GROUPS.items()
    ]


# ---------------------------------------------------------------------------
# Meteor showers — full calendar for meteors.html
# ---------------------------------------------------------------------------

def _shower_status(shower, lang: str = DEFAULT_LANG) -> tuple[str, str]:
    """(status_text, status_key) for a shower dict carrying peak_datetime."""
    status, key = MeteorShower.get_shower_status(shower, lang)
    return status, key


def _meteors_raw(lang: str = DEFAULT_LANG) -> dict:
    now = datetime.now()
    items = []
    for s in MeteorShower.get_upcoming_showers(limit=20):
        pdt = s.get("peak_datetime")
        status, status_key = _shower_status(s, lang)
        from utils.i18n import pick
        items.append({
            "name": pick(s, "name", lang),
            "name_en": s.get("name_en", s["name"]),
            "peak": pdt.strftime("%d.%m.%Y") if pdt else None,
            "days_until": s.get("days_until"),
            "rate": s.get("rate"),
            "start": "%02d.%02d" % (s["start"][0], s["start"][1]),
            "end": "%02d.%02d" % (s["end"][0], s["end"][1]),
            "best_time": pick(s, "best_time", lang),
            "direction": pick(s, "direction", lang),
            "description": pick(s, "description", lang),
            "status": _strip_tags(status),
            "status_key": status_key,
            "active": status_key in ("fire", "active"),
        })
    items.sort(key=lambda x: (x["days_until"] if x["days_until"] is not None else 999))
    return {"items": items, "now": now.strftime("%d.%m.%Y")}


async def get_meteors(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"meteors:{lang}", METEORS_TTL, lambda: _meteors_raw(lang))


# ---------------------------------------------------------------------------
# Astronomical events — eclipses, conjunctions, supermoon, retrogrades
# ---------------------------------------------------------------------------

def _weekly_structured(now: datetime, lang: str = DEFAULT_LANG) -> list:
    """Structured 'this week in the sky' digest (next 7 days).

    Reuses the same internal pieces as astronomy.get_weekly_calendar but
    returns a list of plain dicts for JSON instead of Telegram text.
    """
    items: list[dict] = []

    # Eclipses within 7 days
    for e in ASTRO_ECLIPSES:
        dt = datetime(*e["date"])
        d = (dt - now).days
        if 0 <= d <= 7:
            items.append({"date": dt.strftime("%d.%m.%Y"), "days": d,
                          "type": "eclipse", "icon": "🌑",
                          "text": e["name"]})

    # Conjunctions within 7 days
    for c in ASTRO_CONJUNCTIONS:
        dt = datetime(*c["date"])
        d = (dt - now).days
        if 0 <= d <= 7:
            items.append({"date": dt.strftime("%d.%m"), "days": d,
                          "type": "conjunction", "icon": "✨",
                          "text": t("sky.weekly.conjunction", lang,
                                    bodies=c["bodies"], sep=c["separation"])})

    # Meteor-shower maxima within 7 days
    try:
        for s in MeteorShower.get_upcoming_showers(limit=15):
            du = s.get("days_until")
            if du is None or not (0 <= du <= 7):
                continue
            pdt = s.get("peak_datetime") or (now + timedelta(days=du))
            from utils.i18n import pick
            items.append({"date": pdt.strftime("%d.%m"), "days": int(du),
                          "type": "meteor", "icon": "☄️",
                          "text": t("sky.weekly.meteor_peak", lang,
                                    name=pick(s, "name", lang),
                                    rate=s.get("rate", "?"))})
    except Exception as e:
        logger.error("weekly meteor: %s", e)

    # Moon phases + supermoon within 7 days
    try:
        mp = MoonMarsAPI.get_moon_phase(lang)
        if mp:
            dtf = now + timedelta(days=mp["days_to_full"])
            if 0 <= mp["days_to_full"] <= 7:
                supermoon = _is_supermoon(dtf)
                items.append({"date": dtf.strftime("%d.%m"), "days": int(mp["days_to_full"]),
                              "type": "full_moon", "icon": "🌕",
                              "text": t("sky.weekly.supermoon" if supermoon else "sky.weekly.full_moon", lang)})
            dtn = now + timedelta(days=mp["days_to_new"])
            if 0 <= mp["days_to_new"] <= 7:
                items.append({"date": dtn.strftime("%d.%m"), "days": int(mp["days_to_new"]),
                              "type": "new_moon", "icon": "🌑",
                              "text": t("sky.weekly.new_moon", lang)})
    except Exception as e:
        logger.error("weekly moon: %s", e)

    # Planet retrograde stations (skyfield)
    try:
        for rdt, _order, key, params in _detect_retrogrades(now, lang):
            items.append({"date": rdt.strftime("%d.%m"), "days": (rdt - now).days,
                          "type": "retrograde", "icon": "↩️",
                          "text": _strip_tags(t(key, lang, **params))})
    except Exception as e:
        logger.error("weekly retrograde: %s", e)

    items.sort(key=lambda x: x["days"])
    return items


def _events_raw(lang: str = DEFAULT_LANG) -> dict:
    now = datetime.now()
    events = get_upcoming_events(days_ahead=365, lang=lang)
    eclipses = []
    conjunctions = []
    for ev in events:
        row = {
            "name": ev["name"],
            "date": ev["date"],
            "days_until": ev["days_until"],
        }
        if ev["kind"] == "eclipse":
            row["type"] = ev["type"]
            row["visibility"] = ev.get("visibility")
            eclipses.append(row)
        else:
            row["separation"] = ev.get("separation")
            conjunctions.append(row)

    next_eclipse = get_next_eclipse(lang)
    weekly = _weekly_structured(now, lang)
    return {
        "next_eclipse": next_eclipse,
        "eclipses": eclipses,
        "conjunctions": conjunctions,
        "weekly": weekly,
        "now": now.strftime("%d.%m.%Y"),
    }


async def get_events(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"events:{lang}", EVENTS_TTL, lambda: _events_raw(lang))


# ---------------------------------------------------------------------------
# Mars weather (NASA InSight feed)
# ---------------------------------------------------------------------------

def _mars_raw() -> dict:
    try:
        data = MoonMarsAPI.get_mars_weather()
    except Exception as e:
        logger.error("mars weather: %s", e)
        data = None
    if not data:
        return {"available": False}
    data["available"] = True
    return data


async def get_mars() -> dict:
    return await asyncio.to_thread(get_or_fetch, "mars", MARS_TTL, _mars_raw)


# ---------------------------------------------------------------------------
# Mars rover photos (Mars Vista API) — recent Perseverance / Curiosity imagery
# ---------------------------------------------------------------------------

MARS_ROVERS_TTL = 1800  # rovers image daily; refresh every 30 min is plenty


def _mars_rovers_raw() -> dict:
    """Latest photos for both active rovers, behind the shared cache.

    Returns ``{configured, perseverance, curiosity}``. When the Mars Vista
    API key isn't set, ``configured`` is false and both lists are empty so the
    site can render placeholder tiles instead of erroring.
    """
    if not MarsRoverAPI.is_configured():
        return {"configured": False, "perseverance": [], "curiosity": []}
    return {
        "configured": True,
        "perseverance": MarsRoverAPI.get_latest_photos("perseverance", limit=8),
        "curiosity": MarsRoverAPI.get_latest_photos("curiosity", limit=8),
    }


async def get_mars_rovers() -> dict:
    return await asyncio.to_thread(
        get_or_fetch, "mars_rovers", MARS_ROVERS_TTL, _mars_rovers_raw
    )


# ---------------------------------------------------------------------------
# APOD — NASA Astronomy Picture of the Day (photo + title + explanation)
# ---------------------------------------------------------------------------

APOD_TTL = 3600  # APOD changes once a day; refresh gently


def _apod_raw(lang: str = DEFAULT_LANG) -> dict:
    """Fetch today's APOD via the bot's NasaAPI and translate the explanation.

    Returns title/date/explanation plus the best image URL (or video thumbnail).
    Fail-soft: returns ``{available: False}`` if NASA is unreachable so the home
    page can quietly omit the block instead of erroring.
    """
    try:
        data = NasaAPI.get_apod()
    except Exception as e:
        logger.error("apod fetch: %s", e)
        return {"available": False}
    if not data or not data.get("url") and not data.get("hdurl") and not data.get("thumbnail"):
        return {"available": False}

    explanation = data.get("explanation", "") or ""
    if lang == "en":
        expl = explanation
    else:
        try:
            expl = Translator.translate(explanation, "en", "uk") or explanation
        except Exception:
            expl = explanation

    media_type = data.get("media_type", "image")
    # Prefer the HD image; for video APODs there is only a thumbnail.
    if media_type == "video":
        image = data.get("thumbnail") or data.get("url")
    else:
        image = data.get("hdurl") or data.get("url")

    return {
        "available": True,
        "title": data.get("title", ""),
        "date": data.get("date", ""),
        "explanation": expl,
        "image": image,
        "media_type": media_type,
        "video_url": data.get("url") if media_type == "video" else None,
        "credit": data.get("copyright") or "",
    }


async def get_apod(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"apod:{lang}", APOD_TTL, lambda: _apod_raw(lang))


# ---------------------------------------------------------------------------
# Space news — daily SpaceflightNow digest archived in MySQL (`news_articles`),
# with a live-parser fallback so the page still works without the DB. The bot's
# daily scheduler also calls `ingest_news_articles` to grow the archive.
# ---------------------------------------------------------------------------

NEWS_TTL = 1800  # 30 min
NEWS_ARTICLE_TTL = 6 * 3600  # bodies don't change once fetched
NEWS_LIST_LIMIT = 60


def _news_localize(items, lang):
    """Pick the title/excerpt in the requested language (fall back to EN)."""
    out = []
    for it in items:
        title = (it.get("title_uk") if lang == "uk" and it.get("title_uk") else it.get("title")) or ""
        excerpt = (it.get("excerpt_uk") if lang == "uk" and it.get("excerpt_uk") else it.get("excerpt")) or ""
        out.append({
            "id": it.get("id"),
            "slug": it.get("slug") or "",
            "url": it.get("url") or "",
            "title": title,
            "excerpt": excerpt,
            "category": it.get("category") or "missions",
            "date": it.get("published_date") or "",
            "source": it.get("source") or "SpaceflightNow",
            "image": it.get("image") or "",
        })
    return out


def _news_live(lang):
    """Live SpaceflightNow fetch used when the DB archive is empty/unavailable.
    Best-effort stores into the archive, then reads back; if the DB is off,
    returns the freshly-parsed list with id=null (cards link out to source)."""
    arts = SpaceflightNowParser.get_news() or []
    if not arts:
        return []
    try:
        ingest_news_articles(arts)
    except Exception as e:
        logger.error("news live ingest: %s", e)
    stored = get_news_articles(NEWS_LIST_LIMIT)
    if stored:
        return _news_localize(stored, lang)
    return [{
        "id": None, "slug": "", "url": a.get("url", ""), "title": a.get("title", ""),
        "excerpt": a.get("excerpt", ""), "category": a.get("category_bucket", "missions"),
        "date": a.get("date", ""), "source": "SpaceflightNow", "image": "",
    } for a in arts]


def _news_raw(lang):
    stored = get_news_articles(NEWS_LIST_LIMIT)
    if stored:
        return {"available": True, "items": _news_localize(stored, lang)}
    live = _news_live(lang)
    return {"available": bool(live), "items": live}


async def get_news(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"news:{lang}", NEWS_TTL, lambda: _news_raw(lang))


def _news_article_raw(slug, lang):
    """Article page data keyed by slug. The body (English) is stored at ingest
    time (from the RSS ``content:encoded``), so this only translates it to UK
    on first view (lazily, persisted — never retranslated). For legacy rows with
    no stored body, falls back to a lazy HTML fetch via ``get_article_content``.
    Returns 3 related articles in the same category."""
    it = get_news_article_by_slug(slug)
    if not it:
        return {"available": False}
    article_id = it.get("id")
    # Legacy row without a stored body → lazy HTML fetch (RSS gap / pre-RSS
    # ingest). New rows already carry the body from the feed — no HTTP fetch.
    if not it.get("body"):
        try:
            content = SpaceflightNowParser.get_article_content(it["url"])
            body = content.get("body", "")
            image = content.get("image") or it.get("image")
            body_uk = Translator.translate(body, "en", "uk") if (lang == "uk" and body) else ""
            if body:
                set_news_article_body(article_id, body, body_uk, image)
                it["body"] = body
                it["body_uk"] = body_uk
                it["image"] = image
        except Exception as e:
            logger.error("news article body fetch: %s", e)
    # Lazy UK translation of the stored EN body — persisted so it's only done
    # once per article (DeepL quota: translating every new article's full body
    # at ingest would exceed the 500k/month free limit).
    if lang == "uk" and it.get("body") and not it.get("body_uk"):
        try:
            body_uk = Translator.translate(it["body"], "en", "uk")
            if body_uk:
                set_news_article_body(article_id, it["body"], body_uk, it.get("image"))
                it["body_uk"] = body_uk
        except Exception as e:
            logger.error("news article body translate: %s", e)
    body = (it.get("body_uk") if lang == "uk" and it.get("body_uk") else it.get("body")) or it.get("excerpt") or ""
    title = (it.get("title_uk") if lang == "uk" and it.get("title_uk") else it.get("title")) or ""
    related = _news_localize(
        get_related_news_articles(it.get("category") or "missions", slug, 3), lang
    )
    return {
        "available": True,
        "id": article_id,
        "slug": it.get("slug") or slug,
        "url": it.get("url") or "",
        "title": title,
        "body": body,
        "image": it.get("image") or "",
        "category": it.get("category") or "missions",
        "date": it.get("published_date") or "",
        "source": it.get("source") or "SpaceflightNow",
        "related": related,
    }


async def get_news_article_api(slug: str, lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(
        get_or_fetch, f"news_art:{slug}:{lang}", NEWS_ARTICLE_TTL,
        lambda: _news_article_raw(slug, lang)
    )


# ---------------------------------------------------------------------------
# APOD archive — a date range of NASA Astronomy Pictures of the Day, for the
# site's photo/video gallery page. Each entry is the per-day APOD (image or
# video) with a translated explanation.
# ---------------------------------------------------------------------------

APOD_ARCHIVE_TTL = 6 * 3600  # past days never change; refresh gently


def _apod_localize(rows: list, lang: str = DEFAULT_LANG) -> list:
    """Shape archive rows (DB dicts or live NASA entries) into the gallery's
    entry dict: ``{date, title, explanation, image, thumb, media_type,
    video_url, credit}``. DB rows carry local ``thumb_path``/``full_path``
    (served from /apod-img); live NASA entries fall back to the remote URLs.
    The explanation is already translated at ingest for DB rows, so this just
    picks the right language column.
    """
    out = []
    for r in rows:
        media_type = (r.get("media_type") or "image").lower()
        if media_type == "video":
            image = r.get("full_path") or r.get("thumbnail") or r.get("url")
            thumb = r.get("thumb_path") or image
            video_url = r.get("video_url") or r.get("url")
        else:
            # full_path = locally-mirrored HD original (lightbox);
            # thumb_path = ~480px JPEG (grid card). Fall back to NASA URLs if
            # the local files aren't present (live fetch without DB).
            image = (r.get("full_path") if r.get("full_path")
                     else r.get("hdurl") or r.get("url") or r.get("thumbnail"))
            thumb = (r.get("thumb_path") if r.get("thumb_path")
                     else r.get("thumbnail") or r.get("url") or image)
            video_url = None

        # Local paths are relative to data/apod → serve via /apod-img.
        if image and not str(image).startswith(("http://", "https://", "/")):
            image = "/apod-img/" + str(image).lstrip("/")
        if thumb and not str(thumb).startswith(("http://", "https://", "/")):
            thumb = "/apod-img/" + str(thumb).lstrip("/")

        explanation = r.get("explanation", "") or ""
        if lang != "en" and r.get("explanation_uk"):
            explanation = r.get("explanation_uk") or explanation

        out.append({
            "date": r.get("date", ""),
            "title": r.get("title", ""),
            "explanation": explanation,
            "image": image,
            "thumb": thumb,
            "media_type": media_type,
            "video_url": video_url,
            "credit": r.get("credit") or r.get("copyright") or "",
        })
    return out


def _apod_archive_raw(start: str, end: str, lang: str = DEFAULT_LANG) -> list:
    """Return ``[start, end]`` APOD entries for the gallery (most-recent first)
    as ``{date, title, explanation, image, thumb, media_type, video_url,
    credit}``.

    DB-first: reads the mirrored ``apod_entries`` archive (populated daily by
    the scheduler's ``poll_apod_archive`` + the one-shot backfill). Images are
    served from our own ``/apod-img`` mirror (full + 480px thumb). If the DB has
    nothing for this window (DB error, or the user browsed beyond the
    backfilled range), fall back to a live NASA fetch and ingest it — lazy
    backfill-on-browse that populates the DB while preserving full backward
    navigation to 1995. Fail-soft: ``[]`` if both DB and NASA are unavailable.
    """
    stored = get_apod_entries(start, end)  # None = DB error, [] = empty window
    if stored:
        return _apod_localize(stored, lang)

    # DB empty/unavailable → live NASA fetch + ingest (lazy backfill on browse).
    entries = NasaAPI.get_apod_archive(start, end)
    if not entries:
        return []
    try:
        ingest_apod_entries(entries)
    except Exception as e:
        logger.error("APOD live-ingest error: %s", e)
    # Read back from DB; if DB still empty (ingest failed / no DB), localize
    # the live entries directly so the page still renders.
    stored = get_apod_entries(start, end) or []
    rows = stored if stored else entries
    return _apod_localize(rows, lang)


async def get_apod_archive(start: str, end: str, lang: str = DEFAULT_LANG) -> list:
    key = f"apod_archive:{start}:{end}:{lang}"
    return await asyncio.to_thread(
        get_or_fetch, key, APOD_ARCHIVE_TTL, lambda: _apod_archive_raw(start, end, lang)
    )


# NASA APOD began 1995-06-16 — don't try to fetch beyond it.
APOD_OLDEST = "1995-06-16"


def _apod_archive_window(start: str, end: str, lang: str = DEFAULT_LANG) -> list:
    """Return the *complete* ``[start, end]`` APOD window for one gallery page.

    Stricter sibling of ``_apod_archive_raw``: only serves from the DB when it
    already covers the whole window (``(end-start).days+1`` rows). If the DB is
    missing any day (empty, partial, or DB error), live-fetches the window from
    NASA and ingests it — the idempotent UPSERT is the "save to DB in parallel"
    step — then returns the freshest rows. This guarantees every page renders
    the full ``page_size`` cards instead of a partial DB slice, and that paging
    into un-mirrored territory both shows the photos and persists them.
    """
    try:
        expected = (date.fromisoformat(end) - date.fromisoformat(start)).days + 1
    except Exception:
        expected = 0
    # get_apod_entries is supposed to return None on a DB error, but a dead
    # connection raises before its own try/except — guard here so a DB outage
    # falls back to a live NASA fetch instead of 500ing the whole page.
    try:
        stored = get_apod_entries(start, end)  # None = DB error, [] = empty window
    except Exception as e:
        logger.error("APOD DB read error: %s", e)
        stored = None
    if stored and expected and len(stored) >= expected:
        return _apod_localize(stored, lang)
    entries = NasaAPI.get_apod_archive(start, end)
    if entries:
        try:
            ingest_apod_entries(entries)
        except Exception as e:
            logger.error("APOD live-ingest error: %s", e)
        try:
            stored = get_apod_entries(start, end) or []
        except Exception:
            stored = []
        rows = stored if len(stored) >= len(entries) else entries
    else:
        rows = stored or []
    return _apod_localize(rows, lang)


async def get_apod_archive_page(
    page: int, page_size: int = 12, lang: str = DEFAULT_LANG
) -> dict:
    """One page of the APOD archive for backend-driven pagination.

    Page 0 starts at the most recent APOD (yesterday — today's isn't published
    yet in US time) and each page steps ``page_size`` days older, down to the
    first APOD on 1995-06-16. Returns
    ``{items, page, page_size, total_pages, has_more}``. Windows beyond the
    mirrored archive are live-fetched + ingested on demand (lazy backfill), so
    paging forward into unseen territory loads the photos and persists them to
    the DB in the same request.
    """
    page = max(0, int(page))
    page_size = max(1, min(int(page_size), 24))
    today = date.today()
    newest = today - timedelta(days=1)  # today's APOD not available yet
    oldest = date.fromisoformat(APOD_OLDEST)
    total_entries = max(0, (newest - oldest).days + 1)
    total_pages = max(1, (total_entries + page_size - 1) // page_size)
    if page > total_pages - 1:
        page = total_pages - 1
    end_day = newest - timedelta(days=page * page_size)
    start_day = end_day - timedelta(days=page_size - 1)
    if start_day < oldest:
        start_day = oldest
    if end_day < oldest:
        end_day = oldest
    key = f"apod_archive_page:{page}:{page_size}:{lang}"
    items = await asyncio.to_thread(
        get_or_fetch, key, APOD_ARCHIVE_TTL,
        lambda: _apod_archive_window(start_day.isoformat(), end_day.isoformat(), lang),
    )
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_more": page + 1 < total_pages,
    }


# ---------------------------------------------------------------------------
# Space debris (curated ESA figures)
# ---------------------------------------------------------------------------

def _debris_raw() -> dict:
    try:
        return SpaceDebrisAPI.get_stats_dict()
    except Exception as e:
        logger.error("debris: %s", e)
        return {}


async def get_debris() -> dict:
    return await asyncio.to_thread(get_or_fetch, "debris", DEBRIS_TTL, _debris_raw)


# ---------------------------------------------------------------------------
# Jupiter — full moon catalog (JPL mean elements) + live geocentric distance
# ---------------------------------------------------------------------------

def _jupiter_raw() -> dict:
    try:
        return _build_jupiter()
    except Exception as e:  # noqa: BLE001
        logger.error("jupiter: %s", e)
        return {}


async def get_jupiter() -> dict:
    return await asyncio.to_thread(get_or_fetch, "jupiter", JUPITER_TTL, _jupiter_raw)


# ---------------------------------------------------------------------------
# Mercury — live distance and greatest elongation dates
# ---------------------------------------------------------------------------

def _mercury_raw() -> dict:
    try:
        return _build_mercury()
    except Exception as e:
        logger.error("mercury: %s", e)
        return {}


async def get_mercury() -> dict:
    return await asyncio.to_thread(get_or_fetch, "mercury", MERCURY_TTL, _mercury_raw)


# ---------------------------------------------------------------------------
# GRB (gamma-ray burst) alerts — NASA GCN circulars
# ---------------------------------------------------------------------------

def _grb_raw(limit: int) -> dict:
    try:
        items = GRBAlertAPI.get_recent_grbs(limit=limit)
    except Exception as e:
        logger.error("grb: %s", e)
        items = []
    return {"items": items, "count": len(items)}


async def get_grb(limit: int = 20) -> dict:
    return await asyncio.to_thread(get_or_fetch, "grb", GRB_TTL, lambda: _grb_raw(limit))


# ---------------------------------------------------------------------------
# Observable comets (curated digest; days-to-perihelion computed live)
# ---------------------------------------------------------------------------

def _comets_raw(lang: str = DEFAULT_LANG) -> dict:
    try:
        return CometAPI.get_observable_comets(lang)
    except Exception as e:
        logger.error("comets: %s", e)
        return {}


async def get_comets(lang: str = DEFAULT_LANG) -> dict:
    return await asyncio.to_thread(get_or_fetch, f"comets:{lang}", COMETS_TTL, lambda: _comets_raw(lang))


# ---------------------------------------------------------------------------
# Exoplanets — NASA Exoplanet Archive (TAP): confirmed count, TOI candidates,
# featured planet, radius-vs-period scatter, catalog table.
# ---------------------------------------------------------------------------

def _exoplanets_raw() -> dict:
    try:
        return ExoplanetAPI.get_exoplanets()
    except Exception as e:
        logger.error("exoplanets: %s", e)
        return {}


async def get_exoplanets() -> dict:
    return await asyncio.to_thread(get_or_fetch, "exoplanets", EXO_TTL, _exoplanets_raw)


# ---------------------------------------------------------------------------
# MAST (Kepler/TESS archives)
# ---------------------------------------------------------------------------

def _run_mast_subprocess(args: list[str], timeout: float = 180) -> dict | list | None:
    """Run a MAST query in a short-lived child process and parse its JSON.

    lightkurve + astropy + astroquery are ~hundreds of MB resident, and
    ``MastService.query_star_lightcurve`` loads a full TESS/Kepler FITS
    product into memory on top of that. Running them in the long-lived
    web/bot process grew it until the OOM killer took the whole service
    down. The child process imports the heavy stack, does the work, prints
    one JSON line to stdout and exits — freeing all of it. The caller
    caches the result (24 h / 12 h), so the child only forks once per
    target per day. Returns ``None`` on timeout / non-zero exit / bad JSON
    so the caller can avoid caching a failure.
    """
    import sys as _sys
    import subprocess
    import json as _json
    try:
        proc = subprocess.run(
            [_sys.executable, "-m", "services.mast", *args],
            capture_output=True, text=True, timeout=timeout, check=False,
        )
    except subprocess.TimeoutExpired:
        logger.warning("MAST subprocess timed out (%s)", args)
        return None
    if proc.returncode != 0:
        logger.warning("MAST subprocess rc=%s: %s",
                       proc.returncode, (proc.stderr or "")[-1000:])
        return None
    try:
        return _json.loads(proc.stdout)
    except _json.JSONDecodeError as exc:
        logger.warning("MAST subprocess bad JSON: %s", exc)
        return None


def _mast_lightcurve_raw(target: str) -> dict | None:
    return _run_mast_subprocess(["lightcurve", target])

async def get_mast_lightcurve(target: str) -> dict:
    key = f"mast_lc:{target.strip().upper()}"
    # Don't cache a failed (None) result for 24 h — only cache real data.
    val = await asyncio.to_thread(
        get_or_fetch, key, 86400,
        lambda: _mast_lightcurve_raw(target),
        lambda v: v is not None,
    )
    return val or {}

def _mast_hubble_jwst_raw() -> list | None:
    return _run_mast_subprocess(["hubble-jwst"])

async def get_mast_hubble_jwst() -> list:
    val = await asyncio.to_thread(
        get_or_fetch, "mast_hj", 43200, _mast_hubble_jwst_raw,
        lambda v: v is not None,
    )
    return val or []