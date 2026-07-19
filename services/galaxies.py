"""Famous-galaxies data for the website ``/galaxies`` hub + per-galaxy pages.

The 12 galaxies are a **curated catalog** (names, slugs, categories, distances,
diameters, magnitudes, RA/Dec, NASA-image search query, Ukrainian+English
description + short fact). That curated text is the source of truth — galaxy
physics barely changes, so it's authored once and seeded into the DB at ingest.

Two live pieces are pulled from external APIs and merged in at ingest time:

* **NASA/IPAC NED (TAP)** — redshift ``z`` + NED physical type + preferred name,
  via a small box search around each galaxy's RA/Dec (NED's preferred-name lookup
  doesn't match Messier/NGC designations, but a position search does). NED's TAP
  table ``NEDTAP.objdir`` exposes *redshift*, not a distance value, and for the
  nearest galaxies redshift is meaningless anyway (Andromeda is blueshifted,
  approaching us) — so distances stay curated and only z + type come from NED.
* **NASA Image and Video Library** — up to ``cap`` photos per galaxy (title,
  description [English as-is], creator, date, asset URLs). Mirrored locally by
  ``services/galaxy_images``.

Everything is best-effort: a NED/NASA failure for one galaxy never blocks the
others — the row is still stored with curated fields and ``redshift=None``.
"""
from __future__ import annotations

