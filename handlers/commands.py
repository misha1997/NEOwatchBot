"""Command handlers for bot"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from database import create_or_update_user
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
        message += "Я допоможу тобі відстежувати все, що відбувається над головою:\n\n"
        message += "🌑 <b>Астероїди</b> — небезпечні об'єкти поблизу Землі\n"
        message += "🛰️ <b>МКС</b> — позиція та проходження над твоїм містом\n"
        message += "🚀 <b>Запуски</b> — ракети SpaceX, NASA та інших\n"
        message += "🌠 <b>Метеори</b> — потоки зірок у нічному небі\n"
        message += "🌌 <b>Фото дня</b> — вражаючі кадри від NASA\n"
        message += "👨‍🚀 <b>Екіпаж</b> — хто зараз у космосі\n"
        message += "🛰️ <b>Starlink</b> — ланцюжок супутників Ілона Маска\n"
        message += "☀️ <b>Космопогода</b> — полярне сяйво та сонячна активність\n"
        message += "👽 <b>Марс</b> — погода на Червоній планеті\n\n"
        message += "📍 <b>Важливо:</b> вкажи своє місто в налаштуваннях, щоб отримувати персональні сповіщення про проходження МКС та метеорів!"
        
        keyboard = [
            [
                InlineKeyboardButton("🌑 Астероїди", callback_data='neo'),
                InlineKeyboardButton("🌠 Метеоритні потоки", callback_data='meteor_showers'),
            ],
            [
                InlineKeyboardButton("🌌 Фото дня", callback_data='apod'),
                InlineKeyboardButton("🚀 Запуски", callback_data='launches'),
                InlineKeyboardButton("🛰️ Starlink", callback_data='starlink'),
            ],
            [
                InlineKeyboardButton("🛰️ МКС зараз", callback_data='iss_now'),
                InlineKeyboardButton("📡 МКС Проходження", callback_data='iss_passes'),
                InlineKeyboardButton("👨‍🚀 Екіпаж", callback_data='iss_crew'),
            ],
            [
                InlineKeyboardButton("☀️ Космопогода", callback_data='space_weather'),
                InlineKeyboardButton("👽 Погода на Марсі", callback_data='mars'),
            ],
            [
                InlineKeyboardButton("🌙 Фаза місяця", callback_data='moon'),
            ],
            [
                InlineKeyboardButton("⚙️ Налаштування", callback_data='settings'),
            ]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            message, 
            reply_markup=reply_markup,
            parse_mode='HTML'
        )
    
    @staticmethod
    async def help(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        await CommandHandlers.start(update, context)
