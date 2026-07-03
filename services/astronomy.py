"""Astronomical events — eclipses and planet conjunctions"""
import math
from datetime import datetime, timedelta, timezone
import logging
from utils.i18n import t, pick, days, DEFAULT_LANG

logger = logging.getLogger(__name__)

# Known eclipses 2026–2028 (date, type, visibility)
# `type` is a language-neutral key used for emoji lookup and the scheduler's
# "is it total?" check (do NOT substring-match Ukrainian here).
# Each entry carries Ukrainian (name/visibility) and English (*_en) fields.
_ECLIPSES = [
    # 2026
    {"date": (2026, 3, 14), "type": "moon_total", "name": "Повне місячне затемнення", "name_en": "Total lunar eclipse", "visibility": "Європа, Африка, Азія, Австралія", "visibility_en": "Europe, Africa, Asia, Australia"},
    {"date": (2026, 3, 20), "type": "sun_partial", "name": "Часткове сонячне затемнення", "name_en": "Partial solar eclipse", "visibility": "Арктика, пн. Атлантика", "visibility_en": "Arctic, N. Atlantic"},
    {"date": (2026, 8, 12), "type": "moon_partial", "name": "Часткове місячне затемнення", "name_en": "Partial lunar eclipse", "visibility": "Європа, Африка, Азія, Австралія", "visibility_en": "Europe, Africa, Asia, Australia"},
    {"date": (2026, 8, 20), "type": "sun_partial", "name": "Часткове сонячне затемнення", "name_en": "Partial solar eclipse", "visibility": "Арктика, пн. Америка, пн. Атлантика", "visibility_en": "Arctic, N. America, N. Atlantic"},
    # 2027
    {"date": (2027, 2, 6), "type": "moon_partial", "name": "Часткове місячне затемнення", "name_en": "Partial lunar eclipse", "visibility": "Європа, Африка, Азія, Австралія", "visibility_en": "Europe, Africa, Asia, Australia"},
    {"date": (2027, 2, 16), "type": "sun_annular", "name": "Кільцеве сонячне затемнення", "name_en": "Annular solar eclipse", "visibility": "Африка, Аравія, Індія", "visibility_en": "Africa, Arabia, India"},
    {"date": (2027, 8, 2), "type": "moon_total", "name": "Повне місячне затемнення", "name_en": "Total lunar eclipse", "visibility": "Європа, Африка, Азія, Австралія", "visibility_en": "Europe, Africa, Asia, Australia"},
    {"date": (2027, 8, 11), "type": "sun_total", "name": "Повне сонячне затемнення", "name_en": "Total solar eclipse", "visibility": "Пн. Америка, Європа", "visibility_en": "N. America, Europe"},
    # 2028
    {"date": (2028, 1, 22), "type": "moon_partial", "name": "Часткове місячне затемнення", "name_en": "Partial lunar eclipse", "visibility": "Європа, Африка, Азія, Австралія", "visibility_en": "Europe, Africa, Asia, Australia"},
    {"date": (2028, 2, 5), "type": "sun_annular", "name": "Кільцеве сонячне затемнення", "name_en": "Annular solar eclipse", "visibility": "Атлантика, Африка", "visibility_en": "Atlantic, Africa"},
    {"date": (2028, 7, 16), "type": "moon_partial", "name": "Часткове місячне затемнення", "name_en": "Partial lunar eclipse", "visibility": "Європа, Африка, Азія, Австралія", "visibility_en": "Europe, Africa, Asia, Australia"},
    {"date": (2028, 7, 31), "type": "sun_total", "name": "Повне сонячне затемнення", "name_en": "Total solar eclipse", "visibility": "Австралія, Тихий океан", "visibility_en": "Australia, Pacific Ocean"},
]