import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Curated catalog of 12 famous galaxies.
#
# ``ra``/``dec`` are J2000 degrees (for the NED box search). ``dist_ly`` is a
# numeric light-year distance for the log-scale distance chart (0 for the Milky
# Way — we're inside it). ``nasa_query`` is the NASA Image Library search term.
# ``dist_text_*`` keeps the human distance string (handles ranges like "45–65").
# ---------------------------------------------------------------------------
GALAXIES: list[dict] = [
    {
        "key": "milky-way", "slug": "milky-way", "category": "spiral",
        "designation": "—",
        "name_uk": "Чумацький Шлях", "name_en": "Milky Way",
        "dist_text_uk": "ми в ній", "dist_text_en": "we are inside it",
        "dist_ly": 0, "diameter_ly": "~100 000–200 000 св. р.", "magnitude": "—",
        "ra": 266.4167, "dec": -29.0078, "nasa_query": "Milky Way galaxy",
        "description_uk": "Наш рідний зоряний дім: смуга з понад 100–400 мільярдів зір, \
об'єднаних гравітацією у великий спіральний диск із перемичкою. У центрі \
— супермасивна чорна діра Стрілець A* масою близько 4,3 мільйона мас Сонця. \
Сонце обертається навколо галактичного центра на відстані ~26 000 світлових років, \
роблячи один оберт за ~230 мільйонів років.",
        "description_en": "Our home galaxy: a band of 100–400 billion stars bound by gravity \
into a large barred spiral disk. At its center sits the supermassive black hole \
Sagittarius A*, about 4.3 million solar masses. The Sun orbits the galactic center \
at ~26,000 light-years, completing one revolution in ~230 million years.",
        "fact_uk": "Понад 100–400 мільярдів зір, чорна діра Стрілець A* у центрі масою ~4.3 млн M☉.",
        "fact_en": "100–400 billion stars; central black hole Sagittarius A* (~4.3 million M☉).",
    },
    {
        "key": "andromeda", "slug": "andromeda-m31", "category": "spiral",
        "designation": "M31 / NGC 224",
        "name_uk": "Андромеда", "name_en": "Andromeda",
        "dist_text_uk": "2.5 млн св. р.", "dist_text_en": "2.5 Mly",
        "dist_ly": 2_500_000, "diameter_ly": "~152 000 св. р.", "magnitude": "3.4m",
        "ra": 10.6847, "dec": 41.26875, "nasa_query": "Andromeda Galaxy",
        "description_uk": "Найближча велика галактика до Чумацького Шляху й найвіддаленіший \
об'єкт, який можна побачити неозброєним оком. Перетнута спіральна галактика \
діаметром близько 152 000 світлових років, що містить понад трильйон зір — \
приблизно вдвічі більше за наш Чумацький Шлях. Наближається до нас зі швидкістю \
~110 км/с і зіткнеться з нашою галактикою приблизно через 4–10 мільярдів років, \
утворивши нову еліптичну галактику.",
        "description_en": "The nearest large galaxy to the Milky Way and the most distant object \
visible to the naked eye. A barred spiral about 152,000 light-years across with \
over a trillion stars — roughly twice our Milky Way. It approaches us at ~110 km/s \
and will merge with our galaxy in ~4–10 billion years, forming a new elliptical.",
        "fact_uk": "Найближча велика галактика, видима неозброєним оком. Зіткнеться з Чумацьким Шляхом через 4–10 млрд років.",
        "fact_en": "Nearest large galaxy, visible to the naked eye. Will merge with the Milky Way in 4–10 billion years.",
    },
    {
        "key": "triangulum", "slug": "triangulum-m33", "category": "spiral",
        "designation": "M33 / NGC 598",
        "name_uk": "Трикутник", "name_en": "Triangulum",
        "dist_text_uk": "2.7 млн св. р.", "dist_text_en": "2.7 Mly",
        "dist_ly": 2_700_000, "diameter_ly": "~60 000 св. р.", "magnitude": "5.7m",
        "ra": 23.4621, "dec": 30.6602, "nasa_query": "Triangulum Galaxy M33",
        "description_uk": "Третя за розміром галактика Місцевої групи після Андромеди \
й Чумацького Шляху. Невелика спіральна галактика без вираженого балджу, \
у якій зореутворення йде дуже активно — її часто використовують для вивчення \
екстремально яскравих зоряних утворень. Ймовірно, гравітаційно пов'язана \
з Андромедою як її супутник, хоча це питання досі відкрите.",
        "description_en": "The third-largest galaxy of the Local Group after Andromeda and the \
Milky Way. A small spiral with no prominent bulge and very active star formation — \
often studied for its extremely luminous star-forming regions. Probably a satellite \
of Andromeda, though this is still debated.",
        "fact_uk": "Третя за розміром галактика Місцевої групи, можливо супутник Андромеди — питання відкрите.",
        "fact_en": "Third-largest Local Group galaxy, possibly an Andromeda satellite — still debated.",
    },
    {
        "key": "whirlpool", "slug": "whirlpool-m51", "category": "spiral",
        "designation": "M51 / NGC 5194",
        "name_uk": "Вир", "name_en": "Whirlpool",
        "dist_text_uk": "23 млн св. р.", "dist_text_en": "23 Mly",
        "dist_ly": 23_000_000, "diameter_ly": "~60 000 св. р.", "magnitude": "8.4m",
        "ra": 202.4696, "dec": 47.1952, "nasa_query": "Whirlpool Galaxy",
        "description_uk": "Класичний приклад гравітаційної взаємодії: менша галактика-супутник \
NGC 5195 пролітає повз основний диск і своєю гравітацією деформує та підсилює \
спіральні рукави Виру. Це одна з найфотографованіших галактик неба — чіткі \
спіральні рукави насичені молодими гарячими зорями й зонами зореутворення, \
які підсвічується прольотом сусідки.",
        "description_en": "A textbook case of gravitational interaction: the smaller companion \
NGC 5195 swings past the main disk and its gravity distorts and intensifies the \
Whirlpool's spiral arms. One of the most photographed galaxies in the sky — the \
crisp spiral arms are rich with young hot stars and star-forming regions lit up by \
the companion's flyby.",
        "fact_uk": "Класична взаємодія: сусідка NGC 5195 деформує й підсилює спіральні рукави.",
        "fact_en": "Classic interaction: neighbor NGC 5195 distorts and intensifies the spiral arms.",
    },
    {
        "key": "sombrero", "slug": "sombrero-m104", "category": "spiral",
        "designation": "M104 / NGC 4594",
        "name_uk": "Сомбреро", "name_en": "Sombrero",
        "dist_text_uk": "31 млн св. р.", "dist_text_en": "31 Mly",
        "dist_ly": 31_000_000, "diameter_ly": "~50 000 св. р.", "magnitude": "8.0m",
        "ra": 189.9976, "dec": -11.6231, "nasa_query": "Sombrero Galaxy",
        "description_uk": "Галактика, яка дивиться на нас майже ребром: яскраве зоряне ядро \
й масштабний гало з майже чорною пиловою смугою диска, що перетинає її — \
виглядає як капелюх сомбреро. У центрі — надмасивна чорна діра масою \
~1 мільярд мас Сонця, одна з найбільших серед галактик такого розміру. \
Спіральна/лінзоподібна перехідна галактика на межі типів Sa/S0.",
        "description_en": "A galaxy seen almost edge-on: a bright stellar core and a huge halo \
crossed by a nearly black dust lane in the disk — looks like a sombrero hat. At its \
center sits a supermassive black hole of ~1 billion solar masses, among the largest \
for a galaxy this size. A spiral/lenticular transitional type at the Sa/S0 boundary.",
        "fact_uk": "Гало й пиловий диск створюють вигляд капелюха. Чорна діра ~1 млрд M☉ у центрі.",
        "fact_en": "Halo + dust disk make the hat shape. Central black hole ~1 billion M☉.",
    },
    {
        "key": "centaurus-a", "slug": "centaurus-a", "category": "peculiar",
        "designation": "NGC 5128",
        "name_uk": "Центавр A", "name_en": "Centaurus A",
        "dist_text_uk": "12 млн св. р.", "dist_text_en": "12 Mly",
        "dist_ly": 12_000_000, "diameter_ly": "~60 000 св. р.", "magnitude": "6.8m",
        "ra": 201.3651, "dec": -43.0191, "nasa_query": "Centaurus A galaxy",
        "description_uk": "Одна з найяскравіших радіогалактик усього неба — пекулярна \
лінзоподібна галактика, що ховає під собою наслідки нещодавнього злиття \
з великою спіральною галактикою. Кривава пилова смуга, що перетинає диск, \
— залишок поглиненої галактики. Активна чорна діра в центрі живить потужні \
релятивістські джети, видимі в радіо- та рентгенівському діапазоні.",
        "description_en": "One of the brightest radio galaxies in the sky — a peculiar lenticular \
hiding the aftermath of a recent merger with a large spiral. The skewed dust band \
across the disk is the remnant of the swallowed galaxy. An active central black hole \
powers relativistic jets visible in radio and X-ray.",
        "fact_uk": "Найяскравіша радіогалактика неба — наслідок злиття, що живить активну чорну діру.",
        "fact_en": "Sky's brightest radio galaxy — a merger feeding an active black hole.",
    },
    {
        "key": "pinwheel", "slug": "pinwheel-m101", "category": "spiral",
        "designation": "M101 / NGC 5457",
        "name_uk": "Вітрячок", "name_en": "Pinwheel",
        "dist_text_uk": "21 млн св. р.", "dist_text_en": "21 Mly",
        "dist_ly": 21_000_000, "diameter_ly": "~170 000 св. р.", "magnitude": "7.9m",
        "ra": 210.8025, "dec": 54.3489, "nasa_query": "Pinwheel Galaxy",
        "description_uk": "Галактика обличчям до нас — великий, грандіозний спіральний диск \
діаметром близько 170 000 світлових років, фізично більший за Чумацький Шлях, \
хоча й менш масивний. Асиметрична форма спричинена гравітаційним впливом \
сусідніх карликових галактик. Насичена зонами зореутворення, що світяться \
рожевим від іонізованого водню.",
        "description_en": "A face-on grand-design spiral — a disk ~170,000 light-years across, \
physically larger than the Milky Way though less massive. Its asymmetric shape is \
caused by the gravity of neighboring dwarf galaxies. Rich in star-forming regions \
that glow pink from ionized hydrogen.",
        "fact_uk": "Фізично більша за Чумацький Шлях, попри меншу масу; асиметрія від сусідів-карликів.",
        "fact_en": "Physically larger than the Milky Way despite less mass; asymmetry from dwarf neighbors.",
    },
    {
        "key": "cigar", "slug": "cigar-m82", "category": "irregular",
        "designation": "M82 / NGC 3034",
        "name_uk": "Сигара", "name_en": "Cigar",
        "dist_text_uk": "12 млн св. р.", "dist_text_en": "12 Mly",
        "dist_ly": 12_000_000, "diameter_ly": "~37 000 св. р.", "magnitude": "8.4m",
        "ra": 148.9683, "dec": 69.6797, "nasa_query": "Cigar Galaxy M82",
        "description_uk": "Спалахуюча зоряноутворювальна галактика (starburst): темп \
народження нових зір тут вдесятеро вищий за звичайні галактики — наслідок \
щільної гравітаційної взаємодії з сусідньою M81. Потужний галактичний вітер \
із гарячого газу видно в рентгенівських і радіо променях; витягнута форма \
дала галактиці її ім'я.",
        "description_en": "A starburst galaxy: star formation runs at ten times the normal rate — \
the result of a tight gravitational encounter with neighbor M81. A powerful galactic \
wind of hot gas shows up in X-ray and radio; the elongated shape gives the galaxy \
its name.",
        "fact_uk": "Темп зореутворення ×10 через взаємодію з M81; галактичний вітер видно в рентгені.",
        "fact_en": "Star formation ×10 from interaction with M81; galactic wind visible in X-ray.",
    },
    {
        "key": "black-eye", "slug": "black-eye-m64", "category": "spiral",
        "designation": "M64 / NGC 4826",
        "name_uk": "Чорне Око", "name_en": "Black Eye",
        "dist_text_uk": "17 млн св. р.", "dist_text_en": "17 Mly",
        "dist_ly": 17_000_000, "diameter_ly": "~54 000 св. р.", "magnitude": "8.5m",
        "ra": 194.1823, "dec": 21.6831, "nasa_query": "Black Eye Galaxy",
        "description_uk": "Темна пилова смуга поглинання перед яскравим ядром дала галактиці \
її назву. Найцікавіше — внутрішній і зовнішній газ обертаються у протилежних \
напрямках, що є наслідком давнього злиття з іншою галактикою: зорі в диску \
рухаються разом з внутрішнім газом, а зовнішній газ ще зберіг обертання \
поглиненої галактики.",
        "description_en": "A dark dust lane in front of the bright nucleus gives the galaxy its name. \
Most intriguingly, the inner and outer gas rotate in opposite directions — the \
aftermath of an ancient merger: disk stars co-rotate with the inner gas, while the \
outer gas still retains the swallowed galaxy's rotation.",
        "fact_uk": "Внутрішній і зовнішній газ обертаються протилежно — наслідок давнього злиття.",
        "fact_en": "Inner and outer gas rotate oppositely — a fingerprint of an ancient merger.",
    },
    {
        "key": "antennae", "slug": "antennae", "category": "peculiar",
        "designation": "NGC 4038 / 4039",
        "name_uk": "Антени", "name_en": "Antennae",
        "dist_text_uk": "45–65 млн св. р.", "dist_text_en": "45–65 Mly",
        "dist_ly": 55_000_000, "diameter_ly": "~130 000 св. р. (разом)", "magnitude": "10.3m",
        "ra": 180.4751, "dec": -18.8678, "nasa_query": "Antennae Galaxies",
        "description_uk": "Дві спіральні галактики в самому розпалі повного злиття — один із \
найближчих і найяскравіших прикладів галактичного зіткнення. Припливні сили \
викинули довгі хвости зір і газу, що нагадують вусики комахи, — звідси й назва. \
У зонах зіткнення газових хмар спалахує бурхливе зореутворення, що видно \
яскраво-рожевими вузлами.",
        "description_en": "Two spiral galaxies in the full throes of merging — one of the nearest and \
brightest examples of a galactic collision. Tidal forces flung long tails of stars and \
gas resembling insect antennae — hence the name. Where gas clouds collide, violent \
star formation erupts as bright pink knots.",
        "fact_uk": "Дві галактики зливаються; припливні хвости зір нагадують антени комахи.",
        "fact_en": "Two galaxies merging; tidal tails of stars resemble insect antennae.",
    },
    {
        "key": "cartwheel", "slug": "cartwheel", "category": "peculiar",
        "designation": "ESO 350-40",
        "name_uk": "Колесо", "name_en": "Cartwheel",
        "dist_text_uk": "~500 млн св. р.", "dist_text_en": "~500 Mly",
        "dist_ly": 500_000_000, "diameter_ly": "~150 000 св. р.", "magnitude": "15.2m",
        "ra": 18.61, "dec": -33.7942, "nasa_query": "Cartwheel Galaxy",
        "description_uk": "Кільцева галактика на відстані близько 500 мільйонів світлових років — \
її характерна форма утворилася після майже лобового зіткнення з меншою \
галактикою: ударна хвиля зореутворення розійшлася назовні, як кола на воді, \
залишивши яскраве кільце молодих зір навколо тихого ядра. З часом диск \
знову набуде звичайної спіральної форми.",
        "description_en": "A ring galaxy about 500 million light-years away — its signature shape \
formed after a near head-on collision with a smaller galaxy: a shock wave of star \
formation spread outward like ripples, leaving a bright ring of young stars around a \
quiet core. Over time the disk will settle back into an ordinary spiral.",
        "fact_uk": "Кільцева форма після лобового зіткнення — хвиля зореутворення розійшлась як кола на воді.",
        "fact_en": "Ring shape from a head-on collision — a star-formation wave spread like ripples.",
    },
    {
        "key": "lmc", "slug": "large-magellanic-cloud", "category": "irregular",
        "designation": "LMC",
        "name_uk": "Велика Магелланова Хмара", "name_en": "Large Magellanic Cloud",
        "dist_text_uk": "~160 000 св. р.", "dist_text_en": "~160 kly",
        "dist_ly": 160_000, "diameter_ly": "~14 000 св. р.", "magnitude": "0.9m",
        "ra": 80.8942, "dec": -69.7561, "nasa_query": "Large Magellanic Cloud",
        "description_uk": "Неправильна галактика-супутник Чумацького Шляху, видима неозброєним \
оком лише з південної півкулі — одна з найближчих до нас галактик. У 1987 році \
у ній спалахнула Наднова 1987A — найяскравіша наднова за майже 400 років, \
яка дала астрономам рідкісну можливість вивчити вибух зірки зблизька. \
Містить зону зореутворення 30 Doradus (Тарантул) — найактивнішу \
в Місцевій групі.",
        "description_en": "An irregular satellite galaxy of the Milky Way, visible to the naked eye only \
from the Southern Hemisphere — one of the closest galaxies to us. In 1987 it hosted \
Supernova 1987A, the brightest supernova in nearly 400 years, giving astronomers a \
rare close-up of a stellar explosion. It contains the 30 Doradus (Tarantula) starburst \
region — the most active star-forming zone in the Local Group.",
        "fact_uk": "Видима неозброєним оком з півдня; SN 1987A — найяскравіша наднова за 400 років.",
        "fact_en": "Naked-eye from the south; SN 1987A — brightest supernova in 400 years.",
    },
]

