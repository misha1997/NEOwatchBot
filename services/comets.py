"""Observable comets — curated ephemeris digest.

There is no single stable, free, no-key JSON feed for "which comets are
observable right now" that fits a public dashboard. JPL Horizons gives
per-object ephemeris (one request per comet, with rate limits); COBS and
TheSkyLive change shape often. The picture also moves only on a weeks-to-
months timescale, so a curated dataset with a clear update stamp is more
honest and far more robust than scraping a fragile endpoint.

Each entry stores a perihelion date, so ``days_to_perihelion`` is computed
live from today — the only number on the page that genuinely changes daily.
Update the magnitudes / distances and the ``updated`` stamp when refreshing
(the orbit diagram and brightness curve are illustrative and stay static).

Localizable text fields (``designation``, ``type_label``, ``constellation``,
``visibility_label``; for famous comets ``designation`` and ``note``) carry a
``*_en`` sibling selected by ``lang`` via :func:`utils.i18n.pick`.
"""
import logging
from datetime import date, datetime

from utils.i18n import pick, DEFAULT_LANG

logger = logging.getLogger(__name__)

# Observable comets. ``brightness_curve`` is [days_from_perihelion, magnitude]
# — lower magnitude = brighter; negative days = before perihelion.
_OBSERVABLE = [
    {
        "id": "c2025r4",
        "designation": "C/2025 R4 (Borёва)",
        "designation_en": "C/2025 R4 (Boreva)",
        "type": "long_period",
        "type_label": "Довгоперіодична",
        "type_label_en": "Long-period",
        "period_years": None,
        "perihelion_date": "2026-09-16",
        "perihelion_distance_au": 1.4,
        "magnitude": 4.8,
        "peak_magnitude": 3.5,
        "trend": "brightening",
        "constellation": "Візничий",
        "constellation_en": "Auriga",
        "best_time": "23:00–02:00",
        "visibility": "naked_eye",
        "visibility_label": "Неозброєним оком",
        "visibility_label_en": "Naked eye",
        "color": "#4FD1C5",
        "distance_sun_au": 1.4,
        "distance_earth_au": 2.1,
        "brightness_curve": [
            [-60, 9.2], [-40, 7.6], [-20, 6.0], [-5, 5.0],
            [0, 4.8], [10, 4.0], [20, 3.5], [35, 4.1],
            [50, 5.2], [72, 6.6], [100, 8.0],
        ],
    },
    {
        "id": "p29",
        "designation": "29P/Schwassmann–Wachmann",
        "designation_en": "29P/Schwassmann–Wachmann",
        "type": "periodic",
        "type_label": "Періодична 14.9 р.",
        "type_label_en": "Periodic 14.9 yr",
        "period_years": 14.9,
        "perihelion_date": "2038-03-10",
        "perihelion_distance_au": 5.7,
        "magnitude": 11.2,
        "peak_magnitude": 11.2,
        "trend": "stable",
        "constellation": "Стрілець",
        "constellation_en": "Sagittarius",
        "best_time": "до 23:00",
        "visibility": "telescope",
        "visibility_label": "Потрібен телескоп",
        "visibility_label_en": "Telescope required",
        "color": "#E8B94D",
        "distance_sun_au": 5.8,
        "distance_earth_au": 5.1,
        "brightness_curve": [
            [-60, 12.1], [-30, 11.6], [0, 11.2], [30, 11.5],
            [60, 12.0], [100, 12.4],
        ],
    },
    {
        "id": "c2026f3",
        "designation": "C/2026 F3",
        "designation_en": "C/2026 F3",
        "type": "long_period",
        "type_label": "Довгоперіодична",
        "type_label_en": "Long-period",
        "period_years": None,
        "perihelion_date": "2026-11-28",
        "perihelion_distance_au": 0.8,
        "magnitude": 9.6,
        "peak_magnitude": 7.0,
        "trend": "brightening",
        "constellation": "Кассіопея",
        "constellation_en": "Cassiopeia",
        "best_time": "03:00–05:00",
        "visibility": "binocular",
        "visibility_label": "Бінокль / телескоп",
        "visibility_label_en": "Binocular / telescope",
        "color": "#B98FE8",
        "distance_sun_au": 1.1,
        "distance_earth_au": 1.6,
        "brightness_curve": [
            [-60, 12.5], [-30, 10.8], [-10, 9.9], [0, 9.6],
            [15, 7.8], [30, 7.0], [60, 8.3], [100, 10.1],
        ],
    },
    {
        "id": "p67",
        "designation": "67P/Чурюмова–Герасименко",
        "designation_en": "67P/Churyumov–Gerasimenko",
        "type": "periodic",
        "type_label": "Періодична 6.5 р.",
        "type_label_en": "Periodic 6.5 yr",
        "period_years": 6.5,
        "perihelion_date": "2027-11-02",
        "perihelion_distance_au": 1.24,
        "magnitude": 14.1,
        "peak_magnitude": 12.5,
        "trend": "brightening",
        "constellation": "Терези",
        "constellation_en": "Libra",
        "best_time": "02:00–04:00",
        "visibility": "large_telescope",
        "visibility_label": "Лише великий телескоп",
        "visibility_label_en": "Large telescope only",
        "color": "#FF6B4A",
        "distance_sun_au": 1.5,
        "distance_earth_au": 1.9,
        "brightness_curve": [
            [-60, 15.2], [-30, 14.4], [0, 14.1], [30, 13.3],
            [60, 12.5], [100, 13.0],
        ],
    },
]

