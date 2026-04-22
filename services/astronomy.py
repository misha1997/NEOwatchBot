"""Astronomical events — eclipses and planet conjunctions"""
import math
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Known eclipses 2026–2028 (date, type, visibility)
_ECLIPSES = [
    # 2026
    {"date": (2026, 3, 14), "type": "moon_total", "name": "Повне місячне затемнення", "visibility": "Європа, Африка, Азія, Австралія"},
    {"date": (2026, 3, 20), "type": "sun_partial", "name": "Часткове сонячне затемнення", "visibility": "Арктика, пн. Атлантика"},
    {"date": (2026, 8, 12), "type": "moon_partial", "name": "Часткове місячне затемнення", "visibility": "Європа, Африка, Азія, Австралія"},
    {"date": (2026, 8, 20), "type": "sun_partial", "name": "Часткове сонячне затемнення", "visibility": "Арктика, пн. Америка, пн. Атлантика"},
    # 2027
    {"date": (2027, 2, 6), "type": "moon_partial", "name": "Часткове місячне затемнення", "visibility": "Європа, Африка, Азія, Австралія"},
    {"date": (2027, 2, 16), "type": "sun_annular", "name": "Кільцеве сонячне затемнення", "visibility": "Африка, Аравія, Індія"},
    {"date": (2027, 8, 2), "type": "moon_total", "name": "Повне місячне затемнення", "visibility": "Європа, Африка, Азія, Австралія"},
    {"date": (2027, 8, 11), "type": "sun_total", "name": "Повне сонячне затемнення", "visibility": "Пн. Америка, Європа"},
    # 2028
    {"date": (2028, 1, 22), "type": "moon_partial", "name": "Часткове місячне затемнення", "visibility": "Європа, Африка, Азія, Австралія"},
    {"date": (2028, 2, 5), "type": "sun_annular", "name": "Кільцеве сонячне затемнення", "visibility": "Атлантика, Африка"},
    {"date": (2028, 7, 16), "type": "moon_partial", "name": "Часткове місячне затемнення", "visibility": "Європа, Африка, Азія, Австралія"},
    {"date": (2028, 7, 31), "type": "sun_total", "name": "Повне сонячне затемнення", "visibility": "Австралія, Тихий океан"},
]

# Known conjunctions 2026–2028 (date, planets, angular separation)
_CONJUNCTIONS = [
    {"date": (2026, 6, 1), "bodies": "Венера і Юпітер", "separation": 0.2},
    {"date": (2026, 7, 14), "bodies": "Марс і Юпітер", "separation": 0.3},
    {"date": (2026, 9, 11), "bodies": "Меркурій і Венера", "separation": 0.4},
    {"date": (2027, 3, 22), "bodies": "Венера і Сатурн", "separation": 0.5},
    {"date": (2027, 5, 29), "bodies": "Марс і Сатурн", "separation": 0.3},
    {"date": (2027, 11, 11), "bodies": "Венера і Юпітер", "separation": 0.2},
    {"date": (2028, 1, 14), "bodies": "Марс і Нептун", "separation": 0.1},
    {"date": (2028, 4, 5), "bodies": "Венера і Сатурн", "separation": 0.4},
]

_TYPE_EMOJI = {
    "moon_total": "🌕",
    "moon_partial": "🌗",
    "sun_total": "☀️",
    "sun_partial": "🌑",
    "sun_annular": "🔴",
}


def _days_until(date_tuple):
    """Return days until given date."""
    target = datetime(*date_tuple)
    now = datetime.now()
    return (target - now).days


def get_upcoming_events(days_ahead=90):
    """Return upcoming eclipses and conjunctions within days_ahead."""
    events = []

    for e in _ECLIPSES:
        days = _days_until(e["date"] + (0, 0))
        if days >= 0 and days <= days_ahead:
            events.append({
                "kind": "eclipse",
                "name": e["name"],
                "type": e["type"],
                "date": datetime(*e["date"]).strftime("%d.%m.%Y"),
                "days_until": days,
                "visibility": e["visibility"],
            })

    for c in _CONJUNCTIONS:
        days = _days_until(c["date"] + (0, 0))
        if days >= 0 and days <= days_ahead:
            events.append({
                "kind": "conjunction",
                "name": f"З'єднання {c['bodies']}",
                "date": datetime(*c["date"]).strftime("%d.%m.%Y"),
                "days_until": days,
                "separation": c["separation"],
            })

    events.sort(key=lambda x: x["days_until"])
    return events


def format_events():
    """Format upcoming events for Telegram."""
    events = get_upcoming_events(days_ahead=365)

    if not events:
        return "🔭 <b>Астрономічні події</b>\n\nНайближчі 90 днів подій немає."

    message = "🔭 <b>Астрономічні події</b>\n\n"
    message += "<i>Найближчі події:</i>\n\n"

    for i, ev in enumerate(events[:6], 1):
        if ev["kind"] == "eclipse":
            emoji = _TYPE_EMOJI.get(ev["type"], "🌑")
            message += (
                f"{i}. {emoji} <b>{ev['name']}</b>\n"
                f"   📅 {ev['date']} (через {ev['days_until']} дн.)\n"
                f"   🌍 {ev['visibility']}\n\n"
            )
        else:
            message += (
                f"{i}. ✨ <b>{ev['name']}</b>\n"
                f"   📅 {ev['date']} (через {ev['days_until']} дн.)\n"
                f"   📐 Відстань: {ev['separation']}°\n\n"
            )

    message += "<i>Дані оновлюються раз на рік</i>"
    return message


def get_next_eclipse():
    """Return the next eclipse event only."""
    for e in _ECLIPSES:
        days = _days_until(e["date"] + (0, 0))
        if days >= 0:
            return {
                "name": e["name"],
                "type": e["type"],
                "date": datetime(*e["date"]).strftime("%d.%m.%Y"),
                "days_until": days,
                "visibility": e["visibility"],
            }
    return None