# Order of the curated list = display order.
GALAXY_BY_SLUG: dict[str, dict] = {g["slug"]: g for g in GALAXIES}
GALAXY_BY_KEY: dict[str, dict] = {g["key"]: g for g in GALAXIES}

# ---------------------------------------------------------------------------
# NED TAP — redshift + type by position box search.
# ---------------------------------------------------------------------------
NED_TAP_URL = "https://ned.ipac.caltech.edu/tap/sync"
_NED_BOX = 0.03  # degrees half-width — tight enough to grab the galaxy, not its neighbors
_NED_TIMEOUT = 25
_NED_UA = "NEOwatchBot/1.0 (galaxies; +https://github.com/)"


def _ned_for(ra: float, dec: float) -> Optional[tuple]:
    """NED redshift + physical type + preferred name for the galaxy at (ra, dec).

    Does a small RA/Dec box search on ``NEDTAP.objdir`` filtered to galaxy-like
    types and returns the row closest to the queried center. Returns ``None`` on
    any failure or empty result. Best-effort — never raises.
    """
    if ra is None or dec is None:
        return None
    # Milky Way: NED has no normal objdir entry for our own galaxy.
    try:
        adql = (
            "SELECT prefname, ra, dec, z, prefphytype FROM NEDTAP.objdir "
            "WHERE ra BETWEEN {} AND {} AND dec BETWEEN {} AND {} "
            "AND prefphytype IN ('G','GPair','GTrpl','GIrr','QSO','AGN','RadioG') "
            "ORDER BY zflag DESC"
        ).format(ra - _NED_BOX, ra + _NED_BOX, dec - _NED_BOX, dec + _NED_BOX)
        resp = requests.get(
            NED_TAP_URL,
            params={"request": "doQuery", "lang": "ADQL", "format": "json", "query": adql},
            timeout=_NED_TIMEOUT, headers={"User-Agent": _NED_UA},
        )
        if resp.status_code != 200:
            logger.warning("NED TAP %s/%s -> %s", ra, dec, resp.status_code)
            return None
        data = resp.json().get("data") or []
        if not data:
            return None
        # Pick the row nearest the queried center (faint SN-host aliases sit at
        # nearly the same coords; the nearest is the galaxy itself).
        best = min(
            data,
            key=lambda r: (float(r[1]) - ra) ** 2 + (float(r[2]) - dec) ** 2,
        )
        z = best[3]
        return {
            "redshift": float(z) if z is not None else None,
            "ned_type": best[4] or None,
            "ned_prefname": best[0] or None,
        }
    except Exception as e:  # noqa: BLE001 — best-effort
        logger.warning("NED lookup for %s/%s failed: %s", ra, dec, e)
        return None


