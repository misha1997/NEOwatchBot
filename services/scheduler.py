"""Scheduled jobs - APOD daily, ISS passes, Launch notifications"""
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Set
from zoneinfo import ZoneInfo
from telegram import Bot
from telegram.constants import ParseMode

KYIV_TZ = ZoneInfo('Europe/Kyiv')

from config import BOT_TOKEN
from services import LaunchAPI
from services.meteor_shower import MeteorShower
from services.space_weather import SpaceWeatherAPI
from services.grb_alerts import GRBAlertAPI
from parsers import SpaceflightNowParser
from utils.translator import Translator
from database import (
    get_apod_subscribers, get_launch_subscribers, get_iss_subscribers, get_neo_subscribers, get_news_subscribers, get_meteor_subscribers, get_flare_subscribers, get_grb_subscribers,
    update_last_apod_date, update_last_iss_pass,
    is_launch_notified, mark_launch_notified, cleanup_old_launch_notifications,
    is_neo_notified, mark_neo_notified, cleanup_old_neo_notifications,
    is_news_notified, mark_news_notified, cleanup_old_news_notifications,
    is_meteor_notified, mark_meteor_notified, cleanup_old_meteor_notifications,
    is_flare_notified, mark_flare_notified, cleanup_old_flare_notifications,
    is_storm_notified, mark_storm_notified, cleanup_old_storm_notifications,
    is_grb_notified, mark_grb_notified, cleanup_old_grb_notifications
)
from services import NasaAPI, N2YOAPI

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """Handle scheduled notifications"""

    def __init__(self):
        self.bot = Bot(token=BOT_TOKEN)
        self._last_apod_date = None  # Track last APOD sent
        self._notified_launches: Set[str] = set()  # Track notified launches
        self._notified_eclipses = set()  # Track notified astronomy events

    @staticmethod
    def _is_quiet_hours() -> bool:
        """Return True between 00:00 and 06:00 Kyiv time."""
        return datetime.now(KYIV_TZ).hour < 6

    async def send_apod_to_subscribers(self):
        """Send APOD to all subscribers - once per day"""
        if self._is_quiet_hours():
            return
        try:
            today = datetime.now().strftime('%Y-%m-%d')

            # Skip if already sent today
            if self._last_apod_date == today:
                logger.info(f"APOD already sent today ({today})")
                return

            subscribers = get_apod_subscribers()
            data = NasaAPI.get_apod()

            if not data:
                logger.error("Failed to get APOD data")
                return

            formatted = NasaAPI.format_apod(data)
            apod_date = data.get('date', today)

            if not subscribers:
                logger.info("No APOD subscribers")
                return

            success_count = 0
            for user in subscribers:
                try:
                    chat_id = user.get('chat_id')
                    user_last_apod = user.get('last_apod_date')

                    # Skip if user already got today's APOD
                    if user_last_apod == apod_date:
                        continue

                    # Send based on media type
                    media_type = data.get('media_type', 'image')

                    if media_type == 'video':
                        # Send video
                        await self.bot.send_video(
                            chat_id=chat_id,
                            video=formatted['image'],
                            caption=formatted['caption'][:1024],  # Telegram limit
                            parse_mode=ParseMode.HTML
                        )
                    else:
                        # Send photo
                        await self.bot.send_photo(
                            chat_id=chat_id,
                            photo=formatted['image'],
                            caption=formatted['caption'][:1024],
                            parse_mode=ParseMode.HTML
                        )

                    # Send description as separate message
                    await self.bot.send_message(
                        chat_id=chat_id,
                        text=formatted['text'],
                        parse_mode=ParseMode.HTML
                    )

                    # Update last sent date
                    update_last_apod_date(user['user_id'], apod_date)
                    success_count += 1

                except Exception as e:
                    logger.error(f"Failed to send APOD to {user.get('user_id')}: {e}")

            self._last_apod_date = apod_date
            logger.info(f"Sent APOD to {success_count}/{len(subscribers)} subscribers")

        except Exception as e:
            logger.error(f"APOD scheduler error: {e}")

    @staticmethod
    def _compass_to_uk(compass: str) -> str:
        """Convert English compass direction to Ukrainian"""
        compass_map = {
            'N': 'північ', 'NNE': 'північний схід', 'NE': 'північний схід',
            'ENE': 'північний схід', 'E': 'схід', 'ESE': 'південний схід',
            'SE': 'південний схід', 'SSE': 'південний схід', 'S': 'південь',
            'SSW': 'південний захід', 'SW': 'південний захід',
            'WSW': 'південний захід', 'W': 'захід', 'WNW': 'північний захід',
            'NW': 'північний захід', 'NNW': 'північний захід',
        }
        return compass_map.get(compass, compass)

    async def check_iss_passes(self):
        """Check for upcoming ISS passes and notify subscribers"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Checking ISS passes...")
            subscribers = get_iss_subscribers()

            if not subscribers:
                logger.info("No ISS subscribers")
                return

            now_kyiv = datetime.now(KYIV_TZ)

            for user in subscribers:
                try:
                    user_id = user['user_id']
                    chat_id = user['chat_id']
                    lat = user.get('lat')
                    lon = user.get('lon')

                    if lat is None or lon is None:
                        continue

                    # Get upcoming passes
                    passes = N2YOAPI.get_iss_passes_raw(lat, lon, days=2)

                    if not passes or 'passes' not in passes:
                        continue

                    for iss_pass in passes['passes']:
                        # Convert UTC timestamp to Kyiv time
                        pass_time_utc = datetime.fromtimestamp(
                            iss_pass['startUTC'], tz=timezone.utc
                        )
                        pass_time_kyiv = pass_time_utc.astimezone(KYIV_TZ)
                        time_until = (pass_time_utc - now_kyiv).total_seconds()

                        # Notify if pass is in 10-15 minutes
                        if 600 <= time_until <= 900:
                            # Check if already notified about this specific pass
                            current_pass_timestamp = int(iss_pass['startUTC'])
                            last_notified_pass = user.get('last_iss_pass')

                            if last_notified_pass == current_pass_timestamp:
                                logger.info(f"Already notified user {user_id} about ISS pass at {pass_time_kyiv}")
                                continue

                            duration = iss_pass.get('duration', 0)
                            max_elevation = iss_pass.get('maxEl', 0)
                            start_dir = self._compass_to_uk(iss_pass.get('startAzCompass', 'SW'))
                            max_dir = self._compass_to_uk(iss_pass.get('maxAzCompass', ''))
                            end_dir = self._compass_to_uk(iss_pass.get('endAzCompass', ''))
                            magnitude = iss_pass.get('mag')

                            msg = f"🛰 <b>Проліт МКС!</b>\n\n"
                            msg += f"⏰ Час: {pass_time_kyiv.strftime('%d.%m %H:%M')} (київський)\n"
                            msg += f"⏱ Тривалість: {duration} сек\n"
                            msg += f"📐 Максимальна висота: {max_elevation}°\n"
                            if magnitude is not None:
                                msg += f"🔆 Яскравість: {magnitude:.1f} магнітуди\n"
                            msg += f"📍 Місто: {user.get('city', 'Ваше місто')}\n"
                            msg += f"🧭 Напрямок: {start_dir}"
                            if max_dir and max_dir != start_dir:
                                msg += f" → {max_dir}"
                            if end_dir and end_dir != start_dir:
                                msg += f" → {end_dir}"
                            msg += "\n"
                            msg += f"<i>Дивіться на {start_dir} небо!</i>"

                            await self.bot.send_message(
                                chat_id=chat_id,
                                text=msg,
                                parse_mode=ParseMode.HTML
                            )

                            update_last_iss_pass(user_id, current_pass_timestamp)
                            break  # Only notify about next pass

                except Exception as e:
                    logger.error(f"Failed to check ISS for {user.get('user_id')}: {e}")

            logger.info("ISS check completed")

        except Exception as e:
            logger.error(f"ISS scheduler error: {e}")

    async def check_upcoming_launches(self):
        """Check for launches happening now and notify subscribers"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Checking upcoming launches...")

            raw_data = LaunchAPI.get_raw_launches()
            if not raw_data:
                logger.warning("No launch data available from API")
                return

            launches = self._parse_launches(raw_data)

            if not launches:
                logger.info("No upcoming launches to notify about")
                return

            subscribers = get_launch_subscribers()
            if not subscribers:
                logger.info("No launch subscribers")
                return

            now = datetime.now()
            notified_count = 0

            for launch in launches:
                launch_id = launch.get('id')
                launch_time = launch.get('time')

                if not launch_time or not launch_id:
                    continue

                time_until = (launch_time - now).total_seconds()

                # Notify only at the moment of launch (within -10 to +5 min window,
                # accounting for 5-minute check interval)
                if not (-600 <= time_until <= 300):
                    continue

                notification_type = "now"
                notification_key = f"{launch_id}_{notification_type}"
                if notification_key in self._notified_launches:
                    continue

                if is_launch_notified(launch_id, notification_type):
                    self._notified_launches.add(notification_key)
                    continue

                await self._send_launch_notification(launch, subscribers)
                self._notified_launches.add(notification_key)
                mark_launch_notified(launch_id, notification_type)
                notified_count += 1

            # Cleanup old notifications from database (once per day at 03:00)
            if now.hour == 3 and now.minute < 5:
                cleanup_old_launch_notifications(days=7)

            logger.info(f"Launch check completed. Sent {notified_count} notifications.")

        except Exception as e:
            logger.error(f"Launch scheduler error: {e}")

    async def check_hazardous_asteroids(self):
        """Check for hazardous asteroids and notify subscribers"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Checking hazardous asteroids...")

            # Get hazardous asteroids for next 7 days
            asteroids = NasaAPI.get_hazardous_asteroids()

            if not asteroids:
                logger.info("No hazardous asteroids found")
                return

            # Get subscribers
            subscribers = get_neo_subscribers()
            if not subscribers:
                logger.info("No NEO subscribers")
                return

            notified_count = 0

            for asteroid in asteroids:
                asteroid_id = asteroid['id']
                approach_date = asteroid['approach_date']

                # Skip if already notified about this asteroid on this date
                if is_neo_notified(asteroid_id, approach_date):
                    continue

                # Format notification message
                name = asteroid['name']
                distance_km = asteroid['miss_distance_km']
                diameter_min = asteroid['diameter_min']
                diameter_max = asteroid['diameter_max']
                velocity = asteroid['velocity']
                url = asteroid['url']

                # Format distance
                if distance_km >= 1_000_000:
                    distance_str = f"{distance_km/1_000_000:.2f} млн км"
                else:
                    distance_str = f"{distance_km/1000:,.0f} тис км".replace(',', ' ')

                message = f"🚨 <b>НЕБЕЗПЕЧНИЙ АСТЕРОЇД!</b>\n\n"
                message += f"🌑 {name}\n"
                message += f"📅 Максимальне наближення: {approach_date}\n"
                message += f"📍 Відстань: {distance_str}\n"
                message += f"📏 Розмір: {diameter_min}-{diameter_max} м\n"
                message += f"🚀 Швидкість: {velocity:,.0f} км/год\n".replace(',', ' ')
                message += f"⚠️ <b>Потенційно небезпечний для Землі</b>\n\n"
                if url:
                    message += f"🔗 <a href='{url}'>Детальніше на NASA JPL</a>"

                # Send to all subscribers
                for user in subscribers:
                    try:
                        await self.bot.send_message(
                            chat_id=user['chat_id'],
                            text=message,
                            parse_mode=ParseMode.HTML,
                            disable_web_page_preview=False
                        )
                    except Exception as e:
                        logger.error(f"Failed to notify {user['user_id']} about hazardous asteroid: {e}")

                # Mark as notified
                mark_neo_notified(asteroid_id, approach_date)
                notified_count += 1
                logger.info(f"Sent hazardous asteroid notification: {name} ({approach_date})")

            logger.info(f"Hazardous asteroid check completed. Notified about {notified_count} asteroids")

            # Cleanup old notifications once per day (at 4 AM)
            now = datetime.now()
            if now.hour == 4 and now.minute < 5:
                cleanup_old_neo_notifications(days=30)

        except Exception as e:
            logger.error(f"Hazardous asteroid scheduler error: {e}")

    async def check_solar_flares(self):
        """Check for M-class and X-class solar flares and alert subscribers"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Checking solar flares...")

            # Check for X-class first (most severe)
            x_flare = SpaceWeatherAPI.check_significant_flare(min_class='X')
            m_flare = None
            if not x_flare:
                # If no X-class, check for M-class
                m_flare = SpaceWeatherAPI.check_significant_flare(min_class='M')

            flare = x_flare or m_flare
            if not flare:
                logger.info("No significant solar flare detected")
                return

            flare_class = flare['class']
            flare_time = flare['time']

            # Check if already notified about this specific flare
            if is_flare_notified(flare_class, flare_time):
                logger.info(f"Already notified about {flare_class}-class flare at {flare_time}")
                return

            # Get dedicated flare subscribers
            subscribers = get_flare_subscribers()
            if not subscribers:
                logger.info("No subscribers for solar flare alerts")
                return

            # Build message based on class
            if flare_class == 'X':
                header = "🌞 <b>X-КЛАС СОНЯЧНИЙ СПАЛАХ!</b>\n\n"
                consequences = (
                    "📡 Можливі наслідки:\n"
                    "• Радіозатемнення на коротких хвилях\n"
                    "• Полярне сяйво через 1-3 дні\n"
                    "• Підвищений Kp-індекс\n"
                    "• Загроза для супутників\n"
                )
            else:
                header = "🌞 <b>M-КЛАС СОНЯЧНИЙ СПАЛАХ!</b>\n\n"
                consequences = (
                    "📡 Можливі наслідки:\n"
                    "• Слабке радіозатемнення\n"
                    "• Можливе полярне сяйво\n"
                    "• Слідкуйте за Kp-індексом\n"
                )

            description = SpaceWeatherAPI.get_flare_description(flare_class)
            emoji = SpaceWeatherAPI.get_flare_emoji(flare_class)

            message = (
                f"{header}"
                f"{emoji} Клас: {flare_class} ({description})\n"
                f"⚡ Флюс: {flare['flux']:.2e} Вт/м²\n"
                f"🕐 Час: {flare_time}\n\n"
                f"{consequences}\n"
                "<i>Дані: NOAA GOES</i>"
            )

            for user in subscribers:
                try:
                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML,
                    )
                except Exception as e:
                    logger.error(f"Failed to notify {user['user_id']} about solar flare: {e}")

            # Mark as notified
            mark_flare_notified(flare_class, flare_time, flare['flux'])
            logger.info(f"Sent {flare_class}-class solar flare alert to {len(subscribers)} users")

            # Cleanup old notifications once per day (at 5 AM)
            now = datetime.now()
            if now.hour == 5 and now.minute < 5:
                cleanup_old_flare_notifications(days=7)

        except Exception as e:
            logger.error(f"Solar flare check error: {e}")

    async def check_geomagnetic_storms(self):
        """Check for geomagnetic storms (Kp >= 5) and notify subscribers"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Checking geomagnetic storms...")

            storm = SpaceWeatherAPI.check_geomagnetic_storm()
            if not storm:
                logger.info("No geomagnetic storm detected")
                return

            kp = storm['kp']
            kp_time = storm['kp_time']
            g_scale = storm['g_scale']
            g_scale_full = storm['g_scale_full']
            solar_wind = storm.get('solar_wind')
            bz = storm.get('bz')
            forecast = storm.get('forecast')

            # Check if already notified about this Kp observation
            kp_str = f"{kp:.1f}"
            if is_storm_notified(kp_str, kp_time):
                logger.info(f"Already notified about Kp {kp_str} at {kp_time}")
                return

            # Get subscribers (reuse flare subscription for all space weather)
            subscribers = get_flare_subscribers()
            if not subscribers:
                logger.info("No solar activity subscribers")
                return

            # Build message
            kp_emoji = "🟠" if kp < 7 else "🔴"
            message = f"{kp_emoji} <b>ГЕОМАГНІТНА БУРЯ!</b>\n\n"
            message += f"📊 Індекс Kp: {kp:.1f}/9\n"
            message += f"⚠️ Шкала: {g_scale_full}\n"
            message += f"🕐 Час: {kp_time}\n"

            # Solar wind details
            if solar_wind:
                speed = solar_wind['speed']
                speed_status = SpaceWeatherAPI._get_solar_wind_status(speed)
                message += f"\n💨 <b>Сонячний вітер</b>\n"
                message += f"Швидкість: {speed:.0f} км/с — {speed_status}\n"
                message += f"Щільність: {solar_wind['density']:.1f} ч/см³\n"

            # Magnetic field
            if bz is not None:
                bz_status = SpaceWeatherAPI._get_bz_status(bz)
                bz_emoji = SpaceWeatherAPI._get_bz_emoji(bz)
                message += f"\n🧲 <b>Магнітне поле Bz</b>\n"
                message += f"{bz_emoji} Bz: {bz:.1f} нТл — {bz_status}\n"

            # Possible effects
            if g_scale == "G1":
                effects = "Слабке полярне сяйво на високих широтах"
            elif g_scale == "G2":
                effects = "Полярне сяйво, можливі перешкоди зв'язку на півночі"
            elif g_scale == "G3":
                effects = "Сяйво на середніх широтах, перешкоди навігації та зв'язку"
            elif g_scale == "G4":
                effects = "Сяйво на півдні, проблеми з електроенергією та супутниками"
            else:
                effects = "Сяйво видно всюди, серйозні проблеми з енергомережею та супутниками!"

            message += f"\n🌌 <b>Можливі наслідки:</b>\n{effects}\n"

            # Aurora hint for Ukraine (lat ~48-50)
            if kp >= 5:
                message += "\n🌃 <b>Полярне сяйво:</b> "
                if kp >= 8:
                    message += "Може бути видно навіть в Україні! 🔴"
                elif kp >= 6:
                    message += "Можливо на півночі України 🟠"
                else:
                    message += "Малоймовірно в Україні, але спостерігайте 🟡"

            # Forecast
            if forecast:
                message += "\n\n📅 <b>Прогноз Kp:</b>\n"
                for day in ['Сьогодні', 'Завтра', 'Післязавтра']:
                    if day in forecast:
                        kp_val = forecast[day]
                        emoji = SpaceWeatherAPI._get_kp_emoji_simple(kp_val)
                        message += f"{emoji} {day}: Kp {kp_val:.0f}\n"

            message += "\n<i>Дані: NOAA SWPC</i>"

            for user in subscribers:
                try:
                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML,
                    )
                except Exception as e:
                    logger.error(f"Failed to notify {user['user_id']} about geomagnetic storm: {e}")

            # Mark as notified
            mark_storm_notified(kp_str, kp_time, g_scale)
            logger.info(f"Sent geomagnetic storm alert (Kp={kp_str}, {g_scale}) to {len(subscribers)} users")

            # Cleanup old notifications once per day (at 5 AM)
            now = datetime.now()
            if now.hour == 5 and now.minute < 5:
                cleanup_old_storm_notifications(days=7)

        except Exception as e:
            logger.error(f"Geomagnetic storm check error: {e}")

    async def check_grb_alerts(self):
        """Check for new GRB events and notify subscribers"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Checking GRB alerts...")

            # Get recent GRBs
            recent_grbs = GRBAlertAPI.get_recent_grbs(limit=5)
            if not recent_grbs:
                logger.info("No recent GRBs found")
                return

            # Get subscribers
            subscribers = get_grb_subscribers()
            if not subscribers:
                logger.info("No GRB subscribers")
                return

            notified_count = 0

            for grb in recent_grbs:
                grb_name = grb['grb_name']

                # Skip if already notified about this GRB
                if is_grb_notified(grb_name):
                    continue

                # Fetch details for richer message
                details = GRBAlertAPI.get_grb_details(grb['circular_id'])

                # Format message
                message = GRBAlertAPI.format_grb_alert(grb, details)

                # Send to all subscribers
                for user in subscribers:
                    try:
                        await self.bot.send_message(
                            chat_id=user['chat_id'],
                            text=message,
                            parse_mode=ParseMode.HTML,
                            disable_web_page_preview=False
                        )
                    except Exception as e:
                        logger.error(f"Failed to notify {user['user_id']} about GRB: {e}")

                # Mark as notified
                mark_grb_notified(grb_name, grb['circular_id'])
                notified_count += 1
                logger.info(f"Sent GRB notification: {grb_name}")

            logger.info(f"GRB check completed. Notified about {notified_count} GRBs")

            # Cleanup old notifications once per day (at 6 AM)
            now = datetime.now()
            if now.hour == 6 and now.minute < 5:
                cleanup_old_grb_notifications(days=30)

        except Exception as e:
            logger.error(f"GRB check error: {e}")

    async def check_astronomy_events(self):
        """Check for upcoming eclipses and notify subscribers"""
        if self._is_quiet_hours():
            return
        try:
            from services.astronomy import get_next_eclipse
            eclipse = get_next_eclipse()
            if not eclipse:
                return

            # Notify 1 day before
            if eclipse['days_until'] == 1:
                key = f"eclipse_{eclipse['date']}"
                if key in self._notified_eclipses:
                    return

                subscribers = get_news_subscribers()
                if not subscribers:
                    return

                emoji = "🌕" if "повне" in eclipse['type'] else "🌑"
                message = (
                    f"{emoji} <b>ЗАВТРА АСТРОНОМІЧНА ПОДІЯ!</b>\n\n"
                    f"<b>{eclipse['name']}</b>\n"
                    f"📅 {eclipse['date']}\n"
                    f"🌍 Видимість: {eclipse['visibility']}\n\n"
                    "🔗 <a href='https://www.timeanddate.com/eclipse/'>Переглянути карту та час</a>\n"
                    "📺 <a href='https://www.youtube.com/@NASA'>Трансляція NASA</a>\n\n"
                    "<i>Не пропустіть!</i>"
                )

                for user in subscribers:
                    try:
                        await self.bot.send_message(
                            chat_id=user['chat_id'],
                            text=message,
                            parse_mode=ParseMode.HTML,
                        )
                    except Exception as e:
                        logger.error(f"Failed to notify {user['user_id']} about eclipse: {e}")

                self._notified_eclipses.add(key)
                logger.info(f"Sent eclipse notification: {eclipse['name']}")

        except Exception as e:
            logger.error(f"Astronomy event check error: {e}")

    async def send_daily_news(self):
        """Send daily news digest from Spaceflightnow"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Sending daily news...")

            # Get news articles
            articles = SpaceflightNowParser.get_news()

            if not articles:
                logger.info("No news articles found")
                return

            # Get subscribers
            subscribers = get_news_subscribers()
            if not subscribers:
                logger.info("No news subscribers")
                return

            # Filter out already sent articles
            new_articles = []
            for article in articles:
                if not is_news_notified(article['url']):
                    new_articles.append(article)

            if not new_articles:
                logger.info("No new articles to send")
                return

            # Format news digest (top 3 articles)
            today = datetime.now().strftime('%d.%m.%Y')
            message = f"📰 <b>Космічні новини ({today})</b>\n"
            message += "<i>Джерело: spaceflightnow.com</i>\n\n"

            # Batch translate all titles and excerpts in one API call
            texts_to_translate = []
            for article in new_articles[:3]:
                texts_to_translate.append(article['title'])
                if article.get('excerpt'):
                    texts_to_translate.append(article['excerpt'])

            translated = Translator.translate_batch(texts_to_translate)
            trans_idx = 0

            for i, article in enumerate(new_articles[:3], 1):
                title = article['title']
                excerpt = article['excerpt']
                url = article['url']
                category = article['category']

                title_uk = translated[trans_idx]
                trans_idx += 1
                excerpt_uk = translated[trans_idx] if excerpt else ''
                if excerpt:
                    trans_idx += 1

                # Category emoji
                cat_emoji = "🚀"
                if 'starlink' in category.lower() or 'falcon' in category.lower():
                    cat_emoji = "🛰️"
                elif 'artemis' in category.lower() or 'moon' in category.lower():
                    cat_emoji = "🌙"
                elif 'mars' in category.lower():
                    cat_emoji = "🔴"
                elif 'iss' in category.lower():
                    cat_emoji = "🛰️"

                message += f"{i}. {cat_emoji} <b>{title_uk}</b>\n"
                if excerpt_uk:
                    # Truncate excerpt if too long
                    if len(excerpt_uk) > 150:
                        excerpt_uk = excerpt_uk[:150] + "..."
                    message += f"   {excerpt_uk}\n"
                message += f"   🔗 <a href='{url}'>Читати далі</a>\n\n"

                # Mark as notified
                mark_news_notified(article['url'], article['title'])

            message += "\n<i>📝 Новини автоматично перекладено українською</i>"

            # Send to all subscribers
            sent_count = 0
            for user in subscribers:
                try:
                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML,
                        disable_web_page_preview=True
                    )
                    sent_count += 1
                except Exception as e:
                    logger.error(f"Failed to send news to {user['user_id']}: {e}")

            logger.info(f"Sent daily news to {sent_count}/{len(subscribers)} subscribers")

            # Cleanup old notifications once per day (at 5 AM)
            now = datetime.now()
            if now.hour == 5 and now.minute < 5:
                cleanup_old_news_notifications(days=30)

        except Exception as e:
            logger.error(f"Daily news scheduler error: {e}")

    async def check_meteor_showers(self):
        """Check for upcoming meteor showers and notify subscribers"""
        if self._is_quiet_hours():
            return
        try:
            logger.info("Checking meteor showers...")

            now = datetime.now()

            # Get upcoming showers
            showers = MeteorShower.get_upcoming_showers(3)

            if not showers:
                logger.info("No upcoming meteor showers")
                return

            # Get subscribers
            subscribers = get_meteor_subscribers()
            if not subscribers:
                logger.info("No meteor shower subscribers")
                return

            for shower in showers:
                shower_name = shower['name']
                peak_date = shower['peak_datetime']
                days_until = shower['days_until']

                peak_date_str = peak_date.strftime('%Y-%m-%d')

                # Notification 1 day before at 22:00
                if days_until == 1 and now.hour == 22 and now.minute == 0:
                    notification_type = "1day"

                    if is_meteor_notified(shower_name, peak_date_str, notification_type):
                        continue

                    message = f"🌠 <b>ЗАВТРА МЕТЕОРНИЙ ПОТІК!</b>\n\n"
                    message += f"✨ {shower_name} ({shower['name_en']})\n"
                    message += f"📅 Пік: {peak_date.strftime('%d.%m.%Y')}\n"
                    message += f"💫 До {shower['rate']} метеорів/год\n"
                    message += f"🕐 Найкращий час: {shower['best_time']}\n"
                    message += f"📍 Дивіться: {shower['direction']}\n\n"
                    message += f"📝 {shower['description']}\n\n"
                    message += "<i>Не забудьте встановити будильник на вечір!</i>"

                    for user in subscribers:
                        try:
                            await self.bot.send_message(
                                chat_id=user['chat_id'],
                                text=message,
                                parse_mode=ParseMode.HTML
                            )
                        except Exception as e:
                            logger.error(f"Failed to notify {user['user_id']} about meteor shower: {e}")

                    mark_meteor_notified(shower_name, peak_date_str, notification_type)
                    logger.info(f"Sent 1-day notification for {shower_name}")

                # Notification on the day at 22:00 (10 PM)
                elif days_until == 0 and now.hour == 22 and now.minute == 0:
                    notification_type = "today"

                    if is_meteor_notified(shower_name, peak_date_str, notification_type):
                        continue

                    message = f"🔥 <b>СЬОГОДНІ ПІК МЕТЕОРНОГО ПОТОКУ!</b>\n\n"
                    message += f"✨ {shower_name} ({shower['name_en']})\n"
                    message += f"💫 До {shower['rate']} метеорів/год\n"
                    message += f"🕐 Найкращий час: {shower['best_time']}\n"
                    message += f"📍 Дивіться: {shower['direction']}\n\n"
                    message += f"📝 {shower['description']}\n\n"
                    message += "<b>🌟 Виходьте спостерігати зараз!</b>\n"
                    message += "💡 Лягайте на спину і дивіться на північний схід"

                    for user in subscribers:
                        try:
                            await self.bot.send_message(
                                chat_id=user['chat_id'],
                                text=message,
                                parse_mode=ParseMode.HTML
                            )
                        except Exception as e:
                            logger.error(f"Failed to notify {user['user_id']} about meteor shower peak: {e}")

                    mark_meteor_notified(shower_name, peak_date_str, notification_type)
                    logger.info(f"Sent today notification for {shower_name}")

            # Cleanup old notifications once per day (at 6 AM)
            if now.hour == 6 and now.minute < 5:
                cleanup_old_meteor_notifications(days=60)

            logger.info("Meteor shower check completed")

        except Exception as e:
            logger.error(f"Meteor shower scheduler error: {e}")

    def _parse_launches(self, launches_data: dict) -> list:
        """Parse launches from API response"""
        launches = []

        try:
            # Handle LaunchLibrary v2.2.0 format
            results = launches_data.get('results', [])

            for result in results:
                try:
                    launch_id = result.get('id')
                    name = result.get('name', 'Unknown Launch')
                    net = result.get('net')  # ISO format datetime

                    if net:
                        # Parse ISO datetime
                        launch_time = datetime.fromisoformat(net.replace('Z', '+00:00'))
                        launch_time = launch_time.replace(tzinfo=None)  # Make naive

                        # Get info URL for livestream (SpaceX page or fallback)
                        info_urls = result.get('info_urls', [])
                        live_url = info_urls[0]['url'] if info_urls else 'https://spaceflightnow.com/launch-schedule/'

                        launches.append({
                            'id': str(launch_id),
                            'name': name,
                            'time': launch_time,
                            'url': live_url
                        })
                except Exception as e:
                    logger.warning(f"Failed to parse launch: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error parsing launches: {e}")

        return launches

    async def _send_launch_notification(self, launch: dict, subscribers: list):
        """Send launch notification to subscribers"""
        try:
            launch_name = launch.get('name', 'Rocket Launch')
            launch_time = launch.get('time', datetime.now())
            live_url = launch.get('url', 'https://spaceflightnow.com/launch-schedule/')

            message = f"🚀 <b>Запуск ракети відбувається зараз!</b>\n\n"
            message += f"🚀 {launch_name}\n"
            message += f"📅 {launch_time.strftime('%d.%m.%Y %H:%M UTC')}\n"
            message += f"\n<i>📺 <a href='{live_url}'>Дивіться трансляцію</a></i>"

            for user in subscribers:
                try:
                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML
                    )
                except Exception as e:
                    logger.error(f"Failed to notify {user['user_id']}: {e}")

            logger.info(f"Sent launch notification to {len(subscribers)} users for {launch_name}")

        except Exception as e:
            logger.error(f"Launch notification error: {e}")

    async def run_scheduled_tasks(self):
        """Main scheduler loop - runs every minute"""
        logger.info("Scheduler started")

        while True:
            try:
                now = datetime.now(KYIV_TZ)

                # APOD at 09:00 Kyiv time (with 1-minute window)
                if now.hour == 9 and 0 <= now.minute <= 1:
                    await self.send_apod_to_subscribers()

                # Check ISS passes every 10 minutes
                if now.minute % 10 == 0:
                    await self.check_iss_passes()

                # Check launches every 5 minutes
                if now.minute % 5 == 0:
                    await self.check_upcoming_launches()

                # Check hazardous asteroids every hour
                if now.minute == 0:
                    await self.check_hazardous_asteroids()

                # Check solar flares every hour
                if now.minute == 0:
                    await self.check_solar_flares()

                # Check geomagnetic storms every hour
                if now.minute == 0:
                    await self.check_geomagnetic_storms()

                # Check GRB alerts every 30 minutes
                if now.minute % 30 == 0:
                    await self.check_grb_alerts()

                # Daily news at 10:00 Kyiv time
                if now.hour == 10 and now.minute == 0:
                    await self.send_daily_news()

                # Check astronomy events at 10:00
                if now.hour == 10 and now.minute == 0:
                    await self.check_astronomy_events()

                # Check meteor showers at 22:00 (10 PM)
                if now.hour == 22 and now.minute == 0:
                    await self.check_meteor_showers()

                # Sleep for 1 minute
                await asyncio.sleep(60)

            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)


async def start_scheduler():
    """Start the notification scheduler"""
    scheduler = NotificationScheduler()
    await scheduler.run_scheduled_tasks()
