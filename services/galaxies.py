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
        "ra": 266.4167, "dec": -29.0078, "nasa_query": "Milky Way airglow",
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
        "ra": 10.6847, "dec": 41.26875, "nasa_query": "Andromeda Galaxy Hubble",
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
    {
        "key": "bodes", "slug": "bodes-m81", "category": "spiral",
        "designation": "M81 / NGC 3031",
        "name_uk": "Галактика Боде", "name_en": "Bode's Galaxy",
        "dist_text_uk": "12 млн св. р.", "dist_text_en": "12 Mly",
        "dist_ly": 12_000_000, "diameter_ly": "~90 000 св. р.", "magnitude": "6.9m",
        "ra": 148.8882, "dec": 69.0653, "nasa_query": "M81 galaxy",
        "description_uk": "Велика спіральна галактика в сузір'ї Великої Ведмедиці, відкрита Йоганном Боде у 1774 році. Завдяки близькому розташуванню до Землі та високій яскравості є популярним об'єктом для аматорських спостережень. Має чітку симетричну спіральну структуру та надмасивну чорну діру в центрі масою близько 70 мільйонів мас Сонця.",
        "description_en": "A grand design spiral galaxy in the constellation Ursa Major, discovered by Johann Bode in 1774. Due to its proximity to Earth and high brightness, it is a popular target for amateur astronomers. It features a nearly perfect symmetric spiral structure and hosts a central supermassive black hole of about 70 million solar masses.",
        "fact_uk": "Майже ідеальна симетрична спіральна структура, відкрита Йоганном Боде в 1774 році.",
        "fact_en": "A nearly perfect symmetric spiral structure, discovered by Johann Bode in 1774.",
    },
    {
        "key": "m87", "slug": "m87", "category": "elliptical",
        "designation": "M87 / NGC 4486",
        "name_uk": "Мессьє 87", "name_en": "Messier 87",
        "dist_text_uk": "53 млн св. р.", "dist_text_en": "53 Mly",
        "dist_ly": 53_000_000, "diameter_ly": "~120 000 св. р.", "magnitude": "8.6m",
        "ra": 187.7059, "dec": 12.3911, "nasa_query": "M87 galaxy",
        "description_uk": "Гігантська еліптична галактика в сузір'ї Діви, одна з наймасивніших галактик у нашому космічному надскупченні. Саме в її центрі розташована надмасивна чорна діра масою 6,5 мільярда мас Сонця, яка стала першою в історії чорною дірою, чиє зображення вдалося отримати проекту Event Horizon Telescope. Галактика також відома потужним релятивістським джетом плазми, що виривається з її центра.",
        "description_en": "A supergiant elliptical galaxy in the constellation Virgo, one of the most massive galaxies in our local universe. Its core hosts a supermassive black hole of 6.5 billion solar masses, which became the first black hole in history to be imaged by the Event Horizon Telescope. It is also famous for a prominent relativistic plasma jet ejecting from its active core.",
        "fact_uk": "Перша в історії чорна діра, яку сфотографували (маса ~6.5 млрд M☉); потужний релятивістський джет.",
        "fact_en": "First black hole ever directly imaged (~6.5 billion M☉); features a powerful relativistic jet.",
    },
    {
        "key": "ngc-1300", "slug": "ngc-1300", "category": "spiral",
        "designation": "NGC 1300",
        "name_uk": "NGC 1300", "name_en": "NGC 1300",
        "dist_text_uk": "61 млн св. р.", "dist_text_en": "61 Mly",
        "dist_ly": 61_000_000, "diameter_ly": "~110 000 св. р.", "magnitude": "10.4m",
        "ra": 49.921, "dec": -19.411, "nasa_query": "NGC 1300",
        "description_uk": "Еталонна спіральна галактика з перемичкою в сузір'ї Ерідана. Її виразна S-подібна спіральна структура зробила її одним із найвідоміших об'єктів для вивчення динамики спіральних галактик з перемичкою. У центрі галактики знаходиться надмасивна чорна діра масою близько 7 мільйонів мас Сонця.",
        "description_en": "A textbook barred spiral galaxy in the constellation Eridanus. Its striking S-shaped spiral structure has made it one of the most studied examples of barred spiral dynamics. Its core hosts a supermassive black hole of about 7 million solar masses.",
        "fact_uk": "Еталон спіральної галактики з перемичкою — класичний зразок S-подібної структури.",
        "fact_en": "A textbook barred spiral — the classic example of an S-shaped spiral structure.",
    },
    {
        "key": "m106", "slug": "m106", "category": "spiral",
        "designation": "M106 / NGC 4258",
        "name_uk": "Мессьє 106", "name_en": "Messier 106",
        "dist_text_uk": "24 млн св. р.", "dist_text_en": "24 Mly",
        "dist_ly": 24_000_000, "diameter_ly": "~135 000 св. р.", "magnitude": "8.4m",
        "ra": 184.7396, "dec": 47.3038, "nasa_query": "M106 galaxy",
        "description_uk": "Спіральна галактика з активним ядром (сейфертовська) у сузір'ї Гончих Псів. Одна з найбільших й найяскравіших галактик у групі М106. Вона має два аномальні радіоспіральні рукави, що складаються з релятивістського газу, ймовірно викинутого струменем надмасивної чорної діри в її центрі.",
        "description_en": "A spiral galaxy with an active Seyfert nucleus in Canes Venatici. One of the largest and brightest members of the M106 group. It has two anomalous radio spiral arms made of relativistic gas, likely ejected by the jet of its central supermassive black hole.",
        "fact_uk": "Має аномальні радіоспіральні рукави — релятивістський газ із джету чорної діри.",
        "fact_en": "Hosts anomalous radio spiral arms — relativistic gas from its black hole's jet.",
    },
    {
        "key": "m74", "slug": "m74", "category": "spiral",
        "designation": "M74 / NGC 628",
        "name_uk": "Мессьє 74", "name_en": "Messier 74",
        "dist_text_uk": "32 млн св. р.", "dist_text_en": "32 Mly",
        "dist_ly": 32_000_000, "diameter_ly": "~95 000 св. р.", "magnitude": "9.7m",
        "ra": 24.174, "dec": 15.783, "nasa_query": "M74 galaxy",
        "description_uk": "Гранд-дизайн спіральна галактика в сузір'ї Риб, обличчям до Землі. Її майже ідеально симетричні спіральні рукави, в яких активно утворюються зорі, роблять її одним із найефектніших зразків спіральних галактик. Розсіяний блиск робить її помітною лише в темному небі.",
        "description_en": "A grand design spiral galaxy in Pisces, seen face-on. Its nearly perfectly symmetric, actively star-forming spiral arms make it one of the finest examples of a spiral galaxy. Its diffuse glow makes it a challenge except under a dark sky.",
        "fact_uk": "Гранд-дизайн спіраль обличчям до нас — один із найсиметричніших зразків.",
        "fact_en": "A face-on grand design spiral — one of the most symmetric examples known.",
    },
    {
        "key": "ngc-4565", "slug": "ngc-4565", "category": "spiral",
        "designation": "NGC 4565 / Caldwell 38",
        "name_uk": "Голкова галактика", "name_en": "Needle Galaxy",
        "dist_text_uk": "40 млн св. р.", "dist_text_en": "40 Mly",
        "dist_ly": 40_000_000, "diameter_ly": "~150 000 св. р.", "magnitude": "10.0m",
        "ra": 189.0864, "dec": 25.9876, "nasa_query": "NGC 4565",
        "description_uk": "Голкова галактика — спіральна галактика з ребра у сузір'ї Волосся Вероніки. Її вузький, витягнутий профіль з темною пиловою смугою, що перетинає диск, нагадує голку, звідки й назва. За розміром вона більша за Чумацький Шлях.",
        "description_en": "The Needle Galaxy — an edge-on spiral in Coma Berenices. Its narrow, elongated profile with a dark dust lane cutting across the disk gives it a needle-like shape and its name. It is larger than the Milky Way.",
        "fact_uk": "Видна з ребра, з чіткою темною пиловою смугою; більша за Чумацький Шлях.",
        "fact_en": "Seen edge-on with a sharp dust lane; larger than the Milky Way.",
    },
    {
        "key": "ngc-2207", "slug": "ngc-2207", "category": "peculiar",
        "designation": "NGC 2207 / IC 2163",
        "name_uk": "NGC 2207 та IC 2163", "name_en": "NGC 2207 & IC 2163",
        "dist_text_uk": "80 млн св. р.", "dist_text_en": "80 Mly",
        "dist_ly": 80_000_000, "diameter_ly": "~120 000 св. р.", "magnitude": "12.2m",
        "ra": 93.7446, "dec": -21.2267, "nasa_query": "NGC 2207",
        "description_uk": "Пара взаємодіючих спіральних галактик у сузір'ї Великого Пса. Їхня гравітаційна боротьба вже виправила рукави IC 2163 у вигляді припливних хвостів та очей, а згодом вони зольються в одну еліптичну галактику. У них спостерігається висока активність зореутворення.",
        "description_en": "A pair of interacting spiral galaxies in Canis Major. Their gravitational tug has already bent IC 2163's arms into tidal tails and eyelid shapes, and they will eventually merge into a single elliptical galaxy. They show intense star formation.",
        "fact_uk": "Припливні «очі» та хвости від гравітаційної взаємодії; зореутворення вибухнуло.",
        "fact_en": "Tidal 'eyelids' and tails from the gravitational encounter; star formation has ignited.",
    },
    {
        "key": "arp-273", "slug": "arp-273", "category": "peculiar",
        "designation": "Arp 273 / UGC 1810+1813",
        "name_uk": "Арп 273", "name_en": "Arp 273",
        "dist_text_uk": "300 млн св. р.", "dist_text_en": "300 Mly",
        "dist_ly": 300_000_000, "diameter_ly": "~100 000 св. р.", "magnitude": "13.5m",
        "ra": 32.7075, "dec": 39.2589, "nasa_query": "Arp 273",
        "description_uk": "Арп 273 — взаємодіюча пара галактик у сузір'ї Андромеди, відзначена Гальтоном Арпом у його атласі пекулярних галактик. Велика спіраль UGC 1810, деформована меншою UGC 1813, утворює форму рози — звідси її поетична назва «Галактична троянда».",
        "description_en": "Arp 273 is an interacting pair of galaxies in Andromeda, catalogued by Halton Arp in his atlas of peculiar galaxies. The larger spiral UGC 1810, distorted by the smaller UGC 1813, forms a rose-like shape — hence its poetic name 'Galactic Rose'.",
        "fact_uk": "«Галактична троянда» — спіраль, деформована в форма квітки гравітацією сусідки.",
        "fact_en": "The 'Galactic Rose' — a spiral bent into a flower shape by a neighbour's gravity.",
    },
    {
        "key": "stephans-quintet", "slug": "stephans-quintet", "category": "peculiar",
        "designation": "Hickson 92 / NGC 7317–7320",
        "name_uk": "Квінтет Стефана", "name_en": "Stephan's Quintet",
        "dist_text_uk": "290 млн св. р.", "dist_text_en": "290 Mly",
        "dist_ly": 290_000_000, "diameter_ly": "~140 000 св. р.", "magnitude": "13.4m",
        "ra": 339.149, "dec": 33.967, "nasa_query": "Stephans Quintet",
        "description_uk": "Квінтет Стефана — щільна група з п'яти галактик у сузір'ї Пегаса, відкрита Едуаром Стефаном 1877 року. Чотири з них фізично взаємодіють на відстані ~290 млн св. р., а NGC 7320 — набагато ближчий прийшлець на передньому плані (~40 млн св. р.). Їхні зіткнення породжують гігантські шокові хвилі водню.",
        "description_en": "Stephan's Quintet is a compact group of five galaxies in Pegasus, discovered by Édouard Stephan in 1877. Four of them physically interact at ~290 Mly, while NGC 7320 is a much closer foreground interloper (~40 Mly). Their collisions drive enormous hydrogen shock waves.",
        "fact_uk": "Перша відкрита щільна група галактик (1877); шокові хвилі від їхніх зіткнень.",
        "fact_en": "The first compact galaxy group ever found (1877); shock waves from their collisions.",
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
    """Heuristic: prefer real photos of the queried subject.

    The strongest signal is the subject's name appearing in the image's own
    *title* — NASA Image Library search surfaces many tangentially-keyworded
    items (e.g. a "Monitoring the Arctic" Earth photo keyed to "Milky Way", or
    a "History of Hubble" documentary) that match the query in keywords but
    don't depict it. A title match (+5) dominates the optical-imaging bonus
    (+2 for Hubble/Webb/ESO/NOAO) so those off-topic items no longer outrank
    genuine photos. Query words >=3 chars minus generic stop words ("galaxy",
    "the", ...) so Messier designations like "m33"/"m81" still match.
    """
    d = (item.get("data") or [{}])[0]
    title = (d.get("title") or "").lower()
    desc = (d.get("description") or "").lower()
    keys = d.get("keywords") or []
    kstr = " ".join(keys).lower()
    blob = f"{title} {desc} {kstr}"
    _STOP = {
        "galaxy", "galaxies", "the", "and", "for", "of", "in", "a", "at",
        "by", "near", "imaged", "image", "images", "space", "way",
    }
    qwords = [w for w in (query or "").lower().split() if len(w) >= 3 and w not in _STOP]
    score = 0
    # Subject named in the title — the image actually depicts/labels it.
    score += 5 * sum(1 for w in qwords if w in title)
    # Optical telescope imaging bonus (lighter, so a title match dominates).
    if any(k in blob for k in ("hubble", "hst", "jwst", "webb", "eso", "noao")):
        score += 2
    # Subject mentioned anywhere (description / keywords).
    for w in qwords:
        if w in blob:
            score += 1
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


# Wikimedia Commons category per galaxy (the primary photo source — far more
# precise than NASA Image Library keyword search; every file in a curated
# ``Category:<Galaxy>`` genuinely depicts that object). None → NASA fallback.
COMMONS_CATEGORY = {
    "milky-way": "Milky Way Galaxy",
    "andromeda": "Andromeda Galaxy",
    "triangulum": "Triangulum Galaxy",
    "whirlpool": "Whirlpool Galaxy",
    "sombrero": "Sombrero Galaxy",
    "centaurus-a": "Centaurus A",
    "pinwheel": "Pinwheel Galaxy",
    "cigar": "Messier 82",        # "Cigar Galaxy" is a redirect; canonical cat is M82
    "black-eye": "Black Eye Galaxy",
    "antennae": "Antennae Galaxies",
    "cartwheel": "Cartwheel Galaxy",
    "lmc": "Large Magellanic Cloud",
    "bodes": "Messier 81",
    "m87": "Messier 87",
    "ngc-1300": "NGC 1300",
    "m106": "Messier 106",
    "m74": "Messier 74",
    "ngc-4565": "NGC 4565",
    "ngc-2207": "NGC 2207",
    "arp-273": "Arp 273",
    "stephans-quintet": "Stephan's Quintet",
}


def build_galaxy_photos(key: str, query: str, cap: int = PHOTO_CAP) -> list[dict]:
    """Return up to ``cap`` photos for one galaxy, ingest-ready (no paths).

    Prefers Wikimedia Commons (curated per-galaxy categories — real photos of
    the actual object, including M64/Black Eye which NASA Image Library lacks).
    Falls back to the NASA Image Library keyword search if Commons is empty or
    the galaxy has no category mapped. ``query`` is the NASA fallback term.
    """
    from .galaxy_commons import build_commons_photos
    cat = COMMONS_CATEGORY.get(key)
    if cat:
        photos = build_commons_photos(cat, cap=cap)
        if photos:
            return photos
        logger.info("commons empty for %r (%s) -> NASA fallback", key, cat)
    return _nasa_photos(query, cap=cap)


# ---------------------------------------------------------------------------
# Constellation + best-viewing month (RA/Dec → IAU constellation via skyfield).
#
# Unlike the planets service, this does NOT need the de440s.bsp ephemeris —
# skyfield's ``position_of_radec`` builds an ICRF position from RA/Dec directly
# and ``load_constellation_map()`` resolves it. Only the small timescale +
# constellation-table files download (into ``data/``), cached in ``_SKY``.
# ---------------------------------------------------------------------------
_SKY = None  # (cm, latin) cached lazily


def _sky():
    global _SKY
    if _SKY is None:
        from skyfield.api import load, load_constellation_map, load_constellation_names
        from skyfield.positionlib import position_of_radec
        cm = load_constellation_map()
        latin = dict(load_constellation_names())
        _SKY = (cm, latin, position_of_radec, load.timescale())
    return _SKY


def galaxy_constellation(ra, dec):
    """IAU 3-letter constellation abbreviation for a J2000 RA/Dec (degrees).

    Returns ``None`` on any failure (the page still renders without it).
    """
    if ra is None or dec is None:
        return None
    try:
        cm, _latin, position_of_radec, ts = _sky()
        pos = position_of_radec(float(ra) / 15.0, float(dec), epoch=ts.J(2000.0))
        return str(cm(pos))
    except Exception as e:  # noqa: BLE001 — best-effort
        logger.warning("galaxy_constellation(%s,%s) failed: %s", ra, dec, e)
        return None


def best_month_from_ra(ra):
    """Best naked-eye viewing month (1–12) for an object at RA ``ra`` deg.

    An object culminates around local midnight when the Sun is opposite it in
    RA. The Sun is at RA≈0 at the March equinox (~day 79 of the year), so the
    best day = 79 + ((ra+180)%360)/360·365.25, mapped to a month index.
    """
    if ra is None:
        return None
    try:
        day = (79.0 + (((float(ra) + 180.0) % 360.0) / 360.0) * 365.25) % 365.25
        # 1-based month: day-of-year → month (mid-month thresholds)
        thresholds = [0, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335, 366]
        for m in range(1, 13):
            if day < thresholds[m]:
                return m
        return 12
    except Exception:  # noqa: BLE001
        return None