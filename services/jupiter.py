"""Jupiter moon catalog + live geocentric distance.

The full moon system is built from JPL SSD "Planetary Satellite Mean Elements"
(https://ssd.jpl.nasa.gov/sats/elem/sep.html) — every Jupiter satellite with a
computed orbit (115 as of this build), each carrying its real semi-major axis
``a`` (km), orbital period ``P`` (days), eccentricity ``e``, inclination ``i``
(deg, from which prograde/retrograde direction follows: i<90 prograde, i>90
retrograde) and mean anomaly ``M`` at epoch 2000-01-01.5 TDB. These mean
elements are sufficient to draw every moon on a correctly-sized orbit and to
animate each at its real *relative* angular speed (omega = 2*pi/P); the current
phase is propagated client-side from M0 as an approximation (JPL notes mean
elements are "not intended for ephemeris computation", so positions are
approximate — the catalog exists for the visual, not for precision).

The live Earth-Jupiter distance uses the already-loaded skyfield ephemeris
(``de440s.bsp``), mirroring ``services/planets.py``. The next opposition date is
served from a curated list (the ~399-day synodic period is regular enough that a
short list of predicted dates is plenty for a countdown).

Pattern mirrors ``services/debris.py`` (curated ``_DATA`` + ``get_*_dict``).
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

SOURCE_URL = "https://ssd.jpl.nasa.gov/sats/elem/sep.html"
EPOCH_ISO = "2000-01-01.5"  # TDB; mean-element epoch for all moons here.


def _norm_name(raw: str) -> str:
    """S2011_J_4 -> S/2011 J 4 (the standard provisional designation form)."""
    s = raw.replace("_", " ")
    if s.startswith("S ") and len(s) > 2 and s[2:6].isdigit():
        # "S 2011 J 4" -> "S/2011 J 4"
        return "S/" + s[2:]
    return s


# Ukrainian names for the named Jupiter moons (Greek mythos). Provisional
# designations keep their literal form (no translation).
_UK_NAMES = {
    "Io": "Іо", "Europa": "Європа", "Ganymede": "Ганімед", "Callisto": "Каллісто",
    "Amalthea": "Амальтея", "Thebe": "Теба", "Adrastea": "Адрастея", "Metis": "Метіда",
    "Himalia": "Гімалія", "Elara": "Елара", "Pasiphae": "Пасіфая", "Sinope": "Сінопа",
    "Lysithea": "Лісітея", "Carme": "Карме", "Ananke": "Ананке", "Leda": "Леда",
    "Callirrhoe": "Калліроя", "Themisto": "Фемісто", "Magaclite": "Мегакліта",
    "Taygete": "Тайгета", "Chaldene": "Халдена", "Harpalyke": "Гарпаліка",
    "Kalyke": "Калике", "Iocaste": "Іокаста", "Erinome": "Ерінома", "Isonoe": "Ісоне",
    "Praxidike": "Праксідіка", "Autonoe": "Автоноя", "Thyone": "Тіона",
    "Hermippe": "Герміппа", "Aitne": "Етна", "Eurydome": "Еврідома",
    "Euanthe": "Еванте", "Euporie": "Евпорія", "Orthosie": "Ортосія",
    "Sponde": "Спонде", "Kale": "Кале", "Pasithee": "Пасіфея",
    "Hegemone": "Гегемона", "Mneme": "Мнема", "Aoede": "Аеда",
    "Thelxinoe": "Телксіноя", "Arche": "Архе", "Kallichore": "Калліхора",
    "Helike": "Геліка", "Carpo": "Карпо", "Eukelade": "Евкелада",
    "Cyllene": "Кіллена", "Kore": "Кора", "Herse": "Герса", "Dia": "Дія",
    "Pandia": "Панідія", "Ersa": "Ерса", "Eirene": "Ейрена",
    "Philophrosyne": "Філофросина", "Eupheme": "Евфема", "Valetudo": "Валетудо",
}

# Mean diameters (km) for the eight large regular satellites (well established).
# Irregular satellites are small (a few km) and omitted (null) rather than guessed.
_DIAMETERS = {
    "Metis": 43.6, "Adrastea": 16.4, "Amalthea": 167.0, "Thebe": 99.0,
    "Io": 3643.0, "Europa": 3122.0, "Ganymede": 5268.0, "Callisto": 4821.0,
}


def _group(a_km: float, i_deg: float) -> str:
    """Classify a moon into one of six dynamical groups from (a, i).

    prograde (i<90): ring (a<0.25M) / galilean (a<2.5M) / himalia (irregular)
    retrograde (i>90): carme (i>=160) / pasiphae (distant, i<160) / ananke (rest)
    """
    if i_deg < 90.0:
        if a_km < 250_000.0:
            return "ring"
        if a_km < 2_500_000.0:
            return "galilean"
        return "himalia"
    # retrograde
    if i_deg >= 160.0:
        return "carme"
    if a_km >= 23_400_000.0:
        return "pasiphae"
    return "ananke"


# Each tuple: (name, a_km, e, M_deg, i_deg, P_days) — transcribed verbatim from
# the JPL mean-elements page (see SOURCE_URL), tables JUP365/347/348/349.
_RAW_MOONS = [
    # --- JUP365: regular satellites (Laplace plane) ---
    ("Metis", 128000.0, 0.000, 166.0, 0.0, 0.294779),
    ("Adrastea", 129000.0, 0.000, 214.5, 0.0, 0.298260),
    ("Amalthea", 181400.0, 0.003, 310.6, 0.4, 0.499918),
    ("Thebe", 221900.0, 0.018, 182.1, 1.1, 0.676105),
    ("Io", 421800.0, 0.004, 330.9, 0.0, 1.762732),
    ("Europa", 671100.0, 0.009, 345.4, 0.5, 3.525463),
    ("Ganymede", 1070400.0, 0.001, 324.8, 0.2, 7.155588),
    ("Callisto", 1882700.0, 0.007, 87.4, 0.3, 16.690440),
    # --- JUP347: irregulars (ecliptic) ---
    ("Themisto", 7397000.0, 0.257, 289.1, 44.3, 129.9681),
    ("Leda", 11145200.0, 0.162, 232.6, 28.2, 240.3264),
    ("Himalia", 11439000.0, 0.160, 78.3, 28.4, 249.9090),
    ("S2011_J_4", 11104600.0, 0.128, 314.6, 28.5, 239.0521),
    ("S2018_J_2", 11419700.0, 0.152, 115.5, 28.3, 249.2750),
    ("Pandia", 11479600.0, 0.178, 158.5, 28.9, 251.2319),
    ("Ersa", 11399400.0, 0.117, 270.8, 29.0, 248.6153),
    ("S2011_J_3", 11716800.0, 0.192, 359.4, 27.6, 259.0875),
    ("Elara", 11710700.0, 0.212, 346.9, 27.8, 258.8861),
    ("S2017_J_17", 11776100.0, 0.164, 244.5, 29.0, 261.0660),
    ("Lysithea", 11699100.0, 0.117, 328.5, 27.7, 258.5035),
    ("Dia", 12257900.0, 0.232, 320.9, 29.1, 277.2472),
    ("Carpo", 17039500.0, 0.415, 336.6, 53.3, 454.4000),
    ("Valetudo", 18690100.0, 0.217, 90.5, 34.5, 522.0743),
    ("S2018_J_4", 16328500.0, 0.177, 138.3, 50.2, 426.2646),
    ("Euporie", 19261900.0, 0.148, 56.4, 145.5, 546.1778),
    ("S2003_J_18", 20332800.0, 0.102, 252.5, 145.7, 592.3333),
    ("Orthosie", 20897800.0, 0.294, 161.1, 144.2, 617.2347),
    ("Euanthe", 20822900.0, 0.243, 353.5, 148.1, 613.9278),
    ("Harpalyke", 20887500.0, 0.239, 255.4, 147.8, 616.7833),
    ("Praxidike", 20931100.0, 0.245, 128.0, 148.2, 618.7229),
    ("Thyone", 20972700.0, 0.235, 242.5, 147.6, 620.5875),
    ("S2017_J_3", 20936500.0, 0.238, 235.4, 147.9, 618.9653),
    ("Mneme", 20815800.0, 0.240, 236.1, 147.8, 613.6104),
    ("S2010_J_2", 20786900.0, 0.244, 292.5, 148.0, 612.3507),
    ("S2016_J_1", 20796700.0, 0.245, 215.3, 145.1, 612.7812),
    ("Eupheme", 20763400.0, 0.234, 339.8, 147.9, 611.3160),
    ("S2021_J_3", 20776600.0, 0.239, 167.9, 147.9, 611.8736),
    ("Helike", 20911400.0, 0.155, 45.8, 154.4, 617.8625),
    ("S2003_J_2", 20992900.0, 0.225, 42.3, 150.1, 621.4715),
    ("S2003_J_12", 20959300.0, 0.235, 160.7, 150.0, 619.9611),
    ("S2021_J_1", 20954700.0, 0.228, 129.1, 150.5, 619.7687),
    ("S2021_J_2", 20926600.0, 0.242, 110.8, 148.1, 618.5028),
    ("S2022_J_3", 21015100.0, 0.248, 271.7, 148.1, 622.4361),
    ("Thelxinoe", 20972300.0, 0.229, 275.1, 150.7, 620.5458),
    ("S2021_J_8", 20978900.0, 0.243, 85.0, 147.1, 620.8486),
    ("S2017_J_10", 21075800.0, 0.209, 157.7, 145.1, 625.1493),
    ("Ananke", 21029500.0, 0.238, 271.7, 147.6, 623.1097),
    ("Iocaste", 21062300.0, 0.223, 182.0, 148.7, 624.5479),
    ("S2017_J_7", 20960400.0, 0.235, 353.0, 147.4, 620.0167),
    ("S2003_J_16", 20877500.0, 0.238, 298.2, 147.8, 616.3444),
    ("Hermippe", 21103600.0, 0.220, 158.6, 150.2, 626.3799),
    ("S2010_J_6", 21489800.0, 0.297, 87.8, 149.9, 643.6715),
    ("S2017_J_9", 21764200.0, 0.197, 243.3, 155.4, 656.0479),
    ("S2011_J_2", 22903400.0, 0.358, 297.6, 151.7, 708.2931),
    ("Chaldene", 22926300.0, 0.261, 275.3, 164.7, 709.3625),
    ("Isonoe", 22976300.0, 0.249, 116.3, 164.9, 711.6604),
    ("S2003_J_4", 22922300.0, 0.327, 216.5, 148.3, 709.1229),
    ("Kallichore", 23017100.0, 0.253, 66.8, 164.7, 713.5931),
    ("Eurydome", 22894500.0, 0.287, 281.8, 148.9, 707.8569),
    ("Pasithee", 22840800.0, 0.274, 237.8, 164.5, 705.4090),
    ("S2017_J_15", 23170300.0, 0.232, 324.6, 149.2, 720.6535),
    ("S2003_J_24", 22882400.0, 0.263, 121.6, 164.6, 707.3347),
    ("S2021_J_6", 22870400.0, 0.271, 208.5, 164.9, 706.7653),
    ("Arche", 23093200.0, 0.263, 34.0, 164.5, 717.1056),
    ("Kale", 23047800.0, 0.262, 175.9, 164.6, 715.0160),
    ("Eirene", 23051300.0, 0.263, 336.7, 164.7, 715.1910),
    ("Eukelade", 23062400.0, 0.274, 234.2, 164.7, 715.6868),
    ("S2022_J_2", 23073400.0, 0.263, 98.9, 164.7, 716.2104),
    ("S2017_J_16", 23007800.0, 0.268, 148.8, 164.7, 713.1292),
    ("Aitne", 23059400.0, 0.273, 120.6, 164.5, 715.5396),
    ("Erinome", 23027200.0, 0.272, 273.1, 164.3, 714.0542),
    ("Carme", 23139200.0, 0.261, 259.5, 164.6, 719.2806),
    ("Herse", 23146700.0, 0.258, 123.1, 164.4, 719.6264),
    ("S2003_J_19", 23153100.0, 0.264, 196.9, 164.6, 719.9222),
    ("S2016_J_4", 23113900.0, 0.294, 217.5, 147.1, 718.0382),
    ("S2011_J_1", 23120800.0, 0.269, 225.4, 164.7, 718.4153),
    ("S2017_J_5", 23202000.0, 0.261, 69.3, 164.7, 722.1972),
    ("S2017_J_2", 22949600.0, 0.270, 278.2, 164.5, 710.4208),
    ("Taygete", 23103400.0, 0.257, 116.5, 164.7, 717.5917),
    ("Kalyke", 23298000.0, 0.261, 224.9, 164.7, 726.7007),
    ("Philophrosyne", 22600200.0, 0.221, 88.9, 146.1, 694.2042),
    ("S2016_J_3", 22719300.0, 0.251, 59.1, 164.6, 699.7583),
    ("S2017_J_13", 22842700.0, 0.277, 26.8, 164.5, 705.4972),
    ("S2010_J_4", 22793400.0, 0.278, 80.4, 164.6, 703.1938),
    ("S2022_J_1", 22744700.0, 0.257, 42.2, 164.5, 700.9333),
    ("S2017_J_11", 22991300.0, 0.268, 236.9, 164.8, 712.3826),
    ("S2017_J_18", 22923800.0, 0.254, 40.6, 164.9, 709.2396),
    ("S2017_J_6", 23251200.0, 0.333, 146.0, 149.6, 724.4688),
    ("S2017_J_8", 22819600.0, 0.259, 349.4, 164.8, 704.4181),
    ("S2017_J_12", 23270500.0, 0.257, 273.2, 164.8, 725.3986),
    ("S2011_J_6", 23238700.0, 0.261, 54.2, 164.9, 723.9340),
    ("S2018_J_5", 23269900.0, 0.261, 82.9, 164.9, 725.3785),
    ("Hegemone", 23342600.0, 0.357, 241.1, 152.5, 728.7743),
    ("S2003_J_10", 23384400.0, 0.257, 272.8, 164.6, 730.7375),
    ("S2017_J_1", 23739600.0, 0.321, 250.1, 145.6, 747.4382),
    ("S2003_J_23", 23824000.0, 0.306, 140.6, 144.4, 751.3993),
    ("S2003_J_9", 23195100.0, 0.268, 359.8, 164.7, 721.8792),
    ("Autonoe", 23785200.0, 0.326, 134.0, 150.7, 749.6097),
    ("Callirrhoe", 23789400.0, 0.290, 117.9, 144.9, 749.7910),
    ("S2010_J_1", 23185600.0, 0.256, 183.4, 164.5, 721.4257),
    ("Aoede", 23773100.0, 0.437, 207.6, 155.7, 749.0708),
    ("S2010_J_5", 23581000.0, 0.257, 233.7, 164.6, 739.9875),
    ("S2024_J_1", 23462100.0, 0.273, 147.7, 164.7, 734.3764),
    ("S2011_J_5", 23527800.0, 0.251, 66.6, 164.6, 737.4646),
    ("S2017_J_14", 23412500.0, 0.436, 100.3, 142.7, 732.0424),
    ("S2010_J_3", 23862900.0, 0.313, 40.1, 148.3, 753.2771),
    ("Magaclite", 23640100.0, 0.421, 116.1, 149.9, 742.7715),
    ("Cyllene", 23650000.0, 0.421, 153.3, 146.8, 743.2062),
    ("S2018_J_3", 23400200.0, 0.268, 279.0, 164.9, 731.4875),
    ("S2021_J_5", 23414600.0, 0.272, 236.5, 164.9, 732.1528),
    ("S2021_J_4", 23019700.0, 0.265, 218.9, 164.6, 713.7056),
    ("S2021_J_7", 23305900.0, 0.253, 293.4, 149.4, 727.0104),
    ("Sinope", 23679300.0, 0.262, 157.4, 157.3, 744.5951),
    ("Pasiphae", 23463200.0, 0.412, 279.3, 148.3, 734.4215),
    ("Sponde", 23538700.0, 0.323, 177.4, 149.4, 737.9542),
    ("Kore", 24203300.0, 0.338, 40.6, 141.7, 769.4229),
]

# Build the catalog, guarding against any accidental name duplication.
_seen = set()
JUPITER_MOONS = []
for _name, _a, _e, _M, _i, _P in _RAW_MOONS:
    if _name in _seen:
        continue
    _seen.add(_name)
    JUPITER_MOONS.append({
        "name": _norm_name(_name),
        "name_uk": _UK_NAMES.get(_name, _norm_name(_name)),
        "group": _group(_a, _i),
        "a_km": _a,
        "period_d": _P,
        "e": _e,
        "i_deg": _i,
        "prograde": _i < 90.0,
        "m0_deg": _M,
        "diameter_km": _DIAMETERS.get(_name),
    })
del _seen


# Curated upcoming oppositions (Sun-Jupiter-Earth ~180° elongation). The ~399-day
# synodic period makes a short forward list plenty for a countdown; replenished
# occasionally. Times are approximate to the day.
_OPPOSITION_DATES = [
    "2026-01-10", "2027-01-24", "2028-02-08", "2029-02-22", "2030-03-08",
    "2031-03-23", "2032-04-06", "2033-04-21", "2034-05-05",
]


def _next_opposition(now: datetime) -> str:
    today = now.date().isoformat()
    for d in _OPPOSITION_DATES:
        if d >= today:
            return d
    return _OPPOSITION_DATES[-1]


def _earth_jupiter_distance_km() -> float | None:
    """Live geocentric light-time distance to Jupiter, via skyfield.

    Returns None if the ephemeris cannot be loaded (the site keeps serving
    even without skyfield, mirroring the planets module's resilience).
    """
    try:
        from services.planets import _get_skyfield  # noqa: WPS433 (lazy import)
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        t = ts.now()
        earth, jup = eph[399], eph[5]
        d = earth.at(t).observe(jup).distance()
        return d.km
    except Exception:  # noqa: BLE001 — never break the page over a distance value
        return None


_C_KM_S = 299792.458


def get_jupiter() -> dict:
    """Return the Jupiter moon catalog + live distance + next opposition."""
    now = datetime.now(timezone.utc)
    dist_km = _earth_jupiter_distance_km()
    light_time_min = (dist_km / _C_KM_S / 60.0) if dist_km is not None else None
    return {
        "now_ms": int(now.timestamp() * 1000),
        "epoch_iso": EPOCH_ISO,
        "source_url": SOURCE_URL,
        "distance_km": dist_km,
        "light_time_min": light_time_min,
        "opposition_next_iso": _next_opposition(now),
        "moons_count": len(JUPITER_MOONS),
        "prograde_count": sum(1 for m in JUPITER_MOONS if m["prograde"]),
        "retrograde_count": sum(1 for m in JUPITER_MOONS if not m["prograde"]),
        "moons": JUPITER_MOONS,
    }


if __name__ == "__main__":  # quick local sanity check
    from collections import Counter
    g = Counter(m["group"] for m in JUPITER_MOONS)
    print("total:", len(JUPITER_MOONS))
    print("by group:", dict(g))
    print("prograde:", sum(m["prograde"] for m in JUPITER_MOONS))
    print("retrograde:", sum(not m["prograde"] for m in JUPITER_MOONS))