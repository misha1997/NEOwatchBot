"""Command handlers for bot"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from database import init_db, create_or_update_user, get_user
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
        create_or_update_user(user_id, username)
        
        message = f"🚀 <b>NEOwatch - Космічний бот</b>\n\n"
        message += f"Привіт, {user.first_name}! 👋\n\n"
        message += "Я допоможу тобі стежити за космосом:\n"
        message += "🌑 Астероїди поблизу Землі\n"
        message += "🛰️ Позиція МКС\n"
        message += "📡 Проходження МКС над твоїм містом\n"
        message += "🌌 Фото дня від NASA\n"
        message += "🚀 Запуски ракет\n"
        message += "👨‍🚀 Екіпаж МКС\n"
        message += "🛰️ Проходження Starlink\n"
        message += "🌌 Космічна погода\n\n"
        message += "📍 Спочатку вкажи своє місто в налаштуваннях!"
        
        keyboard = [
            [
                InlineKeyboardButton("🌑 Астероїди", callback_data='neo'),
                InlineKeyboardButton("🌌 Фото дня", callback_data='apod'),
                InlineKeyboardButton("🚀 Запуски", callback_data='launches'),
            ],
            [
                InlineKeyboardButton("🛰️ МКС зараз", callback_data='iss_now'),
                InlineKeyboardButton("📡 Проходження", callback_data='iss_passes'),
                InlineKeyboardButton("👨‍🚀 Екіпаж", callback_data='iss_crew'),
            ],
            [
                InlineKeyboardButton("🛰️ Starlink", callback_data='starlink'),
                InlineKeyboardButton("🌌 Космопогода", callback_data='space_weather'),
            ],
            [
                InlineKeyboardButton("🌙 Фаза місяця", callback_data='moon'),
                InlineKeyboardButton("🔴 Погода на Марсі", callback_data='mars'),
            ],
            [
                InlineKeyboardButton("📍 Вказати місто", callback_data='set_location'),
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
