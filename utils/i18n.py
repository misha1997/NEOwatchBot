"""Internationalization (i18n) for NEOwatch Bot.

Central translation registry. Ukrainian ('uk') is the complete baseline;
English ('en') falls back to Ukrainian for any missing key, so a missed
translation shows Ukrainian rather than a raw key.

Usage:
    from utils.i18n import t, pick, plural, compass_dir, hemi
    text = t('menu.iss', user_lang)
    label = pick(entry, 'best_time', user_lang)   # entry['best_time_en'] for en
"""
from typing import Optional

SUPPORTED_LANGS = ('uk', 'en')
DEFAULT_LANG = 'uk'


# ---------------------------------------------------------------------------
# Translation registry
# ---------------------------------------------------------------------------
TRANSLATIONS = {
    'uk': {
        # --- Language picker ---
        'lang.pick': '🌍 Оберіть мову:\n\nChoose your language:',
        'lang.uk': '🇺🇦 Українська',
        'lang.en': '🇬🇧 English',
        'lang.set': '✅ Мову встановлено: <b>{lang_name}</b>',
        'lang.name.uk': 'Українська',
        'lang.name.en': 'English',

        # --- Main menu / shared buttons ---
        'menu.back': '🔙 Головне меню',
        'menu.iss': '🛰️ МКС',
        'menu.launches': '🚀 Запуски',
        'menu.neo': '🌑 Астероїди',
        'menu.apod': '🌌 Фото дня',
        'menu.weather': '☀️ Космопогода',
        'menu.sky': '🔭 Небо',
        'menu.settings': '⚙️ Налаштування',
        'menu.language': '🌐 Мова / Language',

        # --- ISS sub-menu ---
        'iss.now': '🛰️ Де зараз?',
        'iss.passes': '📡 Проходження',
        'iss.crew': '👨‍🚀 Екіпаж',
        'iss.starlink': '🛰️ Starlink',
        'iss.back': '🔙 МКС',

        # --- Weather sub-menu ---
        'weather.space': '📊 Космічна погода',
        'weather.aurora': '🌌 Полярне сяйво',
        'weather.mars': '🔴 Погода на Марсі',
        'weather.back': '🔙 Космопогода',

        # --- Sky sub-menu ---
        'sky.meteors': '🌠 Метеорні потоки',
        'sky.astronomy': '🔭 Астроподії',
        'sky.moon': '🌙 Фаза Місяця',
        'sky.back': '🔙 Небо',

        # --- Sub-menu headers ---
        'iss.menu.header': '🛰️ <b>МКС та супутники</b>\n\nЩо цікавить?',
        'weather.menu.header': '☀️ <b>Космічна погода</b>\n\nСонячна активність, полярне сяйво та погода на Марсі',
        'sky.menu.header': '🔭 <b>Небо та зорі</b>\n\nМетеорні потоки, астрономічні події та фази Місяця',
        'sky.planets': '🪐 Планети',
        'sky.rovers': '📷 Марсоходи',
        'sky.weekly': '📅 Тиждень на небі',
        'sky.fact': '🎲 Факт',
        'sky.deep': '🌌 Далекий космос',

        # --- Deep space sub-menu ---
        'deep.menu.header': '🌌 <b>Далекий космос</b>\n\nVoyager, космічний сміття та гамма-спалахи',
        'deep.voyager': '🛰️ Voyager',
        'deep.debris': '🗑️ Космічний сміття',
        'deep.grb': '💥 Останні GRB',
        'deep.back': '🔙 Небо',
        'deep.voyager.pick': '🛰️ Оберіть зонд:\n\nVoyager 1 — найдальший\nVoyager 2 — другий за віддаллю',

        # --- Welcome / start ---
        'start.title': '🛰️ <b>NEOwatch — Твій провідник у космосі</b>',
        'start.greeting': 'Привіт, {name}! 👋\n\nОбери, що тебе цікавить:\n\n',
        'start.greeting.no_name': 'Обери, що тебе цікавить:\n\n',
        'start.line.iss': '🛰️ <b>МКС</b> — де зараз, проходження, екіпаж, Starlink\n',
        'start.line.launches': '🚀 <b>Запуски</b> — ракети SpaceX, NASA та інших\n',
        'start.line.neo': '🌑 <b>Астероїди</b> — небезпечні об\'єкти поблизу Землі\n',
        'start.line.apod': '🌌 <b>Фото дня</b> — вражаючі кадри від NASA\n',
        'start.line.weather': '☀️ <b>Космопогода</b> — полярне сяйво, сонячна активність, Марс\n',
        'start.line.sky': '🔭 <b>Небо</b> — метеори, астроподії, фаза Місяця\n\n',
        'start.note': '📍 <b>Важливо:</b> вкажи своє місто в налаштуваннях, щоб отримувати персональні сповіщення!',
        'menu.website': '\n\n🌐 <b>Сайт:</b> <a href="https://orbitlight.space/">orbitlight.space</a>',
        'back.title': '🛰️ <b>NEOwatch — Твій провідник у космосі</b>\n\n',
        'back.greeting': 'Обери категорію:\n\n',
        'back.line.iss': '🛰️ <b>МКС</b> — де зараз, проходження, екіпаж, Starlink\n',
        'back.line.launches': '🚀 <b>Запуски</b> — ракети SpaceX, NASA та інших\n',
        'back.line.neo': '🌑 <b>Астероїди</b> — небезпечні об\'єкти поблизу Землі\n',
        'back.line.apod': '🌌 <b>Фото дня</b> — вражаючі кадри від NASA\n',
        'back.line.weather': '☀️ <b>Космопогода</b> — сяйво, сонячна активність, Марс\n',
        'back.line.sky': '🔭 <b>Небо</b> — метеори, астроподії, фаза Місяця\n\n',
        'back.note': '⚙️ Налаштуй сповіщення в розділі налаштувань!',

        # --- Unknown message ---
        'msg.unknown': '🚀 <b>NEOwatch</b>\n\nВикористовуй кнопки меню або команду /start',

        # --- City flow ---
        'city.prompt': '🌍 Напиши назву свого міста українською або англійською:\n\nНаприклад: Київ, Kyiv, Львів, Lviv\n\n📍 Або надішли свою геолокацію (скріпка → Location) — це найточніший спосіб для будь-якої країни.',
        'city.cancel': '🔙 Скасувати',
        'city.set': '✅ Місто встановлено: <b>{city}</b>\n📍 Координати: {lat}, {lon}',
        'city.suggest_header': '🌍 Знайдено кілька варіантів. Обери своє місто:\n\n',
        'city.not_found': '❌ Не вдалося знайти місто \'<b>{city}</b>\'\n\nСпробуй ще раз або вибери інше місто.',
        'city.search_error': '❌ Помилка при пошуку міста. Спробуй інше місто.',
        'city.save_error': '❌ Помилка при збереженні міста',
        'city.need_set': '📍 Спочатку встанови своє місто!',
        'city.set_btn': '📍 Вказати місто',

        # --- Settings ---
        'settings.title': '⚙️ <b>Налаштування</b>\n\n',
        'settings.city': '📍 Місто: <b>{city}</b>\n\n',
        'settings.city_none': 'Не вказано',
        'settings.notifications': '🔔 Сповіщення:\n',
        'settings.iss': 'Проходження МКС',
        'settings.apod': 'Фото дня (9:00)',
        'settings.launches': 'Запуски ракет',
        'settings.neo': 'Небезпечні астероїди',
        'settings.news': 'Новини (10:00)',
        'settings.meteors': 'Метеорні потоки (22:00)',
        'settings.flares': 'Сонячна активність',
        'settings.grb': 'Гама-спалахи (GRB)',
        'settings.change_city': '📍 Змінити місто',
        'settings.sub_on': 'увімкнено ✅',
        'settings.sub_off': 'вимкнено ☑️',
        'settings.toggle_on': 'Сповіщення {name} увімкнено',
        'settings.toggle_off': 'Сповіщення {name} вимкнено',
        'settings.toggle_error': 'Помилка при зміні налаштувань',
        # short labels for subscription toggle buttons
        'sub.iss': 'МКС',
        'sub.apod': 'Фото дня',
        'sub.launches': 'Запуски',
        'sub.neo': 'Астероїди',
        'sub.news': 'Новини',
        'sub.meteors': 'Метеори',
        'sub.flares': 'Сонячна активність',
        'sub.grb': 'GRB',

        # --- Aurora caption ---
        'aurora.caption': '🌌 <b>Прогноз полярного сяйва</b>\n\n'
                          '🗺️ Карта активності на північній півкулі\n'
                          '🟢 Зелений — ймовірне сяйво\n'
                          '🔴 Червоний — активне сяйво\n\n'
                          '<i>Оновлюється кожні 5 хвилин (NOAA)</i>',

        # --- Moon ---
        'moon.title': '🌙 <b>Фаза Місяця</b>\n\n',
        'moon.illumination': '💡 Освітленість: {pct}%\n\n',
        'moon.to_full': '🌕 Повний Місяць через: {n} дн.\n',
        'moon.to_new': '🌑 Новий Місяць через: {n} дн.\n',
        'moon.calc_error': '❌ Не вдалося розрахувати фазу\n',
        'moon.synodic': '📖 Синодичний період: 29.5 днів',
        'moon.phase.new': '🌑 Новий Місяць',
        'moon.phase.waxing_crescent': '🌒 Молода Місяць',
        'moon.phase.first_quarter': '🌓 Перша чверть',
        'moon.phase.waxing_gibbous': '🌔 Прибуваючий Місяць',
        'moon.phase.full': '🌕 Повний Місяць',
        'moon.phase.waning_gibbous': '🌖 Спадаючий Місяць',
        'moon.phase.last_quarter': '🌗 Остання чверть',
        'moon.phase.waning_crescent': '🌘 Стара Місяць',
        'moon.phase.default': '🌑 Місяць',

        # --- Mars ---
        'mars.title': '🔴 <b>Погода на Марсі</b>\n\n',
        'mars.sol': '📅 Сол {sol} (марсіанський день)\n',
        'mars.range': '📊 Дані за: {a} - {b}\n\n',
        'mars.temp_header': '🌡️ <b>Температура повітря:</b>\n',
        'mars.temp_avg': '   Середня: {t}°C\n',
        'mars.temp_range': '   Діапазон: {a}°C ... {b}°C\n',
        'mars.temp_samples': '   Вимірювань: {n}\n',
        'mars.pressure_header': '💨 <b>Атмосферний тиск:</b>\n',
        'mars.pressure_avg': '   Середній: {p} Па\n',
        'mars.pressure_range': '   Діапазон: {a} ... {b} Па\n',
        'mars.wind_header': '💨 <b>Вітер:</b>\n',
        'mars.wind_avg': '   Середня швидкість: {w} м/с\n',
        'mars.wind_range': '   Діапазон: {a} ... {b} м/с\n',
        'mars.wind_dir': '   Напрямок: {dir} ({deg}°)\n',
        'mars.season': '{emoji} <b>Сезон:</b> {season}\n',
        'mars.north_season': '   Північна півкуля: {s}\n',
        'mars.south_season': '   Південна півкуля: {s}\n',
        'mars.source': '\n<i>📡 Джерело: NASA InSight</i>',
        'mars.error': '❌ Не вдалося отримати дані\n',
        'mars.error_hint': '<i>Можливо, InSight не передає дані</i>',

        # --- ISS now (map button) ---
        'iss.open_maps': '🗺️ Відкрити на Google Maps',
        'iss.map_link': '🗺️ Мапа: {link}',

        # --- APOD ---
        'apod.title': '🌌 <b>Фото дня від NASA</b>',
        'apod.video_title': '🎥 <b>Відео дня від NASA</b>',
        'apod.date': '📅 {date}',
        'apod.media': '🎬 {title}',
        'apod.photo_title': '📷 {title}',
        'apod.watch': '▶️ Дивитись відео',
        'apod.watch_photo': '📷 Дивитись фото',
        'apod.full_below': '<i>Повний опис нижче ↓</i>',
        'apod.footer_translated': '\n\n<i>📝 Перекладено з англійської</i>',
        'apod.footer_original': '\n\n<i>📝 Original English description</i>',
        'apod.error': '❌ Не вдалося отримати фото дня від NASA (API error)',
        'apod.handler_error': '❌ Помилка при отриманні фото дня: {err}',

        # --- Asteroids (NEO) ---
        'neo.upcoming_header': '⚠️ <b>Небезпечні астероїди (наступні 7 днів):</b>\n\n',
        'neo.entry': '{i}. 🌑 <b>{name}</b>\n   📅 {date}\n   📍 {dist}\n   ⚠️ Потенційно небезпечний\n\n',
        'neo.dist_mln': '{v} млн км',
        'neo.dist_k': '{v} тис км',
        'neo.hazardous': '⚠️ НЕБЕЗПЕЧНИЙ',
        'neo.safe': '✅ Безпечний',
        'neo.today_title': '🌑 <b>Астероїди поблизу Землі ({date})</b>\n\n',
        'neo.found': 'Всього знайдено: <b>{n}</b>\n\n',
        'neo.item': '{i}. <b>{name}</b>\n   📏 {min}-{max} м\n   📍 {dist} км від Землі\n   🚀 {vel} км/год\n   {hazard}\n\n',
        'neo.none_today': '🌌 Сьогодні немає близьких астероїдів',
        'neo.api_error': '❌ Не вдалося отримати дані про астероїди',
        'apod.full_apod': '🌌 <b>{title}</b>\n📅 {date}\n\n{explanation}\n\n🌐 apod.nasa.gov',
        'apod.caption': '🌌 <b>Фото дня від NASA</b>\n\n📅 {date}\n📷 {title}\n\n<i>Повний опис нижче ↓</i>',
        'apod.watch_video': 'Дивитися відео',

        # --- Compass / hemispheres ---
        'compass.N': 'північ',
        'compass.NE': 'північний схід',
        'compass.E': 'схід',
        'compass.SE': 'південний схід',
        'compass.S': 'південь',
        'compass.SW': 'південний захід',
        'compass.W': 'захід',
        'compass.NW': 'північний захід',
        'hemi.lat.n': 'Пн',
        'hemi.lat.s': 'Пд',
        'hemi.lon.e': 'Сх',
        'hemi.lon.w': 'Зх',
        'kyiv_time': 'київський',

        # --- Days plural ---
        'days.one': '{n} день',
        'days.few': '{n} дні',
        'days.many': '{n} днів',
        'days.short.one': '{n} дн.',
        'days.short.few': '{n} дн.',
        'days.short.many': '{n} дн.',

        # --- Astronauts plural ---
        'astronaut.one': 'астронавт',
        'astronaut.few': 'астронавти',
        'astronaut.many': 'астронавтів',

        # --- Country names default ---
        'country.ocean': '🌊 Над водою (океан)',
        'country.unknown': 'Невідомо',

        # --- ISS position / passes ---
        'iss.now_title': '🛰️ <b>МКС зараз</b>\n\n',
        'iss.coords': '📍 Координати:\n',
        'iss.lat_line': '   🌐 {lat}° {hemi} широти\n',
        'iss.lon_line': '   🌐 {lon}° {hemi} довготи\n',
        'iss.altitude': '   🏔️ Висота: {alt} км\n\n',
        'iss.velocity': '   🚀 Швидкість: {v} км/год\n\n',
        'iss.over_location': '🌍 Над територією: {country}\n\n',
        'iss.location': '🌍 Розташування: {country}\n\n',
        'iss.view_map': "🗺️ <a href='{link}'>Переглянути на мапі</a>",
        'iss.position_error': '❌ Не вдалося отримати позицію МКС',
        'iss.position_api_error': '❌ Помилка при отриманні позиції МКС',
        'iss.passes_title': '🛰️ <b>Найближчі проходження МКС</b>\n\n',
        'iss.pass_date': '{i}. 📅 {date}\n',
        'iss.pass_time': '   🕐 {start} - {end} ({kyiv})\n',
        'iss.pass_duration': '   ⏱️ Тривалість: {dur} сек\n',
        'iss.pass_mag': '   🔆 Яскравість: магнітуда {mag}\n\n',
        'iss.no_passes': '🛰️ У найближчі 10 днів видимих проходів не передбачається',
        'iss.passes_error': '❌ Не вдалося отримати дані про проходження',

        # --- Starlink ---
        'starlink.title': '🛰️ <b>Проходження Starlink</b>\n<i>(ланцюжок супутників)</i>\n\n',
        'starlink.item': '{i}. 📅 {date} ({kyiv})\n   🔆 Яскравість: магнітуда {mag}\n   📍 Макс. висота: {el}°\n\n',
        'starlink.no_passes': '🛰️ У найближчі дні видимих проходжень Starlink не передбачається',
        'starlink.error': '❌ Не вдалося отримати дані про проходження Starlink',

        # --- ISS map location names ---
        'issmap.pacific': 'Над Тихим океаном 🌊',
        'issmap.atlantic': 'Над Атлантичним океаном 🌊',
        'issmap.eurasia': 'Над Євразією 🌍',
        'issmap.africa': 'Над Африкою 🌍',
        'issmap.indian': 'Над Індійським океаном 🌊',
        'issmap.arctic': 'Над Арктикою ❄️',
        'issmap.antarctic': 'Над Антарктидою 🧊',
        'issmap.ocean': 'Над океаном 🌊',

        # --- ISS crew ---
        'crew.title': '👨‍🚀 <b>Екіпаж МКС</b>',
        'crew.unavailable': '❌ Інформація про екіпаж тимчасово недоступна.\n<i>Спробуй пізніше.</i>',
        'crew.expedition': 'Експедиція {n}',
        'crew.unknown_craft': 'Невідомий корабель',
        'crew.unknown': 'Невідомо',
        'crew.days_in_space': '{days_str} у космосі',
        'crew.total_space': '<i>Загалом у космосі: {total} людей (на МКС: {iss})</i>',
        'crew.total_iss': '<i>Всього на МКС: {n} {astronauts}</i>',
        'crew.more_link': '📖 Детальніше про Експедицію {n}',

        # --- Meteor showers ---
        'meteor.title': '🌠 <b>Метеорні потоки</b>\n\n',
        'meteor.upcoming': '📈 <b>Найближчі події:</b>\n\n',
        'meteor.entry': '{emoji} <b>{name}</b> ({name_en})\n   📅 Пік: {date}\n   📊 Інтенсивність: до {rate} метеорів/год\n   🕐 {best_time}\n   {status}\n\n',
        'meteor.tips_header': '💡 <b>Поради для спостереження:</b>\n',
        'meteor.tip1': '• Знайдіть місце без світлового забруднення\n',
        'meteor.tip2': '• Дайте очам адаптуватись 15-20 хв\n',
        'meteor.tip3': '• Лежіть на спині, щоб бачити все небо\n',
        'meteor.tip4': "• Спокійно очікуйте, метеори з'являться\n",
        'meteor.soon_warning': '⚠️ До піку <b>менше 2 тижнів</b> — плануйте спостереження!',
        'meteor.regular': '🌠 Дані оновлюються регулярно',
        'meteor.status.peak': '🔥 ПІК ЗАРАЗ!',
        'meteor.status.active': '✨ Активно',
        'meteor.status.soon': '⏳ Скоро',
        'meteor.status.future': '📅 Через {n} дн.',

        # --- Astronomy events ---
        'astro.title': '🔭 <b>Астрономічні події</b>\n\n',
        'astro.upcoming': '<i>Найближчі події:</i>\n\n',
        'astro.empty': '🔭 <b>Астрономічні події</b>\n\nНайближчі 90 днів подій немає.',
        'astro.eclipse_entry': '{i}. {emoji} <b>{name}</b>\n   📅 {date} ({when})\n   🌍 {visibility}\n\n',
        'astro.conj_entry': '{i}. ✨ <b>{name}</b>\n   📅 {date} ({when})\n   📐 Відстань: {sep}°\n\n',
        'astro.where_header': '🔗 <b>Де дивитися:</b>\n',
        'astro.link1': "• <a href='https://www.timeanddate.com/eclipse/'>timeanddate.com</a> — карти та час\n",
        'astro.link2': "• <a href='https://science.nasa.gov/eclipses/'>NASA Eclipse</a> — наукові дані\n",
        'astro.link3': "• <a href='https://www.youtube.com/@NASA'>NASA Live</a> — трансляції\n",
        'astro.footer': '<i>Дані оновлюються раз на рік</i>',
        'astro.in_days': 'через {d}',
        'astro.conjunction_name': "З'єднання {bodies}",

        # --- Launches ---
        'launch.title': '🚀 <b>Найближчі запуски ракет</b>\n\n',
        'launch.entry': '{i}. 📅 <b>{name}</b>\n   🚀 {rocket} | {lsp}\n   📍 {location}\n',
        'launch.pad_line': '   🎯 {pad}\n',
        'launch.date_line': '   ⏰ {date}\n',
        'launch.status_line': '   📊 {status}\n\n',
        'launch.unknown': 'Невідомо',
        'launch.status.1': '🟢 Готовий до запуску',
        'launch.status.2': '🟡 TBD',
        'launch.status.3': '🟠 Пауза',
        'launch.status.4': '🔵 У польоті',
        'launch.status.5': '🟠 Частковий збій',
        'launch.status.6': '🔴 Невдача',
        'launch.status.7': '✅ Успіх',
        'launch.status.8': '🟡 Підтверджується',
        'launch.status.9': '🟢 Корисне навантаження розгорнуто',
        'launch.status.default': '—',

        # --- GRB alerts ---
        'grb.title': '💥 <b>ВИЯВЛЕНО ГАМА-СПАЛАХ (GRB)!</b>\n\n',
        'grb.name': '🌟 Назва: <b>{name}</b>\n',
        'grb.coords': '📍 Координати: RA {ra}, Dec {dec}\n',
        'grb.redshift': '🔴 Червоний зсув: z = {z}\n',
        'grb.title_line': '\n📝 {title}\n',
        'grb.link': "\n🔗 <a href='{url}'>GCN Circular #{id}</a>\n",
        'grb.source': '\n<i>📡 Дані: NASA GCN</i>',

        # --- SpaceflightNow parser ---
        'sfn.title': '🚀 <b>Найближчі запуски</b>\n',
        'sfn.subtitle': '<i>(джерело: spaceflightnow.com)</i>',
        'sfn.date_line': '\n📅 <b>{date}</b>\n',
        'sfn.mission_line': '🛰️ {mission}\n',
        'sfn.time_line': '⏰ {time}\n',
        'sfn.site_line': '📍 {site}\n',
        'sfn.fallback_title': '🚀 <b>Найближчі запуски</b>\n',
        'sfn.fallback_sub': '<i>(API тимчасово недоступний)</i>',
        'sfn.fallback_check': '📅 Рекомендую перевірити:\n',
        'sfn.fallback_link1': '• spaceflightnow.com/launch-schedule\n',
        'sfn.fallback_link2': '• nextspaceflight.com/launches',
        'sfn.fallback_today': '\n\n📍 Сьогодні: {date}\n',
        'sfn.fallback_wait': '🔄 API відновиться через ~20 хв',

        # --- Space weather formatter ---
        'weather.title': '🌌 <b>Космічна погода</b>\n\n',
        'weather.geo_activity': '📊 <b>Геомагнітна активність</b>\n',
        'weather.kp_index': 'Індекс Kp: {kp}/9\n',
        'weather.kp_line': '{emoji} {g_scale}\n\n',
        'weather.solar_wind': '💨 <b>Сонячний вітер</b>\n',
        'weather.speed': 'Швидкість: {speed} км/с {emoji} {status}\n',
        'weather.density': 'Щільність: {density} ч/см³\n',
        'weather.temp': 'Температура: {temp} тис. K\n\n',
        'weather.mag_field': '🧲 <b>Магнітне поле</b>\n',
        'weather.bz': 'Bz: {bz} нТл\n',
        'weather.bz_line': '{emoji} {status}\n\n',
        'weather.sun_activity': '☀️ <b>Сонячна активність</b>\n',
        'weather.xray': 'Рентген: {xclass}\n',
        'weather.xray_line': '{emoji} {status}\n\n',
        'weather.xray_calm': '🟢 Спокійно\n\n',
        'weather.aurora_section': '🌃 <b>Полярне сяйво</b>\n',
        'weather.aurora_line': '{status}\n',
        'weather.your_lat': '📍 Ваша широта: {lat}°\n\n',
        'weather.forecast_title': '📅 <b>Прогноз Kp на 3 дні</b>\n',
        'weather.forecast_line': '{emoji} {day}: max Kp {kp}\n',
        'weather.kp_scale': '📖 <b>Шкала Kp</b>\n',
        'weather.kp_scale_lines': '🟢 0-3: Спокійна погода\n🟡 4-5: Збурення\n🟠 6-7: Сяйво на півночі\n🔴 8-9: Сяйво всюди\n\n',
        'weather.data_source': '🌌 Дані: NOAA SWPC',
        'weather.partial': '🌌 <b>Космічна погода</b>\n\n⚠️ Часткові дані\n\n📝 NOAA SWPC',

        # Space weather status keys
        'weather.wind.calm': 'Спокійний',
        'weather.wind.moderate': 'Помірний',
        'weather.wind.strong': 'Сильний',
        'weather.wind.very_strong': 'Дуже сильний',
        'weather.bz.calm': 'Спокійне поле',
        'weather.bz.weak_aurora': 'Можливо слабке сяйво',
        'weather.bz.aurora_likely': 'Ймовірне сяйво!',
        'weather.aurora_status.everywhere': '🔴 Сяйво всюди',
        'weather.aurora_status.north': '🟠 Сяйво на півночі',
        'weather.aurora_status.maybe_north': '🟡 Можливо на півночі',
        'weather.aurora_status.not_visible': '🟢 Сьогодні не видно в Україні',
        'weather.xray.extreme': '🚨 Екстремальний спалах!',
        'weather.xray.large': '⚠️ Великий спалах',
        'weather.xray.moderate': '📈 Помірний спалах',
        'weather.xray.weak': '✅ Слабкий спалах',
        'weather.xray.quiet': '🟢 Спокійно',
        'weather.flare.very_weak': 'Дуже слабкий спалах',
        'weather.flare.weak': 'Слабкий спалах',
        'weather.flare.moderate': 'Помірний спалах',
        'weather.flare.large': 'Великий спалах',
        'weather.flare.extreme': 'Екстремальний спалах',
        'weather.flare.unknown': 'Невідомий спалах',
        'weather.g_scale.g0': 'G0: Спокійно',
        'weather.g_scale.g1': 'G1: Слабка буря',
        'weather.g_scale.g2': 'G2: Помірна буря',
        'weather.g_scale.g3': 'G3: Сильна буря',
        'weather.g_scale.g4': 'G4: Сильна геомагнітна буря',
        'weather.g_scale.g5': 'G5: Екстремальна буря',
        'weather.day.today': 'Сьогодні',
        'weather.day.tomorrow': 'Завтра',
        'weather.day.day_after': 'Післязавтра',

        # --- Scheduler broadcast notifications ---
        # ISS pass
        'sch.iss.title': '🛰 <b>Проліт МКС!</b>\n\n',
        'sch.iss.time': '⏰ Час: {time} ({kyiv})\n',
        'sch.iss.duration': '⏱ Тривалість: {dur} сек\n',
        'sch.iss.max_el': '📐 Максимальна висота: {el}°\n',
        'sch.iss.brightness': '🔆 Яскравість: {mag} магнітуди\n',
        'sch.iss.city': '📍 Місто: {city}\n',
        'sch.iss.city_default': 'Ваше місто',
        'sch.iss.direction': '🧭 Напрямок: {dir}',
        'sch.iss.look_at': "<i>Дивіться на {dir} небо!</i>",

        # Launch happening now
        'sch.launch.title': '🚀 <b>Запуск ракети відбувається зараз!</b>\n\n',
        'sch.launch.name_line': '🚀 {name}\n',
        'sch.launch.date_line': '📅 {date}\n',
        'sch.launch.watch': "\n<i>📺 <a href='{url}'>Дивіться трансляцію</a></i>",

        # Hazardous asteroid
        'sch.neo.title': '🚨 <b>НЕБЕЗПЕЧНИЙ АСТЕРОЇД!</b>\n\n',
        'sch.neo.name': '🌑 {name}\n',
        'sch.neo.approach': '📅 Максимальне наближення: {date}\n',
        'sch.neo.distance': '📍 Відстань: {dist}\n',
        'sch.neo.size': '📏 Розмір: {min}-{max} м\n',
        'sch.neo.velocity': '🚀 Швидкість: {vel} км/год\n',
        'sch.neo.warning': '⚠️ <b>Потенційно небезпечний для Землі</b>\n\n',
        'sch.neo.link': "🔗 <a href='{url}'>Детальніше на NASA JPL</a>",
        'sch.neo.dist_mln': '{v} млн км',
        'sch.neo.dist_thousands': '{v} тис км',

        # Solar flares
        'sch.flare.x_header': '🌞 <b>X-КЛАС СОНЯЧНИЙ СПАЛАХ!</b>\n\n',
        'sch.flare.m_header': '🌞 <b>M-КЛАС СОНЯЧНИЙ СПАЛАХ!</b>\n\n',
        'sch.flare.consequences_x': (
            "📡 Можливі наслідки:\n"
            "• Радіозатемнення на коротких хвилях\n"
            "• Полярне сяйво через 1-3 дні\n"
            "• Підвищений Kp-індекс\n"
            "• Загроза для супутників\n"
        ),
        'sch.flare.consequences_m': (
            "📡 Можливі наслідки:\n"
            "• Слабке радіозатемнення\n"
            "• Можливе полярне сяйво\n"
            "• Слідкуйте за Kp-індексом\n"
        ),
        'sch.flare.class_line': '{emoji} Клас: {cls} ({desc})\n',
        'sch.flare.flux': '⚡ Флюс: {flux} Вт/м²\n',
        'sch.flare.time': '🕐 Час: {time}\n\n',
        'sch.flare.source': '<i>Дані: NOAA GOES</i>',

        # Geomagnetic storm
        'sch.storm.title': '{emoji} <b>ГЕОМАГНІТНА БУРЯ!</b>\n\n',
        'sch.storm.kp': '📊 Індекс Kp: {kp}/9\n',
        'sch.storm.scale': '⚠️ Шкала: {scale}\n',
        'sch.storm.time': '🕐 Час: {time}\n',
        'sch.storm.wind': '\n💨 <b>Сонячний вітер</b>\n',
        'sch.storm.wind_speed': 'Швидкість: {speed} км/с — {status}\n',
        'sch.storm.wind_density': 'Щільність: {density} ч/см³\n',
        'sch.storm.bz': '\n🧲 <b>Магнітне поле Bz</b>\n',
        'sch.storm.bz_line': '{emoji} Bz: {bz} нТл — {status}\n',
        'sch.storm.effects_header': '\n🌌 <b>Можливі наслідки:</b>\n{effects}\n',
        'sch.storm.effects.g1': 'Слабке полярне сяйво на високих широтах',
        'sch.storm.effects.g2': 'Полярне сяйво, можливі перешкоди зв\'язку на півночі',
        'sch.storm.effects.g3': 'Сяйво на середніх широтах, перешкоди навігації та зв\'язку',
        'sch.storm.effects.g4': 'Сяйво на півдні, проблеми з електроенергією та супутниками',
        'sch.storm.effects.g5': 'Сяйво видно всюди, серйозні проблеми з енергомережею та супутниками!',
        'sch.storm.aurora_header': '\n🌃 <b>Полярне сяйво:</b> ',
        'sch.storm.aurora.kp8': 'Може бути видно навіть в Україні! 🔴',
        'sch.storm.aurora.kp6': 'Можливо на півночі України 🟠',
        'sch.storm.aurora.kp5': 'Малоймовірно в Україні, але спостерігайте 🟡',
        'sch.storm.forecast': '\n\n📅 <b>Прогноз Kp:</b>\n',
        'sch.storm.forecast_line': '{emoji} {day}: Kp {kp}\n',
        'sch.storm.source': '\n<i>Дані: NOAA SWPC</i>',

        # Astronomy event (eclipse)
        'sch.eclipse.title': '{emoji} <b>ЗАВТРА АСТРОНОМІЧНА ПОДІЯ!</b>\n\n',
        'sch.eclipse.name': '<b>{name}</b>\n',
        'sch.eclipse.date': '📅 {date}\n',
        'sch.eclipse.visibility': '🌍 Видимість: {vis}\n\n',
        'sch.eclipse.link1': "🔗 <a href='https://www.timeanddate.com/eclipse/'>Переглянути карту та час</a>\n",
        'sch.eclipse.link2': "📺 <a href='https://www.youtube.com/@NASA'>Трансляція NASA</a>\n\n",
        'sch.eclipse.footer': '<i>Не пропустіть!</i>',

        # Daily news
        'sch.news.title': '📰 <b>Космічні новини ({date})</b>\n',
        'sch.news.source': '<i>Джерело: spaceflightnow.com</i>\n\n',
        'sch.news.entry': '{i}. {emoji} <b>{title}</b>\n',
        'sch.news.excerpt': '   {excerpt}\n',
        'sch.news.read_more': "   🔗 <a href='{url}'>Читати далі</a>\n\n",
        'sch.news.footer_uk': '\n<i>📝 Новини автоматично перекладено українською</i>',
        'sch.news.footer_en': '\n<i>📝 Джерело: spaceflightnow.com</i>',

        # Meteor showers
        'sch.meteor.tomorrow_title': '🌠 <b>ЗАВТРА МЕТЕОРНИЙ ПОТІК!</b>\n\n',
        'sch.meteor.today_title': '🔥 <b>СЬОГОДНІ ПІК МЕТЕОРНОГО ПОТОКУ!</b>\n\n',
        'sch.meteor.name': '✨ {name} ({other})\n',
        'sch.meteor.peak': '📅 Пік: {date}\n',
        'sch.meteor.rate': '💫 До {rate} метеорів/год\n',
        'sch.meteor.best_time': '🕐 Найкращий час: {time}\n',
        'sch.meteor.direction': '📍 Дивіться: {dir}\n\n',
        'sch.meteor.desc': '📝 {desc}\n\n',
        'sch.meteor.reminder': "<i>Не забудьте встановити будильник на вечір!</i>",
        'sch.meteor.go_out': '<b>🌟 Виходьте спостерігати зараз!</b>\n',
        'sch.meteor.tip': '💡 Лягайте на спину і дивіться на північний схід',

        # --- Visible planets ---
        'planets.title': '🪐 <b>Видимі планети зараз</b>\n\n',
        'planets.intro': '<i>Над горизонтом з твоєї локації:</i>\n\n',
        'planets.entry': '{emoji} <b>{name}</b> — {const}\n   ↑ {alt}° · {az_dir} ({az}°) · ⭐ mag {mag}\n',
        'planets.below': "\n<i>За горизонтом:</i> {list}\n",
        'planets.none_visible': 'Зараз жодна планета не над горизонтом. 🌍\n\n',
        'planets.source': "\n<i>≈ Ефемерида: JPL DE440s · сузір'я IAU · яскравість наближена</i>",
        'planets.error': '🪐 Не вдалося розрахувати позиції планет. Спробуй пізніше.',
        'planets.name.mercury': 'Меркурій',
        'planets.name.venus': 'Венера',
        'planets.name.mars': 'Марс',
        'planets.name.jupiter': 'Юпітер',
        'planets.name.saturn': 'Сатурн',
        'planets.name.uranus': 'Уран',
        'planets.name.neptune': 'Нептун',
        'planets.name.sun': 'Сонце',
        'planets.name.moon': 'Місяць',

        # --- Mars rover photos ---
        'rovers.title': '📷 <b>Фото з Марса — {rover}</b>\n\n',
        'rovers.meta': 'Сол: <b>{sol}</b> · 📅 {date}\n📷 Фото: {n}\n\n',
        'rovers.caption': '📷 {rover} · {camera}\nСол {sol} · {date}',
        'rovers.source': "\n<i>Дані: Mars Vista API · NASA/JPL-Caltech</i>",
        'rovers.empty': '📷 Фото з {rover} зараз недоступні. Спробуй пізніше.',
        'rovers.error': '📷 Не вдалося отримати фото з Марса. Спробуй пізніше.',
        'rovers.no_key': '📷 Фото з марсоходів тимчасово недоступні.\n\nЦя функція використовує сторонній API <a href="https://marsvista.dev/signin">Mars Vista</a> (спадкоємець закритого NASA Mars Rover Photos). Потрібен безкоштовний ключ — додай його у змінну <code>MARS_VISTA_API_KEY</code> у файлі <code>.env</code>. Після цього фото Perseverance і Curiosity з’являться тут.',
        'rovers.combined': '📷 <b>Свіжі фото з Марса</b>\n\nPerseverance і Curiosity, найновіший сол. Деталі — у підписах під фото.\n\n',
        'rovers.album_caption': '📷 <b>Свіжі фото з Марса ({n})</b>\nСол {sol} · 📅 {date}\n\n',

        # --- Voyager ---
        'voyager.title': '🛰️ <b>Voyager {n}</b>\n\n',
        'voyager.distance': '📍 Відстань від Сонця (≈): <b>{km} км</b> ({au} а.о.)\n',
        'voyager.light_time': '⏱️ Час польоту світла: ≈{h} год\n',
        'voyager.speed': '🚀 Швидкість віддалення: ≈{v} км/с\n',
        'voyager.interstellar': '🌌 У міжзоряному просторі з {date}\n',
        'voyager.status': '📡 Статус: зв\'язок підтримується (NASA DSN)\n',
        'voyager.note': '\n<i>Відстань від Землі змінюється в межах ±1 а.о. через орбіту Землі.</i>',
        'voyager.source': '\n<i>≈ Дані: NASA/JPL (наближення від епохи 2025)</i>',
        'voyager.error': '🛰️ Статус Voyager недоступний. Спробуй пізніше.',

        # --- Space debris ---
        'debris.title': '🗑️ <b>Космічний сміття навколо Землі</b>\n\n',
        'debris.tracked': '📡 Відстежуваних об\'єктів (&gt;10 см): <b>{v}</b>\n',
        'debris.cm1': '🔧 Оцінених об\'єктів (&gt;1 см): <b>{v}</b>\n',
        'debris.cm01': '⚛️ Оцінених об\'єктів (&gt;1 мм): <b>{v}</b>\n',
        'debris.mass': '⚖️ Загальна маса на орбіті: <b>{v} т</b>\n',
        'debris.breakups': '💥 Зафіксованих розривів/вибухів: <b>{v}</b>\n',
        'debris.note': "\n<i>Цифри — оцінки ESA станом на {year}.</i>",
        'debris.source': "\n<a href='{url}'>ESA · Space debris by the numbers</a>",
        'debris.error': '🗑️ Статистика космічного сміття недоступна. Спробуй пізніше.',

        # --- Weekly sky calendar ---
        'weekly.title': '📅 <b>Цього тижня на небі</b>\n\n',
        'weekly.conj': "✨ <b>Кон'юнкція</b> {bodies} — {date} (відстань {sep}°)\n",
        'weekly.meteor': '🌠 <b>Метеори {name}</b> — максимум {date} (≈{rate}/год)\n',
        'weekly.full_moon': '🌕 <b>Повний Місяць</b> — {date}\n',
        'weekly.new_moon': '🌑 <b>Новий Місяць</b> — {date}\n',
        'weekly.supermoon': '🌕 <b>Супермісяць</b> (повний Місяць біля перигею) — {date}\n',
        'weekly.retro_begin': '🪐 <b>{planet}</b> починає зворотний рух — {date}\n',
        'weekly.retro_end': '🪐 <b>{planet}</b> повертається до прямого руху — {date}\n',
        'weekly.empty': '📅 <b>Цього тижня на небі</b>\n\nСпецифічних подій на найближчі 7 днів не передбачається. Небо спокійне. 🌌',
        'weekly.footer': "\n<i>Ефемерида: JPL DE440s · кон'юнкції — курована таблиця.</i>",

        # --- Random fact ---
        'fact.label': '🎲 <b>Космічний факт</b>\n\n',

        # --- Recent GRBs (on demand) ---
        'grb.recent_title': '💥 <b>Останні гамма-спалахи (GRB)</b>\n\n',
        'grb.recent_empty': '💥 Свіжих GRB-сповіщень не знайдено.',
        'grb.recent_entry': "• <b>{name}</b> — {title}\n  🔗 <a href='{url}'>#{id}</a>\n",
        'grb.recent_footer': '\n<i>📡 NASA GCN Circulars</i>',

        # --- Website (web/data.py) strings ---
        'compass.short.N': 'Пн', 'compass.short.NE': 'ПнСх', 'compass.short.E': 'Сх',
        'compass.short.SE': 'ПдСх', 'compass.short.S': 'Пд', 'compass.short.SW': 'ПдЗ',
        'compass.short.W': 'Зх', 'compass.short.NW': 'ПнЗ',
        'neo.approach': 'Зближення {date}',
        'sky.event.iss_pass': 'Проліт МКС',
        'sky.event.max_alt': 'Макс. висота {n}°, {frm} → {to}',
        'sky.event.planet': 'Яскравість {mag}, видима зараз над обрієм',
        'sky.event.planet_no_mag': 'Видима зараз над обрієм',
        'sky.event.meteor': '~{rate} метеорів/год у піку',
        'sky.event.now': 'зараз',
        'sky.event.in_days': 'через {n} дн.',
        'sky.event.altitude': 'висота {n}°',
        'sky.event.moon': 'Місяць',
        'sky.event.illumination': 'Освітленість {pct}%',
        'sky.weekly.conjunction': 'Зближення {bodies} ({sep}°)',
        'sky.weekly.meteor_peak': 'Пік потоку {name} (ZHR ~{rate})',
        'sky.weekly.full_moon': 'Повний місяць',
        'sky.weekly.supermoon': 'Повний місяць — супермісяць!',
        'sky.weekly.new_moon': 'Новий місяць',
    },

    'en': {
        # --- Language picker ---
        'lang.pick': '🌍 Choose your language:\n\nОберіть мову:',
        'lang.uk': '🇺🇦 Українська',
        'lang.en': '🇬🇧 English',
        'lang.set': '✅ Language set: <b>{lang_name}</b>',
        'lang.name.uk': 'Ukrainian',
        'lang.name.en': 'English',

        # --- Main menu / shared buttons ---
        'menu.back': '🔙 Main menu',
        'menu.iss': '🛰️ ISS',
        'menu.launches': '🚀 Launches',
        'menu.neo': '🌑 Asteroids',
        'menu.apod': '🌌 Photo of the day',
        'menu.weather': '☀️ Space weather',
        'menu.sky': '🔭 Sky',
        'menu.settings': '⚙️ Settings',
        'menu.language': '🌐 Мова / Language',

        # --- ISS sub-menu ---
        'iss.now': '🛰️ Where is it now?',
        'iss.passes': '📡 Passes',
        'iss.crew': '👨‍🚀 Crew',
        'iss.starlink': '🛰️ Starlink',
        'iss.back': '🔙 ISS',

        # --- Weather sub-menu ---
        'weather.space': '📊 Space weather',
        'weather.aurora': '🌌 Aurora',
        'weather.mars': '🔴 Mars weather',
        'weather.back': '🔙 Space weather',

        # --- Sky sub-menu ---
        'sky.meteors': '🌠 Meteor showers',
        'sky.astronomy': '🔭 Sky events',
        'sky.moon': '🌙 Moon phase',
        'sky.back': '🔙 Sky',

        # --- Sub-menu headers ---
        'iss.menu.header': '🛰️ <b>ISS & satellites</b>\n\nWhat interests you?',
        'weather.menu.header': '☀️ <b>Space weather</b>\n\nSolar activity, aurora and Mars weather',
        'sky.menu.header': '🔭 <b>Sky & stars</b>\n\nMeteor showers, astronomical events and Moon phases',
        'sky.planets': '🪐 Planets',
        'sky.rovers': '📷 Mars rovers',
        'sky.weekly': '📅 This week',
        'sky.fact': '🎲 Fact',
        'sky.deep': '🌌 Deep space',

        # --- Deep space sub-menu ---
        'deep.menu.header': '🌌 <b>Deep space</b>\n\nVoyager, space debris and gamma-ray bursts',
        'deep.voyager': '🛰️ Voyager',
        'deep.debris': '🗑️ Space debris',
        'deep.grb': '💥 Recent GRBs',
        'deep.back': '🔙 Sky',
        'deep.voyager.pick': '🛰️ Pick a probe:\n\nVoyager 1 — the farthest\nVoyager 2 — second farthest',

        # --- Welcome / start ---
        'start.title': '🛰️ <b>NEOwatch — Your guide to space</b>',
        'start.greeting': 'Hi, {name}! 👋\n\nChoose what interests you:\n\n',
        'start.greeting.no_name': 'Choose what interests you:\n\n',
        'start.line.iss': '🛰️ <b>ISS</b> — where it is now, passes, crew, Starlink\n',
        'start.line.launches': '🚀 <b>Launches</b> — SpaceX, NASA and other rockets\n',
        'start.line.neo': '🌑 <b>Asteroids</b> — hazardous objects near Earth\n',
        'start.line.apod': '🌌 <b>Photo of the day</b> — stunning shots from NASA\n',
        'start.line.weather': '☀️ <b>Space weather</b> — aurora, solar activity, Mars\n',
        'start.line.sky': '🔭 <b>Sky</b> — meteors, sky events, Moon phase\n\n',
        'start.note': '📍 <b>Important:</b> set your city in settings to get personalized notifications!',
        'menu.website': '\n\n🌐 <b>Website:</b> <a href="https://orbitlight.space/">orbitlight.space</a>',
        'back.title': '🛰️ <b>NEOwatch — Your guide to space</b>\n\n',
        'back.greeting': 'Choose a category:\n\n',
        'back.line.iss': '🛰️ <b>ISS</b> — where it is now, passes, crew, Starlink\n',
        'back.line.launches': '🚀 <b>Launches</b> — SpaceX, NASA and other rockets\n',
        'back.line.neo': '🌑 <b>Asteroids</b> — hazardous objects near Earth\n',
        'back.line.apod': '🌌 <b>Photo of the day</b> — stunning shots from NASA\n',
        'back.line.weather': '☀️ <b>Space weather</b> — aurora, solar activity, Mars\n',
        'back.line.sky': '🔭 <b>Sky</b> — meteors, sky events, Moon phase\n\n',
        'back.note': '⚙️ Configure notifications in the settings section!',

        # --- Unknown message ---
        'msg.unknown': '🚀 <b>NEOwatch</b>\n\nUse the menu buttons or the /start command',

        # --- City flow ---
        'city.prompt': '🌍 Type the name of your city (Ukrainian or English):\n\nExample: Kyiv, Київ, Lviv, Львів\n\n📍 Or send your location (paperclip → Location) — the most accurate option for any country.',
        'city.cancel': '🔙 Cancel',
        'city.set': '✅ City set: <b>{city}</b>\n📍 Coordinates: {lat}, {lon}',
        'city.suggest_header': '🌍 Found several options. Choose your city:\n\n',
        'city.not_found': '❌ Could not find city \'<b>{city}</b>\'\n\nTry again or pick another city.',
        'city.search_error': '❌ Error searching for the city. Try another city.',
        'city.save_error': '❌ Error saving the city',
        'city.need_set': '📍 Please set your city first!',
        'city.set_btn': '📍 Set city',

        # --- Settings ---
        'settings.title': '⚙️ <b>Settings</b>\n\n',
        'settings.city': '📍 City: <b>{city}</b>\n\n',
        'settings.city_none': 'Not set',
        'settings.notifications': '🔔 Notifications:\n',
        'settings.iss': 'ISS passes',
        'settings.apod': 'Photo of the day (9:00)',
        'settings.launches': 'Rocket launches',
        'settings.neo': 'Hazardous asteroids',
        'settings.news': 'News (10:00)',
        'settings.meteors': 'Meteor showers (22:00)',
        'settings.flares': 'Solar activity',
        'settings.grb': 'Gamma-ray bursts (GRB)',
        'settings.change_city': '📍 Change city',
        'settings.sub_on': 'on ✅',
        'settings.sub_off': 'off ☑️',
        'settings.toggle_on': '{name} notifications enabled',
        'settings.toggle_off': '{name} notifications disabled',
        'settings.toggle_error': 'Error changing settings',
        'sub.iss': 'ISS',
        'sub.apod': 'Photo',
        'sub.launches': 'Launches',
        'sub.neo': 'Asteroids',
        'sub.news': 'News',
        'sub.meteors': 'Meteors',
        'sub.flares': 'Solar',
        'sub.grb': 'GRB',

        # --- Aurora caption ---
        'aurora.caption': '🌌 <b>Aurora forecast</b>\n\n'
                          '🗺️ Northern hemisphere activity map\n'
                          '🟢 Green — likely aurora\n'
                          '🔴 Red — active aurora\n\n'
                          '<i>Updated every 5 minutes (NOAA)</i>',

        # --- Moon ---
        'moon.title': '🌙 <b>Moon phase</b>\n\n',
        'moon.illumination': '💡 Illumination: {pct}%\n\n',
        'moon.to_full': '🌕 Full Moon in: {n} days\n',
        'moon.to_new': '🌑 New Moon in: {n} days\n',
        'moon.calc_error': '❌ Could not calculate the phase\n',
        'moon.synodic': '📖 Synodic period: 29.5 days',
        'moon.phase.new': '🌑 New Moon',
        'moon.phase.waxing_crescent': '🌒 Waxing Crescent',
        'moon.phase.first_quarter': '🌓 First Quarter',
        'moon.phase.waxing_gibbous': '🌔 Waxing Gibbous',
        'moon.phase.full': '🌕 Full Moon',
        'moon.phase.waning_gibbous': '🌖 Waning Gibbous',
        'moon.phase.last_quarter': '🌗 Last Quarter',
        'moon.phase.waning_crescent': '🌘 Waning Crescent',
        'moon.phase.default': '🌑 Moon',

        # --- Mars ---
        'mars.title': '🔴 <b>Mars weather</b>\n\n',
        'mars.sol': '📅 Sol {sol} (Martian day)\n',
        'mars.range': '📊 Data for: {a} - {b}\n\n',
        'mars.temp_header': '🌡️ <b>Air temperature:</b>\n',
        'mars.temp_avg': '   Average: {t}°C\n',
        'mars.temp_range': '   Range: {a}°C ... {b}°C\n',
        'mars.temp_samples': '   Samples: {n}\n',
        'mars.pressure_header': '💨 <b>Atmospheric pressure:</b>\n',
        'mars.pressure_avg': '   Average: {p} Pa\n',
        'mars.pressure_range': '   Range: {a} ... {b} Pa\n',
        'mars.wind_header': '💨 <b>Wind:</b>\n',
        'mars.wind_avg': '   Average speed: {w} m/s\n',
        'mars.wind_range': '   Range: {a} ... {b} m/s\n',
        'mars.wind_dir': '   Direction: {dir} ({deg}°)\n',
        'mars.season': '{emoji} <b>Season:</b> {season}\n',
        'mars.north_season': '   Northern hemisphere: {s}\n',
        'mars.south_season': '   Southern hemisphere: {s}\n',
        'mars.source': '\n<i>📡 Source: NASA InSight</i>',
        'mars.error': '❌ Could not retrieve data\n',
        'mars.error_hint': '<i>InSight may not be transmitting data</i>',

        # --- ISS now (map button) ---
        'iss.open_maps': '🗺️ Open in Google Maps',
        'iss.map_link': '🗺️ Map: {link}',

        # --- APOD ---
        'apod.title': '🌌 <b>NASA Photo of the day</b>',
        'apod.video_title': '🎥 <b>NASA Video of the day</b>',
        'apod.date': '📅 {date}',
        'apod.media': '🎬 {title}',
        'apod.photo_title': '📷 {title}',
        'apod.watch': '▶️ Watch video',
        'apod.watch_photo': '📷 View photo',
        'apod.full_below': '<i>Full description below ↓</i>',
        'apod.footer_translated': '\n\n<i>📝 Translated from English</i>',
        'apod.footer_original': '\n\n<i>📝 Original English description</i>',
        'apod.error': '❌ Could not retrieve the photo of the day from NASA (API error)',
        'apod.handler_error': '❌ Error retrieving photo of the day: {err}',

        # --- Asteroids (NEO) ---
        'neo.upcoming_header': '⚠️ <b>Hazardous asteroids (next 7 days):</b>\n\n',
        'neo.entry': '{i}. 🌑 <b>{name}</b>\n   📅 {date}\n   📍 {dist}\n   ⚠️ Potentially hazardous\n\n',
        'neo.dist_mln': '{v} mln km',
        'neo.dist_k': '{v} thousand km',
        'neo.hazardous': '⚠️ HAZARDOUS',
        'neo.safe': '✅ Safe',
        'neo.today_title': '🌑 <b>Asteroids near Earth ({date})</b>\n\n',
        'neo.found': 'Total found: <b>{n}</b>\n\n',
        'neo.item': '{i}. <b>{name}</b>\n   📏 {min}-{max} m\n   📍 {dist} km from Earth\n   🚀 {vel} km/h\n   {hazard}\n\n',
        'neo.none_today': '🌌 No close asteroids today',
        'neo.api_error': '❌ Could not retrieve asteroid data',
        'apod.full_apod': '🌌 <b>{title}</b>\n📅 {date}\n\n{explanation}\n\n🌐 apod.nasa.gov',
        'apod.caption': '🌌 <b>NASA Photo of the day</b>\n\n📅 {date}\n📷 {title}\n\n<i>Full description below ↓</i>',
        'apod.watch_video': 'Watch the video',

        # --- Compass / hemispheres ---
        'compass.N': 'north',
        'compass.NE': 'northeast',
        'compass.E': 'east',
        'compass.SE': 'southeast',
        'compass.S': 'south',
        'compass.SW': 'southwest',
        'compass.W': 'west',
        'compass.NW': 'northwest',
        'hemi.lat.n': 'N',
        'hemi.lat.s': 'S',
        'hemi.lon.e': 'E',
        'hemi.lon.w': 'W',
        'kyiv_time': 'Kyiv time',

        # --- Days plural ---
        'days.one': '{n} day',
        'days.few': '{n} days',
        'days.many': '{n} days',
        'days.short.one': '{n} d',
        'days.short.few': '{n} d',
        'days.short.many': '{n} d',

        # --- Astronauts plural ---
        'astronaut.one': 'astronaut',
        'astronaut.few': 'astronauts',
        'astronaut.many': 'astronauts',

        # --- Country names default ---
        'country.ocean': '🌊 Over water (ocean)',
        'country.unknown': 'Unknown',

        # --- ISS position / passes ---
        'iss.now_title': '🛰️ <b>ISS now</b>\n\n',
        'iss.coords': '📍 Coordinates:\n',
        'iss.lat_line': '   🌐 {lat}° {hemi} latitude\n',
        'iss.lon_line': '   🌐 {lon}° {hemi} longitude\n',
        'iss.altitude': '   🏔️ Altitude: {alt} km\n\n',
        'iss.velocity': '   🚀 Velocity: {v} km/h\n\n',
        'iss.over_location': '🌍 Over: {country}\n\n',
        'iss.location': '🌍 Location: {country}\n\n',
        'iss.view_map': "🗺️ <a href='{link}'>View on map</a>",
        'iss.position_error': '❌ Could not retrieve ISS position',
        'iss.position_api_error': '❌ Error retrieving ISS position',
        'iss.passes_title': '🛰️ <b>Upcoming ISS passes</b>\n\n',
        'iss.pass_date': '{i}. 📅 {date}\n',
        'iss.pass_time': '   🕐 {start} - {end} ({kyiv})\n',
        'iss.pass_duration': '   ⏱️ Duration: {dur} sec\n',
        'iss.pass_mag': '   🔆 Brightness: magnitude {mag}\n\n',
        'iss.no_passes': '🛰️ No visible passes expected in the next 10 days',
        'iss.passes_error': '❌ Could not retrieve pass data',

        # --- Starlink ---
        'starlink.title': '🛰️ <b>Starlink passes</b>\n<i>(satellite train)</i>\n\n',
        'starlink.item': '{i}. 📅 {date} ({kyiv})\n   🔆 Brightness: magnitude {mag}\n   📍 Max altitude: {el}°\n\n',
        'starlink.no_passes': '🛰️ No visible Starlink passes expected in the coming days',
        'starlink.error': '❌ Could not retrieve Starlink pass data',

        # --- ISS map location names ---
        'issmap.pacific': 'Over the Pacific Ocean 🌊',
        'issmap.atlantic': 'Over the Atlantic Ocean 🌊',
        'issmap.eurasia': 'Over Eurasia 🌍',
        'issmap.africa': 'Over Africa 🌍',
        'issmap.indian': 'Over the Indian Ocean 🌊',
        'issmap.arctic': 'Over the Arctic ❄️',
        'issmap.antarctic': 'Over Antarctica 🧊',
        'issmap.ocean': 'Over the ocean 🌊',

        # --- ISS crew ---
        'crew.title': '👨‍🚀 <b>ISS crew</b>',
        'crew.unavailable': '❌ Crew information is temporarily unavailable.\n<i>Try again later.</i>',
        'crew.expedition': 'Expedition {n}',
        'crew.unknown_craft': 'Unknown spacecraft',
        'crew.unknown': 'Unknown',
        'crew.days_in_space': '{days_str} in space',
        'crew.total_space': '<i>Total in space: {total} people (on ISS: {iss})</i>',
        'crew.total_iss': '<i>Total on ISS: {n} {astronauts}</i>',
        'crew.more_link': '📖 More about Expedition {n}',

        # --- Meteor showers ---
        'meteor.title': '🌠 <b>Meteor showers</b>\n\n',
        'meteor.upcoming': '📈 <b>Upcoming events:</b>\n\n',
        'meteor.entry': '{emoji} <b>{name}</b> ({name_en})\n   📅 Peak: {date}\n   📊 Intensity: up to {rate} meteors/h\n   🕐 {best_time}\n   {status}\n\n',
        'meteor.tips_header': '💡 <b>Observation tips:</b>\n',
        'meteor.tip1': '• Find a spot with no light pollution\n',
        'meteor.tip2': '• Let your eyes adapt for 15-20 min\n',
        'meteor.tip3': '• Lie on your back to see the whole sky\n',
        'meteor.tip4': '• Wait patiently, the meteors will appear\n',
        'meteor.soon_warning': '⚠️ Less than <b>2 weeks</b> to the peak — plan your observation!',
        'meteor.regular': '🌠 Data updated regularly',
        'meteor.status.peak': '🔥 PEAK NOW!',
        'meteor.status.active': '✨ Active',
        'meteor.status.soon': '⏳ Soon',
        'meteor.status.future': '📅 In {n} days',

        # --- Astronomy events ---
        'astro.title': '🔭 <b>Astronomical events</b>\n\n',
        'astro.upcoming': '<i>Upcoming events:</i>\n\n',
        'astro.empty': '🔭 <b>Astronomical events</b>\n\nNo events in the next 90 days.',
        'astro.eclipse_entry': '{i}. {emoji} <b>{name}</b>\n   📅 {date} ({when})\n   🌍 {visibility}\n\n',
        'astro.conj_entry': '{i}. ✨ <b>{name}</b>\n   📅 {date} ({when})\n   📐 Separation: {sep}°\n\n',
        'astro.where_header': '🔗 <b>Where to watch:</b>\n',
        'astro.link1': "• <a href='https://www.timeanddate.com/eclipse/'>timeanddate.com</a> — maps & times\n",
        'astro.link2': "• <a href='https://science.nasa.gov/eclipses/'>NASA Eclipse</a> — science data\n",
        'astro.link3': "• <a href='https://www.youtube.com/@NASA'>NASA Live</a> — broadcasts\n",
        'astro.footer': '<i>Data updated once a year</i>',
        'astro.in_days': 'in {d}',
        'astro.conjunction_name': 'Conjunction: {bodies}',

        # --- Launches ---
        'launch.title': '🚀 <b>Upcoming rocket launches</b>\n\n',
        'launch.entry': '{i}. 📅 <b>{name}</b>\n   🚀 {rocket} | {lsp}\n   📍 {location}\n',
        'launch.pad_line': '   🎯 {pad}\n',
        'launch.date_line': '   ⏰ {date}\n',
        'launch.status_line': '   📊 {status}\n\n',
        'launch.unknown': 'Unknown',
        'launch.status.1': '🟢 Go for Launch',
        'launch.status.2': '🟡 TBD',
        'launch.status.3': '🟠 Hold',
        'launch.status.4': '🔵 In Flight',
        'launch.status.5': '🟠 Partial Failure',
        'launch.status.6': '🔴 Failure',
        'launch.status.7': '✅ Success',
        'launch.status.8': '🟡 To Be Confirmed',
        'launch.status.9': '🟢 Payload Deployed',
        'launch.status.default': '—',

        # --- GRB alerts ---
        'grb.title': '💥 <b>GAMMA-RAY BURST (GRB) DETECTED!</b>\n\n',
        'grb.name': '🌟 Name: <b>{name}</b>\n',
        'grb.coords': '📍 Coordinates: RA {ra}, Dec {dec}\n',
        'grb.redshift': '🔴 Redshift: z = {z}\n',
        'grb.title_line': '\n📝 {title}\n',
        'grb.link': "\n🔗 <a href='{url}'>GCN Circular #{id}</a>\n",
        'grb.source': '\n<i>📡 Data: NASA GCN</i>',

        # --- SpaceflightNow parser ---
        'sfn.title': '🚀 <b>Upcoming launches</b>\n',
        'sfn.subtitle': '<i>(source: spaceflightnow.com)</i>',
        'sfn.date_line': '\n📅 <b>{date}</b>\n',
        'sfn.mission_line': '🛰️ {mission}\n',
        'sfn.time_line': '⏰ {time}\n',
        'sfn.site_line': '📍 {site}\n',
        'sfn.fallback_title': '🚀 <b>Upcoming launches</b>\n',
        'sfn.fallback_sub': '<i>(API temporarily unavailable)</i>',
        'sfn.fallback_check': '📅 Recommended to check:\n',
        'sfn.fallback_link1': '• spaceflightnow.com/launch-schedule\n',
        'sfn.fallback_link2': '• nextspaceflight.com/launches',
        'sfn.fallback_today': '\n\n📍 Today: {date}\n',
        'sfn.fallback_wait': '🔄 API will recover in ~20 min',

        # --- Space weather formatter ---
        'weather.title': '🌌 <b>Space weather</b>\n\n',
        'weather.geo_activity': '📊 <b>Geomagnetic activity</b>\n',
        'weather.kp_index': 'Kp index: {kp}/9\n',
        'weather.kp_line': '{emoji} {g_scale}\n\n',
        'weather.solar_wind': '💨 <b>Solar wind</b>\n',
        'weather.speed': 'Speed: {speed} km/s {emoji} {status}\n',
        'weather.density': 'Density: {density} p/cm³\n',
        'weather.temp': 'Temperature: {temp} thsd. K\n\n',
        'weather.mag_field': '🧲 <b>Magnetic field</b>\n',
        'weather.bz': 'Bz: {bz} nT\n',
        'weather.bz_line': '{emoji} {status}\n\n',
        'weather.sun_activity': '☀️ <b>Solar activity</b>\n',
        'weather.xray': 'X-ray: {xclass}\n',
        'weather.xray_line': '{emoji} {status}\n\n',
        'weather.xray_calm': '🟢 Quiet\n\n',
        'weather.aurora_section': '🌃 <b>Aurora</b>\n',
        'weather.aurora_line': '{status}\n',
        'weather.your_lat': '📍 Your latitude: {lat}°\n\n',
        'weather.forecast_title': '📅 <b>Kp forecast for 3 days</b>\n',
        'weather.forecast_line': '{emoji} {day}: max Kp {kp}\n',
        'weather.kp_scale': '📖 <b>Kp scale</b>\n',
        'weather.kp_scale_lines': '🟢 0-3: Quiet weather\n🟡 4-5: Unsettled\n🟠 6-7: Aurora in the north\n🔴 8-9: Aurora everywhere\n\n',
        'weather.data_source': '🌌 Data: NOAA SWPC',
        'weather.partial': '🌌 <b>Space weather</b>\n\n⚠️ Partial data\n\n📝 NOAA SWPC',

        # Space weather status keys
        'weather.wind.calm': 'Calm',
        'weather.wind.moderate': 'Moderate',
        'weather.wind.strong': 'Strong',
        'weather.wind.very_strong': 'Very strong',
        'weather.bz.calm': 'Calm field',
        'weather.bz.weak_aurora': 'Weak aurora possible',
        'weather.bz.aurora_likely': 'Aurora likely!',
        'weather.aurora_status.everywhere': '🔴 Aurora everywhere',
        'weather.aurora_status.north': '🟠 Aurora in the north',
        'weather.aurora_status.maybe_north': '🟡 Possibly in the north',
        'weather.aurora_status.not_visible': '🟢 Not visible at your latitude today',
        'weather.xray.extreme': '🚨 Extreme flare!',
        'weather.xray.large': '⚠️ Large flare',
        'weather.xray.moderate': '📈 Moderate flare',
        'weather.xray.weak': '✅ Weak flare',
        'weather.xray.quiet': '🟢 Quiet',
        'weather.flare.very_weak': 'Very weak flare',
        'weather.flare.weak': 'Weak flare',
        'weather.flare.moderate': 'Moderate flare',
        'weather.flare.large': 'Large flare',
        'weather.flare.extreme': 'Extreme flare',
        'weather.flare.unknown': 'Unknown flare',
        'weather.g_scale.g0': 'G0: Quiet',
        'weather.g_scale.g1': 'G1: Minor storm',
        'weather.g_scale.g2': 'G2: Moderate storm',
        'weather.g_scale.g3': 'G3: Strong storm',
        'weather.g_scale.g4': 'G4: Severe geomagnetic storm',
        'weather.g_scale.g5': 'G5: Extreme storm',
        'weather.day.today': 'Today',
        'weather.day.tomorrow': 'Tomorrow',
        'weather.day.day_after': 'Day after tomorrow',

        # --- Scheduler broadcast notifications ---
        # ISS pass
        'sch.iss.title': '🛰 <b>ISS pass!</b>\n\n',
        'sch.iss.time': '⏰ Time: {time} ({kyiv})\n',
        'sch.iss.duration': '⏱ Duration: {dur} s\n',
        'sch.iss.max_el': '📐 Max elevation: {el}°\n',
        'sch.iss.brightness': '🔆 Brightness: {mag} mag\n',
        'sch.iss.city': '📍 City: {city}\n',
        'sch.iss.city_default': 'Your city',
        'sch.iss.direction': '🧭 Direction: {dir}',
        'sch.iss.look_at': "<i>Look at the {dir} sky!</i>",

        # Launch happening now
        'sch.launch.title': '🚀 <b>Rocket launch happening now!</b>\n\n',
        'sch.launch.name_line': '🚀 {name}\n',
        'sch.launch.date_line': '📅 {date}\n',
        'sch.launch.watch': "\n<i>📺 <a href='{url}'>Watch the broadcast</a></i>",

        # Hazardous asteroid
        'sch.neo.title': '🚨 <b>HAZARDOUS ASTEROID!</b>\n\n',
        'sch.neo.name': '🌑 {name}\n',
        'sch.neo.approach': '📅 Closest approach: {date}\n',
        'sch.neo.distance': '📍 Distance: {dist}\n',
        'sch.neo.size': '📏 Size: {min}-{max} m\n',
        'sch.neo.velocity': '🚀 Velocity: {vel} km/h\n',
        'sch.neo.warning': '⚠️ <b>Potentially hazardous for Earth</b>\n\n',
        'sch.neo.link': "🔗 <a href='{url}'>More on NASA JPL</a>",
        'sch.neo.dist_mln': '{v} M km',
        'sch.neo.dist_thousands': '{v} k km',

        # Solar flares
        'sch.flare.x_header': '🌞 <b>X-CLASS SOLAR FLARE!</b>\n\n',
        'sch.flare.m_header': '🌞 <b>M-CLASS SOLAR FLARE!</b>\n\n',
        'sch.flare.consequences_x': (
            "📡 Possible effects:\n"
            "• Shortwave radio blackout\n"
            "• Aurora in 1-3 days\n"
            "• Elevated Kp index\n"
            "• Threat to satellites\n"
        ),
        'sch.flare.consequences_m': (
            "📡 Possible effects:\n"
            "• Weak radio blackout\n"
            "• Aurora possible\n"
            "• Watch the Kp index\n"
        ),
        'sch.flare.class_line': '{emoji} Class: {cls} ({desc})\n',
        'sch.flare.flux': '⚡ Flux: {flux} W/m²\n',
        'sch.flare.time': '🕐 Time: {time}\n\n',
        'sch.flare.source': '<i>Data: NOAA GOES</i>',

        # Geomagnetic storm
        'sch.storm.title': '{emoji} <b>GEOMAGNETIC STORM!</b>\n\n',
        'sch.storm.kp': '📊 Kp index: {kp}/9\n',
        'sch.storm.scale': '⚠️ Scale: {scale}\n',
        'sch.storm.time': '🕐 Time: {time}\n',
        'sch.storm.wind': '\n💨 <b>Solar wind</b>\n',
        'sch.storm.wind_speed': 'Speed: {speed} km/s — {status}\n',
        'sch.storm.wind_density': 'Density: {density} p/cm³\n',
        'sch.storm.bz': '\n🧲 <b>Magnetic field Bz</b>\n',
        'sch.storm.bz_line': '{emoji} Bz: {bz} nT — {status}\n',
        'sch.storm.effects_header': '\n🌌 <b>Possible effects:</b>\n{effects}\n',
        'sch.storm.effects.g1': 'Weak aurora at high latitudes',
        'sch.storm.effects.g2': "Aurora, possible communication issues in the north",
        'sch.storm.effects.g3': 'Aurora at mid-latitudes, navigation and communication issues',
        'sch.storm.effects.g4': 'Aurora further south, power and satellite problems',
        'sch.storm.effects.g5': 'Aurora visible everywhere, serious power grid and satellite problems!',
        'sch.storm.aurora_header': '\n🌃 <b>Aurora:</b> ',
        'sch.storm.aurora.kp8': 'May be visible even at mid-latitudes! 🔴',
        'sch.storm.aurora.kp6': 'Possibly in the north 🟠',
        'sch.storm.aurora.kp5': 'Unlikely at your latitude, but watch 🟡',
        'sch.storm.forecast': '\n\n📅 <b>Kp forecast:</b>\n',
        'sch.storm.forecast_line': '{emoji} {day}: Kp {kp}\n',
        'sch.storm.source': '\n<i>Data: NOAA SWPC</i>',

        # Astronomy event (eclipse)
        'sch.eclipse.title': '{emoji} <b>ASTRONOMICAL EVENT TOMORROW!</b>\n\n',
        'sch.eclipse.name': '<b>{name}</b>\n',
        'sch.eclipse.date': '📅 {date}\n',
        'sch.eclipse.visibility': '🌍 Visibility: {vis}\n\n',
        'sch.eclipse.link1': "🔗 <a href='https://www.timeanddate.com/eclipse/'>View map & time</a>\n",
        'sch.eclipse.link2': "📺 <a href='https://www.youtube.com/@NASA'>NASA broadcast</a>\n\n",
        'sch.eclipse.footer': "<i>Don't miss it!</i>",

        # Daily news
        'sch.news.title': '📰 <b>Space news ({date})</b>\n',
        'sch.news.source': '<i>Source: spaceflightnow.com</i>\n\n',
        'sch.news.entry': '{i}. {emoji} <b>{title}</b>\n',
        'sch.news.excerpt': '   {excerpt}\n',
        'sch.news.read_more': "   🔗 <a href='{url}'>Read more</a>\n\n",
        'sch.news.footer_uk': '\n<i>📝 News automatically translated to Ukrainian</i>',
        'sch.news.footer_en': '\n<i>📝 Source: spaceflightnow.com</i>',

        # Meteor showers
        'sch.meteor.tomorrow_title': '🌠 <b>METEOR SHOWER TOMORROW!</b>\n\n',
        'sch.meteor.today_title': '🔥 <b>METEOR SHOWER PEAK TODAY!</b>\n\n',
        'sch.meteor.name': '✨ {name} ({other})\n',
        'sch.meteor.peak': '📅 Peak: {date}\n',
        'sch.meteor.rate': '💫 Up to {rate} meteors/h\n',
        'sch.meteor.best_time': '🕐 Best time: {time}\n',
        'sch.meteor.direction': '📍 Look: {dir}\n\n',
        'sch.meteor.desc': '📝 {desc}\n\n',
        'sch.meteor.reminder': "<i>Don't forget to set an alarm for the evening!</i>",
        'sch.meteor.go_out': '<b>🌟 Go out and observe now!</b>\n',
        'sch.meteor.tip': '💡 Lie on your back and look to the northeast',

        # --- Visible planets ---
        'planets.title': '🪐 <b>Visible planets right now</b>\n\n',
        'planets.intro': "<i>Above the horizon from your location:</i>\n\n",
        'planets.entry': '{emoji} <b>{name}</b> — {const}\n   ↑ {alt}° · {az_dir} ({az}°) · ⭐ mag {mag}\n',
        'planets.below': '\n<i>Below horizon:</i> {list}\n',
        'planets.none_visible': 'No planet is above the horizon right now. 🌍\n\n',
        'planets.source': "\n<i>≈ Ephemeris: JPL DE440s · IAU constellations · magnitudes approximate</i>",
        'planets.error': '🪐 Could not compute planet positions. Try again later.',
        'planets.name.mercury': 'Mercury',
        'planets.name.venus': 'Venus',
        'planets.name.mars': 'Mars',
        'planets.name.jupiter': 'Jupiter',
        'planets.name.saturn': 'Saturn',
        'planets.name.uranus': 'Uranus',
        'planets.name.neptune': 'Neptune',
        'planets.name.sun': 'Sun',
        'planets.name.moon': 'Moon',

        # --- Mars rover photos ---
        'rovers.title': '📷 <b>Photos from Mars — {rover}</b>\n\n',
        'rovers.meta': 'Sol: <b>{sol}</b> · 📅 {date}\n📷 Photos: {n}\n\n',
        'rovers.caption': '📷 {rover} · {camera}\nSol {sol} · {date}',
        'rovers.source': '\n<i>Data: Mars Vista API · NASA/JPL-Caltech</i>',
        'rovers.empty': '📷 Photos from {rover} are unavailable right now. Try again later.',
        'rovers.error': '📷 Could not fetch photos from Mars. Try again later.',
        'rovers.no_key': '📷 Mars rover photos are temporarily unavailable.\n\nThis feature uses the third-party <a href="https://marsvista.dev/signin">Mars Vista</a> API (the successor to the retired NASA Mars Rover Photos API). A free key is required — add it as <code>MARS_VISTA_API_KEY</code> in your <code>.env</code> file. Once set, Perseverance and Curiosity photos will appear here.',
        'rovers.combined': '📷 <b>Fresh photos from Mars</b>\n\nPerseverance and Curiosity, latest sol. Details under each photo.\n\n',
        'rovers.album_caption': '📷 <b>Fresh photos from Mars ({n})</b>\nSol {sol} · 📅 {date}\n\n',

        # --- Voyager ---
        'voyager.title': '🛰️ <b>Voyager {n}</b>\n\n',
        'voyager.distance': '📍 Distance from the Sun (≈): <b>{km} km</b> ({au} AU)\n',
        'voyager.light_time': '⏱️ Light-travel time: ≈{h} h\n',
        'voyager.speed': '🚀 Recession velocity: ≈{v} km/s\n',
        'voyager.interstellar': '🌌 In interstellar space since {date}\n',
        'voyager.status': '📡 Status: contact maintained (NASA DSN)\n',
        'voyager.note': '\n<i>Distance from Earth varies by ±1 AU as Earth orbits.</i>',
        'voyager.source': '\n<i>≈ Data: NASA/JPL (propagated from a 2025 epoch)</i>',
        'voyager.error': '🛰️ Voyager status unavailable. Try again later.',

        # --- Space debris ---
        'debris.title': '🗑️ <b>Space debris around Earth</b>\n\n',
        'debris.tracked': '📡 Tracked objects (&gt;10 cm): <b>{v}</b>\n',
        'debris.cm1': '🔧 Estimated objects (&gt;1 cm): <b>{v}</b>\n',
        'debris.cm01': '⚛️ Estimated objects (&gt;1 mm): <b>{v}</b>\n',
        'debris.mass': '⚖️ Total mass on orbit: <b>{v} t</b>\n',
        'debris.breakups': '💥 Recorded breakups/explosions: <b>{v}</b>\n',
        'debris.note': "\n<i>Figures are ESA estimates as of {year}.</i>",
        'debris.source': "\n<a href='{url}'>ESA · Space debris by the numbers</a>",
        'debris.error': '🗑️ Space debris stats unavailable. Try again later.',

        # --- Weekly sky calendar ---
        'weekly.title': '📅 <b>This week in the sky</b>\n\n',
        'weekly.conj': '✨ <b>Conjunction</b> {bodies} — {date} (separation {sep}°)\n',
        'weekly.meteor': '🌠 <b>{name} meteors</b> — peak {date} (≈{rate}/h)\n',
        'weekly.full_moon': '🌕 <b>Full Moon</b> — {date}\n',
        'weekly.new_moon': '🌑 <b>New Moon</b> — {date}\n',
        'weekly.supermoon': '🌕 <b>Supermoon</b> (full Moon near perigee) — {date}\n',
        'weekly.retro_begin': '🪐 <b>{planet}</b> begins retrograde — {date}\n',
        'weekly.retro_end': '🪐 <b>{planet}</b> returns to direct motion — {date}\n',
        'weekly.empty': '📅 <b>This week in the sky</b>\n\nNo notable events are expected in the next 7 days. Quiet skies. 🌌',
        'weekly.footer': "\n<i>Ephemeris: JPL DE440s · conjunctions: curated table.</i>",

        # --- Random fact ---
        'fact.label': '🎲 <b>Space fact</b>\n\n',

        # --- Recent GRBs (on demand) ---
        'grb.recent_title': '💥 <b>Recent gamma-ray bursts (GRB)</b>\n\n',
        'grb.recent_empty': '💥 No recent GRB alerts found.',
        'grb.recent_entry': "• <b>{name}</b> — {title}\n  🔗 <a href='{url}'>#{id}</a>\n",
        'grb.recent_footer': '\n<i>📡 NASA GCN Circulars</i>',

        # --- Website (web/data.py) strings ---
        'compass.short.N': 'N', 'compass.short.NE': 'NE', 'compass.short.E': 'E',
        'compass.short.SE': 'SE', 'compass.short.S': 'S', 'compass.short.SW': 'SW',
        'compass.short.W': 'W', 'compass.short.NW': 'NW',
        'neo.approach': 'Approach {date}',
        'sky.event.iss_pass': 'ISS pass',
        'sky.event.max_alt': 'Max alt {n}°, {frm} → {to}',
        'sky.event.planet': 'Mag {mag}, visible now above horizon',
        'sky.event.planet_no_mag': 'Visible now above horizon',
        'sky.event.meteor': '~{rate} meteors/h at peak',
        'sky.event.now': 'now',
        'sky.event.in_days': 'in {n} d',
        'sky.event.altitude': 'alt {n}°',
        'sky.event.moon': 'Moon',
        'sky.event.illumination': 'Illumination {pct}%',
        'sky.weekly.conjunction': 'Conjunction {bodies} ({sep}°)',
        'sky.weekly.meteor_peak': 'Peak of {name} (ZHR ~{rate})',
        'sky.weekly.full_moon': 'Full Moon',
        'sky.weekly.supermoon': 'Full Moon — supermoon!',
        'sky.weekly.new_moon': 'New Moon',
    },
}


