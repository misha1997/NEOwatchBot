"""Random space facts — bilingual curated list."""
import random
from utils.i18n import DEFAULT_LANG

# Self-contained one-liner facts per language. Each entry is shown verbatim,
# so they may carry emoji and light HTML. Keep them short (≤ ~300 chars).
FACTS = {
    'uk': [
        "🌌 Один день на Венері довший за її рік: вона обертається навколо своєї осі 243 земних дні, а навколо Сонця — лише 225.",
        "🌑 Місяць віддаляється від Землі зі швидкістю ~3,8 см на рік через припливні сили.",
        "🪐 На Юпітері та Сатурні може йти дощ із рідких алмазів — вуглець під тиском їхніх атмосфер перетворюється на діамант.",
        "☄️ Хвіст комети завжди спрямований від Сонця, незалежно від того, куди летить сама комета.",
        "🛰️ МКС летить зі швидкістю ~27 600 км/год і робить оберт навколо Землі за ~90 хвилин.",
        "⭐ Маса Сонця становить 99,86% маси всієї Сонячної системи.",
        "🚀 Світло від Сонця долає шлях до Землі за ~8 хвилин 20 секунд.",
        "🔴 Марс має найвищу гору Сонячної системи — Олімп, ~22 км (втричі вищу за Еверест).",
        "🧊 Кільце Сатурна насправді складається з мільярдів шматків льоду та каміння, від пилу до кількох метрів.",
        "🌠 Метеор, який ти бачиш, — це частинка розміром із піщинку, що згорає в атмосфері.",
        "🌑 У космосі є повна тиша, адже там немає повітря, яке переносило б звук.",
        "🛰️ Voyager 1, запущений 1977 року, — найдальший рукотворний об'єкт: він уже в міжзоряному просторі.",
        "🪐 На Нептуні дмуть найшвидші вітри Сонячної системи — до 2 100 км/год.",
        "🌕 Якби Земля була розміром із бильце, Місяць був би зернятком рису за ~30 см від неї.",
        "🌟 Світло від найближчої зорі, Проксими Центавра, іде до нас понад 4 роки.",
        "☄️ Пояс Койпера починається за орбітою Нептуна і містить сотні тисяч крижаних об'єктів.",
        "🚀 Щоб покинути Землю, космічний апарат має розвинути швидкість ~11 км/с (друга космічна).",
        "🛰️ За оцінками, на орбіті Землі — понад 36 000 об'єктів сміття розміром понад 10 см.",
        "🌑 Чорні діри настільки щільні, що світло не може вирватися з-під їхнього горизонту подій.",
        "🪐 Уран обертається «на боці» — його вісь нахилена на 98°, і кожен полюс отримує 42 роки сонця, потім 42 роки темряви.",
    ],
    'en': [
        "🌌 One day on Venus is longer than its year: it spins on its axis in 243 Earth days but orbits the Sun in just 225.",
        "🌑 The Moon drifts away from Earth by ~3.8 cm per year due to tidal forces.",
        "🪐 On Jupiter and Saturn it may rain liquid diamonds — carbon under their atmospheric pressure turns into diamond.",
        "☄️ A comet's tail always points away from the Sun, regardless of which way the comet is flying.",
        "🛰️ The ISS travels at ~27,600 km/h and orbits Earth in about 90 minutes.",
        "⭐ The Sun holds 99.86% of the entire Solar System's mass.",
        "🚀 Sunlight takes about 8 minutes 20 seconds to reach Earth.",
        "🔴 Mars hosts the Solar System's tallest mountain — Olympus Mons, ~22 km (three times Everest).",
        "🧊 Saturn's rings are made of billions of ice and rock pieces, from dust to a few metres across.",
        "🌠 The meteor you see is a sand-grain-sized particle burning up in the atmosphere.",
        "🌑 Space is completely silent — no air means no sound to carry.",
        "🛰️ Voyager 1, launched in 1977, is the farthest human-made object — now in interstellar space.",
        "🪐 Neptune has the fastest winds in the Solar System — up to 2,100 km/h.",
        "🌕 If Earth were the size of a basketball, the Moon would be a grain of rice ~30 cm away.",
        "🌟 Light from our nearest star, Proxima Centauri, takes over 4 years to reach us.",
        "☄️ The Kuiper Belt begins beyond Neptune and holds hundreds of thousands of icy bodies.",
        "🚀 To leave Earth, a spacecraft must reach ~11 km/s (escape velocity).",
        "🛰️ An estimated 36,000+ pieces of debris larger than 10 cm orbit the Earth.",
        "🌑 Black holes are so dense that light cannot escape past their event horizon.",
        "🪐 Uranus rotates on its side — its axis is tilted 98°, so each pole gets 42 years of sunlight, then 42 of darkness.",
    ],
}


class RandomFact:
    """Return a random space fact in the user's language."""

    @staticmethod
    def get(lang: str = DEFAULT_LANG) -> str:
        lang = lang if lang in FACTS else DEFAULT_LANG
        return random.choice(FACTS[lang])