# Known conjunctions 2026–2028 (date, planets, angular separation)
_CONJUNCTIONS = [
    {"date": (2026, 6, 1), "bodies": "Венера і Юпітер", "bodies_en": "Venus and Jupiter", "separation": 0.2},
    {"date": (2026, 7, 14), "bodies": "Марс і Юпітер", "bodies_en": "Mars and Jupiter", "separation": 0.3},
    {"date": (2026, 9, 11), "bodies": "Меркурій і Венера", "bodies_en": "Mercury and Venus", "separation": 0.4},
    {"date": (2027, 3, 22), "bodies": "Венера і Сатурн", "bodies_en": "Venus and Saturn", "separation": 0.5},
    {"date": (2027, 5, 29), "bodies": "Марс і Сатурн", "bodies_en": "Mars and Saturn", "separation": 0.3},
    {"date": (2027, 11, 11), "bodies": "Венера і Юпітер", "bodies_en": "Venus and Jupiter", "separation": 0.2},
    {"date": (2028, 1, 14), "bodies": "Марс і Нептун", "bodies_en": "Mars and Neptune", "separation": 0.1},
    {"date": (2028, 4, 5), "bodies": "Венера і Сатурн", "bodies_en": "Venus and Saturn", "separation": 0.4},
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


def get_upcoming_events(days_ahead=90, lang=DEFAULT_LANG):
    """Return upcoming eclipses and conjunctions within days_ahead."""
    events = []

    for e in _ECLIPSES:
        d = _days_until(e["date"] + (0, 0))
        if 0 <= d <= days_ahead:
            events.append({
                "kind": "eclipse",
                "name": pick(e, "name", lang),
                "type": e["type"],
                "date": datetime(*e["date"]).strftime("%d.%m.%Y"),
                "days_until": d,
                "visibility": pick(e, "visibility", lang),
            })

    for c in _CONJUNCTIONS:
        d = _days_until(c["date"] + (0, 0))
        if 0 <= d <= days_ahead:
            bodies = pick(c, "bodies", lang)
            events.append({
                "kind": "conjunction",
                "name": t('astro.conjunction_name', lang, bodies=bodies),
                "date": datetime(*c["date"]).strftime("%d.%m.%Y"),
                "days_until": d,
                "separation": c["separation"],
            })

    events.sort(key=lambda x: x["days_until"])
    return events


def format_events(lang=DEFAULT_LANG):
    """Format upcoming events for Telegram."""
    events = get_upcoming_events(days_ahead=365, lang=lang)

    if not events:
        return t('astro.empty', lang)

    message = t('astro.title', lang)
    message += t('astro.upcoming', lang)

    for i, ev in enumerate(events[:6], 1):
        in_days = t('astro.in_days', lang, d=days(ev['days_until'], lang))
        if ev["kind"] == "eclipse":
            emoji = _TYPE_EMOJI.get(ev["type"], "🌑")
            message += t('astro.eclipse_entry', lang, i=i, emoji=emoji,
                          name=ev['name'], date=ev['date'], when=in_days,
                          visibility=ev['visibility'])
        else:
            message += t('astro.conj_entry', lang, i=i, name=ev['name'],
                          date=ev['date'], when=in_days, sep=ev['separation'])

    message += t('astro.where_header', lang)
    message += t('astro.link1', lang)
    message += t('astro.link2', lang)
    message += t('astro.link3', lang)
    message += '\n'
    message += t('astro.footer', lang)
    return message


def get_next_eclipse(lang=DEFAULT_LANG):
    """Return the next eclipse event only."""
    for e in _ECLIPSES:
        d = _days_until(e["date"] + (0, 0))
        if d >= 0:
            return {
                "name": pick(e, "name", lang),
                "name_uk": e["name"],
                "name_en": e.get("name_en", e["name"]),
                "type": e["type"],
                "date": datetime(*e["date"]).strftime("%d.%m.%Y"),
                "days_until": d,
                "visibility": pick(e, "visibility", lang),
                "visibility_uk": e["visibility"],
                "visibility_en": e.get("visibility_en", e["visibility"]),
            }
    return None


# ---------------------------------------------------------------------------
# "This week in the sky" — aggregates conjunctions, meteor maxima, Moon phases
# (incl. supermoon) and planet retrograde stations within the next 7 days.
# ---------------------------------------------------------------------------

def _is_supermoon(dt):
    """True if the Moon is near perigee at the given full-moon instant.

    Threshold 362,000 km — the conventional "supermoon" cutoff (full Moon near
    perigee). Uses skyfield's geocentric Moon distance; a failure degrades to
    False (the full Moon is still reported, just not flagged as super).
    """
    try:
        from services.planets import _get_skyfield
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        earth, moon = eph[399], eph[301]
        t = ts.from_datetime(dt.replace(tzinfo=timezone.utc))
        return earth.at(t).observe(moon).apparent().distance().km < 362_000.0
    except Exception as e:
        logger.error(f"supermoon check: {e}")
        return False


def _detect_retrogrades(now, lang):
    """Detect planet retrograde stations (begin/end) within the next 7 days.

    Samples each planet's geocentric apparent ecliptic longitude at 12-hour
    steps and flags a sign change in the day-to-day increment as a station.
    Returns events as (datetime, order, i18n_key, params) tuples.
    """
    try:
        from services.planets import _get_skyfield, TARGETS
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
    except Exception as e:
        logger.error(f"retrograde skyfield load: {e}")
        return []
    earth = eph[399]
    steps = 17  # 8 days inclusive, 12-hour cadence
    times = [ts.from_datetime((now + timedelta(hours=12 * i)).replace(tzinfo=timezone.utc))
             for i in range(steps)]
    out = []
    for key, tid in TARGETS:
        try:
            body = eph[tid]
            lons = []
            for tt in times:
                lon = earth.at(tt).observe(body).apparent().ecliptic_latlon()[1].degrees
                lons.append(lon)
            diffs = []
            for i in range(len(lons) - 1):
                d = lons[i + 1] - lons[i]
                if d > 180:
                    d -= 360
                elif d < -180:
                    d += 360
                diffs.append(d)
            for i in range(len(diffs) - 1):
                a, b = diffs[i], diffs[i + 1]
                if a == 0 or b == 0:
                    continue
                if (a > 0 and b < 0) or (a < 0 and b > 0):
                    dt = now + timedelta(hours=12 * (i + 1))
                    if 0 <= (dt - now).days <= 7:
                        ev_key = 'weekly.retro_begin' if a > 0 else 'weekly.retro_end'
                        name = t(f'planets.name.{key}', lang)
                        out.append((dt, 5, ev_key, {'planet': name, 'date': dt.strftime('%d.%m')}))
        except Exception as e:
            logger.error(f"retrograde {key}: {e}")
    return out


def get_weekly_calendar(lang=DEFAULT_LANG):
    """Build the 'this week in the sky' digest (next 7 days)."""
    now = datetime.now()
    events = []  # (datetime, order, i18n_key, params)

    # 1) Conjunctions from the curated table.
    for c in _CONJUNCTIONS:
        dt = datetime(*c["date"])
        d = (dt - now).days
        if 0 <= d <= 7:
            events.append((dt, 1, 'weekly.conj',
                           {'bodies': pick(c, 'bodies', lang), 'sep': c['separation'],
                            'date': dt.strftime('%d.%m')}))

    # 2) Meteor-shower maxima.
    try:
        from services.meteor_shower import MeteorShower
        for s in MeteorShower.get_upcoming_showers(limit=15):
            du = s.get('days_until')
            if du is None or not (0 <= du <= 7):
                continue
            pdt = s.get('peak_datetime') or (now + timedelta(days=du))
            events.append((pdt, 2, 'weekly.meteor',
                           {'name': pick(s, 'name', lang), 'date': pdt.strftime('%d.%m'),
                            'rate': s.get('rate', '?')}))
    except Exception as e:
        logger.error(f"weekly meteor: {e}")

    # 3) Moon phases + supermoon.
    try:
        from services.moon_mars import MoonMarsAPI
        mp = MoonMarsAPI.get_moon_phase(lang)
        if mp:
            dtf = now + timedelta(days=mp['days_to_full'])
            if 0 <= mp['days_to_full'] <= 7:
                key = 'weekly.supermoon' if _is_supermoon(dtf) else 'weekly.full_moon'
                events.append((dtf, 3, key, {'date': dtf.strftime('%d.%m')}))
            dtn = now + timedelta(days=mp['days_to_new'])
            if 0 <= mp['days_to_new'] <= 7:
                events.append((dtn, 4, 'weekly.new_moon', {'date': dtn.strftime('%d.%m')}))
    except Exception as e:
        logger.error(f"weekly moon: {e}")

    # 4) Planet retrograde stations (skyfield).
    events.extend(_detect_retrogrades(now, lang))

    events.sort(key=lambda e: (e[0], e[1]))
    if not events:
        return t('weekly.empty', lang)

    msg = t('weekly.title', lang)
    for _dt, _order, key, params in events:
        msg += t(key, lang, **params)
    msg += t('weekly.footer', lang)
    return msg