# ---------------------------------------------------------------------------
# Accessor
# ---------------------------------------------------------------------------
def t(key: str, lang: str = DEFAULT_LANG, **kwargs) -> str:
    """Translate a key. Falls back to UK, then to the raw key."""
    lang = lang if lang in SUPPORTED_LANGS else DEFAULT_LANG
    text = TRANSLATIONS.get(lang, {}).get(key)
    if text is None:
        text = TRANSLATIONS[DEFAULT_LANG].get(key)
    if text is None:
        text = key
    if kwargs:
        try:
            return text.format(**kwargs)
        except Exception:
            return text
    return text


def pick(data: dict, field_base: str, lang: str = DEFAULT_LANG) -> str:
    """Pick a bilingual data-table field.

    For lang='en' returns data[field_base + '_en'] (with fallback to the
    base field); otherwise returns data[field_base].
    """
    if lang == 'en':
        return data.get(field_base + '_en') or data.get(field_base) or ''
    return data.get(field_base) or ''


# ---------------------------------------------------------------------------
# Pluralization
# ---------------------------------------------------------------------------
def _plural_uk(n: int) -> str:
    n = abs(n) % 100
    if 11 <= n <= 14:
        return 'many'
    n %= 10
    if n == 1:
        return 'one'
    if 2 <= n <= 4:
        return 'few'
    return 'many'


