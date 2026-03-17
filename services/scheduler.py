"""Scheduled jobs - APOD daily, ISS passes, Launch notifications"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Set
from telegram import Bot
from telegram.constants import ParseMode

from config import BOT_TOKEN
from services import LaunchAPI
from database import (
    get_apod_subscribers, get_launch_subscribers, get_iss_subscribers,
    update_last_apod_date, get_user, update_last_iss_pass,
    is_launch_notified, mark_launch_notified, cleanup_old_launch_notifications
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

                        # Notify if pass is in 1-6 hours
                        if 3600 <= time_until <= 21600:  # 1-6 hours
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
            
            # Get launches
            launches_data = LaunchAPI.get_upcoming_launches()
            if not launches_data:
                return
            
            launches = self._parse_launches(launches_data)
            
            if not launches:
                return
            
            # Get subscribers
            subscribers = get_launch_subscribers()
            if not subscribers:
                logger.info("No launch subscribers")
                return
            
            now = datetime.now()
            
            for launch in launches:
                launch_id = launch.get('id')
                launch_time = launch.get('time')
                
                if not launch_time or not launch_id:
                    continue
                
                time_until = (launch_time - now).total_seconds()

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
                    self._notified_launches.add(notification_key)  # Cache for this session
                    continue

                # Send notification
                await self._send_launch_notification(launch, subscribers, hours=hours, minutes=minutes)
                self._notified_launches.add(notification_key)
                mark_launch_notified(launch_id, notification_type)

            # Cleanup old notifications from database (once per day)
            if now.hour == 3 and now.minute < 5:
                cleanup_old_launch_notifications(days=7)
            
            logger.info("Launch check completed")
            
        except Exception as e:
            logger.error(f"Launch scheduler error: {e}")
    
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
                        
                        launches.append({
                            'id': str(launch_id),
                            'name': name,
                            'time': launch_time
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
            
            message = f"{emoji} <b>Запуск ракети {when_text}!</b>\n\n"
            message += f"🚀 {launch_name}\n"
            message += f"📅 {launch_time.strftime('%d.%m.%Y %H:%M UTC')}\n"
            message += f"\n<i>Дивіться трансляцію на spaceflightnow.com або youtube.com/nasaspaceflight</i>"
            
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
                
                # Sleep for 1 minute
                await asyncio.sleep(60)
                
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)


async def start_scheduler():
    """Start the notification scheduler"""
    scheduler = NotificationScheduler()
    await scheduler.run_scheduled_tasks()
