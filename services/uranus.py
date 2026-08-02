"""Uranus data: live geocentric distance + next opposition event + moons catalog."""
from datetime import datetime, timezone

_OPPOSITION_DATES = [
    "2026-11-18", "2027-11-21", "2028-11-24", "2029-11-28", "2030-12-01",
]

_RAW_MOONS = [
    ("Cordelia", 49751.0, 0.00026, 0.0, 0.085, 0.3350, 40.0, "inner", "Корделія"),
    ("Ophelia", 53763.0, 0.00992, 0.0, 0.104, 0.3764, 43.0, "inner", "Офелія"),
    ("Bianca", 59165.0, 0.00092, 0.0, 0.193, 0.4346, 51.0, "inner", "Біанка"),
    ("Cressida", 61766.0, 0.00036, 0.0, 0.006, 0.4636, 80.0, "inner", "Крессіда"),
    ("Desdemona", 62658.0, 0.00013, 0.0, 0.111, 0.4737, 64.0, "inner", "Дездемона"),
    ("Juliet", 64360.0, 0.00066, 0.0, 0.065, 0.4931, 93.0, "inner", "Джульєтта"),
    ("Portia", 66097.0, 0.00005, 0.0, 0.059, 0.5132, 135.0, "inner", "Порція"),
    ("Rosalind", 69927.0, 0.00011, 0.0, 0.279, 0.5585, 72.0, "inner", "Розалінда"),
    ("Cupid", 74392.0, 0.0013, 0.0, 0.1, 0.613, 18.0, "inner", "Купідон"),
    ("Belinda", 75255.0, 0.00007, 0.0, 0.031, 0.6201, 90.0, "inner", "Белінда"),
    ("Perdita", 76417.0, 0.0012, 0.0, 0.0, 0.638, 30.0, "inner", "Пердіта"),
    ("Puck", 86015.0, 0.00012, 0.0, 0.319, 0.7618, 162.0, "inner", "Пак"),
    ("Mab", 97736.0, 0.0025, 0.0, 0.13, 0.923, 24.0, "inner", "Маб"),
    ("Miranda", 129390.0, 0.0013, 120.0, 4.34, 1.4135, 471.6, "major", "Міранда"),
    ("Ariel", 191020.0, 0.0012, 45.0, 0.26, 2.5204, 1157.8, "major", "Аріель"),
    ("Umbriel", 266300.0, 0.0039, 190.0, 0.205, 4.1442, 1169.4, "major", "Умбріель"),
    ("Titania", 435910.0, 0.0011, 280.0, 0.34, 8.7059, 1577.8, "major", "Титанія"),
    ("Oberon", 583520.0, 0.0014, 87.0, 0.058, 13.4632, 1522.8, "major", "Оберон"),
    ("Francisco", 4276000.0, 0.1459, 0.0, 145.2, 266.56, 22.0, "outer", "Франциско"),
    ("Caliban", 7231000.0, 0.1587, 0.0, 140.9, 579.73, 72.0, "outer", "Калібан"),
    ("Stephano", 8004000.0, 0.2292, 0.0, 144.1, 677.37, 32.0, "outer", "Стефано"),
    ("Trinculo", 8504000.0, 0.2200, 0.0, 167.0, 749.24, 18.0, "outer", "Трінкуло"),
    ("Sycorax", 12179000.0, 0.5324, 0.0, 159.4, 1288.28, 157.0, "outer", "Сікоракса"),
    ("Margaret", 14345000.0, 0.6608, 0.0, 56.6, 1687.01, 20.0, "outer", "Маргарита"),
    ("Prospero", 16256000.0, 0.4448, 0.0, 152.0, 1978.29, 50.0, "outer", "Просперо"),
    ("Setebos", 17418000.0, 0.5914, 0.0, 158.2, 2225.21, 47.0, "outer", "Сетебос"),
    ("Ferdinand", 20901000.0, 0.3682, 0.0, 169.8, 2887.21, 21.0, "outer", "Фердинанд"),
    ("S/2023 U 1", 7977000.0, 0.25, 0.0, 144.0, 680.0, 8.0, "outer", "S/2023 U 1"),
]

URANUS_MOONS = []
for name, a_km, e, M_deg, i_deg, P_days, dia_km, group, name_uk in _RAW_MOONS:
    URANUS_MOONS.append({
        "name": name,
        "name_uk": name_uk,
        "group": group,
        "a_km": a_km,
        "period_d": P_days,
        "e": e,
        "i_deg": i_deg,
        "prograde": i_deg < 90.0,
        "m0_deg": M_deg,
        "diameter_km": dia_km,
    })


def _next_opposition(now: datetime) -> str:
    today = now.date().isoformat()
    for d in _OPPOSITION_DATES:
        if d >= today:
            return d
    return _OPPOSITION_DATES[-1]


def _earth_uranus_distance_km() -> float | None:
    """Live geocentric distance to Uranus, via skyfield."""
    try:
        from services.planets import _get_skyfield
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        t = ts.now()
        earth, uranus = eph[399], eph[7]
        d = earth.at(t).observe(uranus).distance()
        return d.km
    except Exception:
        return None


_C_KM_S = 299792.458


def get_uranus() -> dict:
    """Return live Uranus distance, light time, next opposition, and moons catalog."""
    now = datetime.now(timezone.utc)
    dist_km = _earth_uranus_distance_km()
    light_time_min = (dist_km / _C_KM_S / 60.0) if dist_km is not None else None
    return {
        "now_ms": int(now.timestamp() * 1000),
        "distance_km": float(dist_km) if dist_km is not None else None,
        "light_time_min": float(light_time_min) if light_time_min is not None else None,
        "opposition_next_iso": _next_opposition(now),
        "moons_count": len(URANUS_MOONS),
        "moons": URANUS_MOONS,
    }
