"""Scheduled jobs - APOD daily, ISS passes, Launch notifications"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Set
from telegram import Bot
from telegram.constants import ParseMode

from config import BOT_TOKEN
from services import LaunchAPI
from services.meteor_shower import MeteorShower
from parsers import SpaceflightNowParser
from utils.translator import Translator
from database import (
    get_apod_subscribers, get_launch_subscribers, get_iss_subscribers, get_neo_subscribers, get_news_subscribers, get_meteor_subscribers,
    update_last_apod_date, update_last_iss_pass,
    is_launch_notified, mark_launch_notified, cleanup_old_launch_notifications,
    is_neo_notified, mark_neo_notified, cleanup_old_neo_notifications,
    is_news_notified, mark_news_notified, cleanup_old_news_notifications,
    is_meteor_notified, mark_meteor_notified, cleanup_old_meteor_notifications
)
from services import NasaAPI, N2YOAPI

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """Handle scheduled notifications"""
    
    def __init__(self):
        self.bot = Bot(token=BOT_TOKEN)
        self._last_apod_date = None  # Track last APOD sent
        self._notified_launches: Set[str] = set()  # Track notified launches
        self._last_iss_check = {}  # user_id -> last_check_time
    
    async def send_apod_to_subscribers(self):
        """Send APOD to all subscribers - once per day"""
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
    
    async def check_iss_passes(self):
        """Check for upcoming ISS passes and notify subscribers"""
        try:
            logger.info("Checking ISS passes...")
            subscribers = get_iss_subscribers()
            
            if not subscribers:
                logger.info("No ISS subscribers")
                return
            
            now = datetime.now()
            
            for user in subscribers:
                try:
                    user_id = user['user_id']
                    chat_id = user['chat_id']
                    lat = user.get('lat')
                    lon = user.get('lon')
                    
                    if lat is None or lon is None:
                        continue
                    
                    # Check if we already notified about ISS pass recently (within 30 min)
                    last_check = self._last_iss_check.get(user_id)
                    if last_check and (now - last_check).seconds < 1800:
                        continue
                    
                    # Get upcoming passes
                    passes = N2YOAPI.get_iss_passes_raw(lat, lon, days=2)
                    
                    if not passes or 'passes' not in passes:
                        continue
                    
                    # Check for passes within next 6 hours
                    for iss_pass in passes['passes']:
                        pass_time = datetime.fromtimestamp(iss_pass['startUTC'])
                        time_until = (pass_time - now).total_seconds()

                        # Notify if pass is in 10-15 minutes (right before it happens)
                        if 600 <= time_until <= 900:  # 10-15 minutes
                            # Check if already notified about this specific pass
                            last_notified_pass = user.get('last_iss_pass')
                            current_pass_timestamp = int(pass_time.timestamp())

                            if last_notified_pass == current_pass_timestamp:
                                logger.info(f"Already notified user {user_id} about ISS pass at {pass_time}")
                                continue

                            duration = iss_pass.get('duration', 0)
                            max_elevation = iss_pass.get('maxEl', 0)

                            msg = f"🛰 <b>Проліт МКС!</b>\n\n"
                            msg += f"⏰ Час: {pass_time.strftime('%d.%m %H:%M')}\n"
                            msg += f"⏱ Тривалість: {duration} сек\n"
                            msg += f"📐 Максимальна висота: {max_elevation}°\n"
                            msg += f"📍 Місце: {user.get('city', 'Ваше місто')}\n\n"
                            msg += "<i>Дивіться на південно-західне небо!</i>"

                            await self.bot.send_message(
                                chat_id=chat_id,
                                text=msg,
                                parse_mode=ParseMode.HTML
                            )

                            update_last_iss_pass(user_id, current_pass_timestamp)
                            self._last_iss_check[user_id] = now
                            break  # Only notify about next pass
                    
                except Exception as e:
                    logger.error(f"Failed to check ISS for {user.get('user_id')}: {e}")
            
            logger.info("ISS check completed")
            
        except Exception as e:
            logger.error(f"ISS scheduler error: {e}")
    
    async def check_upcoming_launches(self):
        """Check for upcoming launches and notify subscribers"""
        try:
            logger.info("Checking upcoming launches...")

            # Get raw launches data (not formatted text)
            raw_data = LaunchAPI.get_raw_launches()
            if not raw_data:
                logger.warning("No launch data available from API")
                return

            launches = self._parse_launches(raw_data)

            if not launches:
                logger.info("No upcoming launches to notify about")
                return

            # Get subscribers
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

                # Skip launches already in the past or too far in the future
                if time_until <= 0 or time_until > 90000:  # > 25 hours
                    continue

                # Determine notification type based on time window
                notification_type = None
                hours = None
                minutes = None

                if 82800 < time_until <= 86400:  # 23-24 hours
                    notification_type = "24h"
                    hours = 24
                elif 3600 < time_until <= 7200:  # 1-2 hours
                    notification_type = "2h"
                    hours = 2
                elif 1500 < time_until <= 1800:  # 25-30 minutes
                    notification_type = "30m"
                    minutes = 30

                if not notification_type:
                    continue

                # Check if already notified (in-memory + database)
                notification_key = f"{launch_id}_{notification_type}"
                if notification_key in self._notified_launches:
                    continue

                if is_launch_notified(launch_id, notification_type):
                    self._notified_launches.add(notification_key)
                    continue

                # Send notification
                await self._send_launch_notification(
                    launch, subscribers, hours=hours, minutes=minutes
                )
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

    async def send_daily_news(self):
        """Send daily news digest from Spaceflightnow"""
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
    
    async def _send_launch_notification(self, launch: dict, subscribers: list,
                                        hours: int = None, minutes: int = None):
        """Send launch notification to subscribers"""
        try:
            launch_name = launch.get('name', 'Rocket Launch')
            launch_time = launch.get('time', datetime.now())
            
            if hours:
                when_text = f"через {hours} години"
                emoji = "⏰"
            else:
                when_text = f"через {minutes} хвилин"
                emoji = "🚨"
            
            live_url = launch.get('url', 'https://spaceflightnow.com/launch-schedule/')

            message = f"{emoji} <b>Запуск ракети {when_text}!</b>\n\n"
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
                now = datetime.now()
                
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

                # Daily news at 10:00 Kyiv time
                if now.hour == 10 and now.minute == 0:
                    await self.send_daily_news()

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