def _plural_en(n: int) -> str:
    return 'one' if abs(n) == 1 else 'many'


def plural(n: int, lang: str = DEFAULT_LANG) -> str:
    """Return the plural form key ('one'/'few'/'many') for a count and language."""
    if lang == 'en':
        return _plural_en(n)
    return _plural_uk(n)


def days(n: int, lang: str = DEFAULT_LANG, short: bool = False) -> str:
    """Format 'N days' respecting plural rules for the language."""
    prefix = 'days.short' if short else 'days'
    return t(f'{prefix}.{plural(n, lang)}', lang, n=n)


def astronauts(n: int, lang: str = DEFAULT_LANG) -> str:
    return t(f'astronaut.{plural(n, lang)}', lang)


# ---------------------------------------------------------------------------
# Compass / hemispheres
# ---------------------------------------------------------------------------
_COMPASS_KEYS = ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW')

# 16-point compass codes collapsed to the nearest 8-point direction
# (matches the previous _compass_to_uk behaviour used by the ISS-pass formatter).
_COMPASS_COLLAPSE = {
    'NNE': 'NE', 'ENE': 'NE',
    'ESE': 'SE', 'SSE': 'SE',
    'SSW': 'SW', 'WSW': 'SW',
    'WNW': 'NW', 'NNW': 'NW',
}


def compass_dir(code: str, lang: str = DEFAULT_LANG) -> str:
    """Full compass direction word (N/NE/E/...). Used in 'look at {dir} sky'."""
    if not code:
        return ''
    code = code.upper()
    code = _COMPASS_COLLAPSE.get(code, code)
    if code not in _COMPASS_KEYS:
        return code
    return t(f'compass.{code}', lang)


def lat_hemi(lat: float, lang: str = DEFAULT_LANG) -> str:
    return t('hemi.lat.n' if lat >= 0 else 'hemi.lat.s', lang)


def lon_hemi(lon: float, lang: str = DEFAULT_LANG) -> str:
    return t('hemi.lon.e' if lon >= 0 else 'hemi.lon.w', lang)


def normalize_lang(lang: Optional[str]) -> str:
    """Return a valid language code, defaulting to UK."""
    return lang if lang in SUPPORTED_LANGS else DEFAULT_LANG