# ---------------------------------------------------------------------------
# NASA Image and Video Library — photos per galaxy.
# ---------------------------------------------------------------------------
NASA_IMAGE_SEARCH = "https://images-api.nasa.gov/search"
NASA_ASSET_BASE = "https://images-assets.nasa.gov/image"
_NASA_TIMEOUT = 25
_NASA_UA = "NEOwatchBot/1.0 (galaxies; +https://github.com/)"
PHOTO_CAP = 24  # max photos mirrored per galaxy


def _asset_url(nasa_id: str, size: str) -> str:
    """Build an image-asset URL for a given size (small/medium/large/orig)."""
    return f"{NASA_ASSET_BASE}/{nasa_id}/{nasa_id}~{size}.jpg"


def _photo_score(item: dict, query: str) -> int:
    """Heuristic: prefer optical Hubble/Webb shots of the galaxy itself."""
    d = (item.get("data") or [{}])[0]
    title = (d.get("title") or "").lower()
    desc = (d.get("description") or "").lower()
    keys = (d.get("keywords") or [])
    kstr = " ".join(keys).lower()
    blob = f"{title} {desc} {kstr}"
    score = 0
    if any(k in blob for k in ("hubble", "hst", "jwst", "webb", "eso", "noao")):
        score += 3  # optical / iconic imaging
    # Galaxy common-name words from the query.
    for w in (query or "").lower().split():
        if len(w) > 3 and w in blob:
            score += 2
            break
    if any(k in blob for k in ("chart", "map", "diagram", "schematic", "plot", "table")):
        score -= 3  # not a photo
    if any(k in blob for k in ("artist", "concept", "illustration")):
        score -= 1
    return score


