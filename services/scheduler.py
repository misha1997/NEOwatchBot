"""Scheduled jobs - APOD daily, ISS passes, Launch notifications"""
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional
from telegram import Bot
from telegram.constants import ParseMode

from config import BOT_TOKEN
from services import LaunchAPI
from database import (
    get_apod_subscribers, get_launch_subscribers, get_iss_subscribers,
    update_last_apod_date, get_user, update_last_iss_pass
)
from services import NasaAPI, N2YOAPI

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """Handle scheduled notifications"""
    
    def __init__(self):
        self.bot = Bot(token=BOT_TOKEN)
    
    async def send_apod_to_subscribers(self):
        """Send APOD to all subscribers"""
        try:
            subscribers = get_apod_subscribers()
            data = NasaAPI.get_apod()
            
            if not data:
                logger.error("Failed to get APOD data")
                return
            
            formatted = NasaAPI.format_apod(data)
            today = data.get('date', datetime.now().strftime('%Y-%m-%d'))
            
            for user in subscribers:
                try:
                    chat_id = user.get('chat_id')
                    last_apod = user.get('last_apod_date')
                    
                    # Skip if already sent today
                    if last_apod == today:
                        continue
                    
                    # Send photo with caption
                    await self.bot.send_photo(
                        chat_id=chat_id,
                        photo=formatted['image'],
                        caption=formatted['caption'],
                        parse_mode=ParseMode.HTML
                    )
                    
                    # Send description
                    await self.bot.send_message(
                        chat_id=chat_id,
                        text=formatted['text'],
                        parse_mode=ParseMode.HTML
                    )
                    
                    # Update last sent date
                    update_last_apod_date(user['user_id'], today)
                    
                except Exception as e:
                    logger.error(f"Failed to send APOD to {user.get('user_id')}: {e}")
                    
            logger.info(f"Sent APOD to {len(subscribers)} subscribers")
            
        except Exception as e:
            logger.error(f"APOD scheduler error: {e}")
    
    async def check_upcoming_launches(self):
        """Check for upcoming launches and notify subscribers"""
        try:
            logger.info("Checking upcoming launches...")
            
            # Get launches
            launches_data = LaunchAPI.get_upcoming_launches()
            if not launches_data:
                return
            
            # Parse launches from text (simplified)
            launches = self._parse_launches(launches_data)
            
            if not launches:
                return
            
            # Get subscribers
            subscribers = get_launch_subscribers()
            if not subscribers:
                logger.info("No launch subscribers")
                return
            
            for launch in launches:
                launch_time = launch.get('time')
                if not launch_time:
                    continue
                
                # Check if launch is within next 24 hours
                now = datetime.now()
                time_until = (launch_time - now).total_seconds()
                
                # Notify 24 hours before
                if 82800 < time_until <= 86400:  # 23-24 hours
                    await self._send_launch_notification(launch, subscribers, hours=24)
                
                # Notify 2 hours before
                elif 3600 < time_until <= 7200:  # 1-2 hours
                    await self._send_launch_notification(launch, subscribers, hours=2)
                
                # Notify 30 minutes before
                elif 1500 < time_until <= 1800:  # 25-30 minutes
                    await self._send_launch_notification(launch, subscribers, minutes=30)
            
            logger.info("Launch check completed")
            
        except Exception as e:
            logger.error(f"Launch scheduler error: {e}")
    
    def _parse_launches(self, launches_data: dict) -> list:
        """Parse launches from API response"""
        launches = []
        
        # Extract from LaunchAPI format
        text = launches_data.get('text', '')
        
        # Simple parsing (for full implementation, track sent launches in DB)
        lines = text.split('\n')
        current_launch = {}
        
        for line in lines:
            if line.startswith('🚀'):
                if current_launch:
                    launches.append(current_launch)
                current_launch = {'name': line.strip()}
            elif '📅' in line and 'current_launch' in locals():
                try:
                    # Simple date extraction
                    date_str = line.replace('📅', '').strip()
                    # Try to parse date (simplified)
                    current_launch['date_str'] = date_str
                except:
                    pass
        
        if current_launch:
            launches.append(current_launch)
        
        return []
    
    async def _send_launch_notification(self, launch: dict, subscribers: list,
                                        hours: int = None, minutes: int = None):
        """Send launch notification to subscribers"""
        try:
            launch_name = launch.get('name', 'Rocket Launch')
            
            if hours:
                when_text = f"через {hours} години!"
                emoji = "⏰"
            else:
                when_text = f"через {minutes} хвилин!"
                emoji = "🚨"
            
            message = f"{emoji} <b>Запуск ракети {when_text}</b>\n\n"
            message += f"🚀 {launch_name}\n"
            if 'date_str' in launch:
                message += f"📅 {launch['date_str']}\n"
            
            message += f"\n<i>Дивіться трансляцію на spaceflightnow.com</i>"
            
            for user in subscribers:
                try:
                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML
                    )
                except Exception as e:
                    logger.error(f"Failed to notify {user['user_id']}: {e}")
            
            logger.info(f"Sent launch notification to {len(subscribers)} users")
            
        except Exception as e:
            logger.error(f"Launch notification error: {e}")
    
    async def run_scheduled_tasks(self):
        """Main scheduler loop"""
        while True:
            try:
                now = datetime.now()
                
                # APOD daily at 09:00 Kyiv time (UTC+2)
                if now.hour == 9 and now.minute == 0:
                    await self.send_apod_to_subscribers()
                
                # Check launches every 10 minutes
                await self.check_upcoming_launches()
                
                # Sleep for 10 minutes
                await asyncio.sleep(600)
                
            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(60)


async def start_scheduler():
    """Start the notification scheduler"""
    scheduler = NotificationScheduler()
    await scheduler.run_scheduled_tasks()