# Famous / historical comets (static reference, not currently tracked live).
_FAMOUS = [
    {
        "designation": "1P/Галлея",
        "designation_en": "1P/Halley",
        "period_years": 76,
        "next_perihelion": "2061",
        "last_seen": "1986",
        "note": "Найвідоміша короткоперіодична комета, повертається кожні 76 років.",
        "note_en": "The most famous short-period comet, returns every 76 years.",
    },
    {
        "designation": "C/1995 O1 (Хейла–Боппа)",
        "designation_en": "C/1995 O1 (Hale–Bopp)",
        "period_years": 2533,
        "next_perihelion": "~4530 р.",
        "last_seen": "1996–1997",
        "note": "Яскрава довгоперіодична комета, видима неозброєним оком понад року.",
        "note_en": "Bright long-period comet, visible to the naked eye for over a year.",
    },
    {
        "designation": "C/2020 F3 (NEOWISE)",
        "designation_en": "C/2020 F3 (NEOWISE)",
        "period_years": 6800,
        "next_perihelion": "~8820 р.",
        "last_seen": "2020",
        "note": "Остання «велика» комета північної півкулі, видима 2020 року.",
        "note_en": "The last 'great' comet of the northern hemisphere, visible in 2020.",
    },
]

_SOURCE_URL = "https://www.minorplanetcenter.net/iau/Ephemerides/Comets/"
_UPDATED = "2026-07-06"

_VIS_ORDER = {"naked_eye": 0, "binocular": 1, "telescope": 2, "large_telescope": 3}


def _days_to_perihelion(iso: str, today: date | None = None) -> int | None:
    try:
        peri = datetime.fromisoformat(iso).date()
    except (ValueError, TypeError):
        return None
    today = today or date.today()
    return (peri - today).days


def _entry(c: dict, lang: str = DEFAULT_LANG) -> dict:
    """Public-facing dict for one observable comet."""
    days = _days_to_perihelion(c["perihelion_date"])
    return {
        "id": c["id"],
        "designation": pick(c, "designation", lang),
        "type": c["type"],
        "type_label": pick(c, "type_label", lang),
        "period_years": c["period_years"],
        "perihelion_date": c["perihelion_date"],
        "days_to_perihelion": days,
        "perihelion_distance_au": c["perihelion_distance_au"],
        "magnitude": c["magnitude"],
        "peak_magnitude": c["peak_magnitude"],
        "trend": c["trend"],
        "constellation": pick(c, "constellation", lang),
        "best_time": c["best_time"],
        "visibility": c["visibility"],
        "visibility_label": pick(c, "visibility_label", lang),
        "color": c["color"],
        "distance_sun_au": c["distance_sun_au"],
        "distance_earth_au": c["distance_earth_au"],
        "brightness_curve": c["brightness_curve"],
    }


class CometAPI:
    """Curated observable-comets digest for the website."""

    @staticmethod
    def get_observable_comets(lang: str = DEFAULT_LANG) -> dict:
        """Structured comet digest: brightest now, visible list, orbit, famous."""
        try:
            entries = [_entry(c, lang) for c in _OBSERVABLE]
            # Brightest = lowest magnitude among currently visible entries.
            brightest = min(entries, key=lambda e: e["magnitude"])
            # Visible table ordered by ease of observation.
            visible = sorted(
                entries,
                key=lambda e: (_VIS_ORDER.get(e["visibility"], 9), e["magnitude"]),
            )
            orbit = [
                {
                    "id": e["id"],
                    "designation": e["designation"],
                    "color": e["color"],
                    "distance_sun_au": e["distance_sun_au"],
                    "distance_earth_au": e["distance_earth_au"],
                    "days_to_perihelion": e["days_to_perihelion"],
                }
                for e in entries
            ]
            famous = [
                {
                    "designation": pick(f, "designation", lang),
                    "period_years": f["period_years"],
                    "next_perihelion": f["next_perihelion"],
                    "last_seen": f["last_seen"],
                    "note": pick(f, "note", lang),
                }
                for f in _FAMOUS
            ]
            return {
                "brightest": brightest,
                "visible": visible,
                "famous": famous,
                "orbit": orbit,
                "updated": _UPDATED,
                "source_url": _SOURCE_URL,
            }
        except Exception as e:  # pragma: no cover — defensive
            logger.error(f"Comets digest error: {e}")
            return {"brightest": None, "visible": [], "famous": [],
                    "orbit": [], "updated": _UPDATED, "source_url": _SOURCE_URL}

    @staticmethod
    def get_comets_text(lang: str = "uk") -> str:
        """Telegram-friendly text digest (used by the bot if wired up).

        Inline Ukrainian — the comet digest is small enough that a dedicated
        i18n key set isn't warranted until the bot actually surfaces it.
        """
        try:
            d = CometAPI.get_observable_comets(lang)
            b = d["brightest"]
            if not b:
                return "☄️ Зараз немає яскравих доступних комет для спостереження."
            days = b["days_to_perihelion"]
            days_txt = f"до перигелію {days} дн." if days is not None else ""
            msg = "☄️ <b>Найяскравіша комета зараз</b>\n"
            msg += f"• {b['designation']} — {b['type_label']}\n"
            msg += f"• {b['constellation']} · {b['magnitude']}m · {b['visibility_label']}\n"
            msg += f"• {b['distance_sun_au']} а.о. до Сонця · {b['distance_earth_au']} а.о. до Землі"
            if days_txt:
                msg += f" · {days_txt}"
            msg += f"\n\nВидимих комет у каталозі: {len(d['visible'])}.\n"
            msg += f"<a href=\"{d['source_url']}\">Джерело: MPC</a>"
            return msg
        except Exception as e:  # pragma: no cover — defensive
            logger.error(f"Comets text error: {e}")
            return "☄️ Не вдалося отримати дані про комети."