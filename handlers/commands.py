"""Command handlers for bot"""
from telegram import Update
from telegram.ext import ContextTypes
from database import create_or_update_user
from utils.keyboards import get_main_menu
import logging

logger = logging.getLogger(__name__)


class CommandHandlers:
    """Handle Telegram commands"""
    
    @staticmethod
    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command"""
        user = update.effective_user
        user_id = user.id
        username = user.username
        
        # Create/update user in database
        create_or_update_user(
            user_id=user_id,
            chat_id=update.effective_chat.id,
            username=username,
            first_name=user.first_name,
            last_name=user.last_name
        )
        
        message = f"🛰️ <b>NEOwatch — Твій провідник у космосі</b>\n\n"
        message += f"Привіт, {user.first_name}! 👋\n\n"
        message += "Обери, що тебе цікавить:\n\n"
        message += "🛰️ <b>МКС</b> — де зараз, проходження, екіпаж, Starlink\n"
        message += "🚀 <b>Запуски</b> — ракети SpaceX, NASA та інших\n"
        message += "🌑 <b>Астероїди</b> — небезпечні об'єкти поблизу Землі\n"
        message += "🌌 <b>Фото дня</b> — вражаючі кадри від NASA\n"
        message += "☀️ <b>Космопогода</b> — полярне сяйво, сонячна активність, Марс\n"
        message += "🔭 <b>Небо</b> — метеори, астроподії, фаза Місяця\n\n"
        message += "📍 <b>Важливо:</b> вкажи своє місто в налаштуваннях, щоб отримувати персональні сповіщення!"
        
        await update.message.reply_text(
            message,
            reply_markup=get_main_menu(),
            parse_mode='HTML'
        )
    
    @staticmethod
    async def help(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        await CommandHandlers.start(update, context)