def _nasa_photos(query: str, cap: int = PHOTO_CAP) -> list[dict]:
    """Fetch up to ``cap`` image results from the NASA Image Library for ``query``.

    Returns a list of dicts ``{nasa_id, title, description, credit, date_created,
    orig_url, thumb_url}`` sorted by the optical-relevance heuristic. ``orig_url``
    is the ``~large`` asset (good balance for the lightbox); ``thumb_url`` is the
    ``~medium`` asset (downloaded + re-sized locally by ``galaxy_images``).
    Best-effort: returns ``[]`` on any failure.
    """
    if not query:
        return []
    try:
        resp = requests.get(
            NASA_IMAGE_SEARCH,
            params={"q": query, "media_type": "image"},
            timeout=_NASA_TIMEOUT, headers={"User-Agent": _NASA_UA},
        )
        if resp.status_code != 200:
            logger.warning("NASA image search %r -> %s", query, resp.status_code)
            return []
        items = resp.json().get("collection", {}).get("items", []) or []
    except Exception as e:  # noqa: BLE001 — best-effort
        logger.warning("NASA image search %r failed: %s", query, e)
        return []

    out: list[dict] = []
    for it in items:
        data = (it.get("data") or [{}])[0]
        nasa_id = data.get("nasa_id")
        if not nasa_id:
            continue
        links = it.get("links") or []
        # The provided link is normally ~medium.jpg; we derive large/medium ourselves.
        out.append({
            "nasa_id": nasa_id,
            "title": (data.get("title") or "").strip(),
            "description": (data.get("description") or "").strip(),
            "credit": (data.get("secondary_creator") or "").strip() or None,
            "date_created": (data.get("date_created") or "").strip() or None,
            "orig_url": _asset_url(nasa_id, "large"),
            "thumb_url": _asset_url(nasa_id, "medium"),
            "_score": _photo_score(it, query),
        })
    out.sort(key=lambda p: p["_score"], reverse=True)
    for p in out:
        p.pop("_score", None)
    return out[:cap]


# ---------------------------------------------------------------------------
# Builders that merge catalog + live data → ingest-ready records.
# ---------------------------------------------------------------------------
def build_galaxy_records() -> list[dict]:
    """Return the 12 catalog rows enriched with live NED redshift + type.

    Curated fields are copied verbatim; ``redshift`` / ``ned_type`` /
    ``ned_prefname`` come from NED (``None`` if NED is unreachable for that
    galaxy). The Milky Way skips NED (no normal objdir entry). Never raises.
    """
    records: list[dict] = []
    for g in GALAXIES:
        rec = dict(g)
        ned = None if g["key"] == "milky-way" else _ned_for(g["ra"], g["dec"])
        rec["redshift"] = ned["redshift"] if ned else None
        rec["ned_type"] = ned["ned_type"] if ned else None
        rec["ned_prefname"] = ned["ned_prefname"] if ned else None
        records.append(rec)
    return records


def build_galaxy_photos(key: str, query: str, cap: int = PHOTO_CAP) -> list[dict]:
    """Return up to ``cap`` NASA photos for one galaxy, ingest-ready (no paths)."""
    return _nasa_photos(query, cap=cap)