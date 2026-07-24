"""Venus data: live geocentric distance + next greatest brightness/elongation events."""
from datetime import datetime, timezone

_EVENTS = [
    ("2026-09-18T18:00:00Z", "brightness_evening", "найбільша вечірня яскравість", "greatest evening brightness",
     "Венера зараз — \"вечірня зоря\", видима після заходу Сонця на заході",
     "Venus is currently an \"evening star\", visible after sunset in the west"),
    ("2026-11-29T06:00:00Z", "brightness_morning", "найбільша ранкова яскравість", "greatest morning brightness",
     "Венера зараз — \"ранкова зоря\", видима перед світанком на сході",
     "Venus is currently a \"morning star\", visible before dawn in the east"),
    ("2027-01-03T06:00:00Z", "elongation_morning", "найбільша ранкова елонгація", "greatest morning elongation",
     "Венера зараз — \"ранкова зоря\", видима перед світанком на сході",
     "Venus is currently a \"morning star\", visible before dawn in the east"),
]


def _next_event(now: datetime) -> dict | None:
    for iso, etype, name_uk, name_en, foot_uk, foot_en in _EVENTS:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt > now:
            return {
                "date_iso": iso,
                "type": etype,
                "name_uk": name_uk,
                "name_en": name_en,
                "foot_uk": foot_uk,
                "foot_en": foot_en,
            }
    return None


def _earth_venus_distance_km() -> float | None:
    """Live geocentric distance to Venus, via skyfield."""
    try:
        from services.planets import _get_skyfield
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        t = ts.now()
        earth, venus = eph[399], eph[299]
        d = earth.at(t).observe(venus).distance()
        return d.km
    except Exception:
        return None


_C_KM_S = 299792.458


def get_venus() -> dict:
    """Return live Venus distance, light time, and next event details."""
    now = datetime.now(timezone.utc)
    dist_km = _earth_venus_distance_km()
    light_time_min = (dist_km / _C_KM_S / 60.0) if dist_km is not None else None
    evt = _next_event(now)
    return {
        "now_ms": int(now.timestamp() * 1000),
        "distance_km": dist_km,
        "light_time_min": light_time_min,
        "event_next": evt,
    }
