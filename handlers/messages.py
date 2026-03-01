"""Message handlers for text input"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from database import geocode_city, get_city_suggestions, update_user_location
from handlers.callbacks import CallbackHandlers
import logging

logger = logging.getLogger(__name__)

# Import user_states from callbacks
from handlers.callbacks import user_states


class MessageHandlers:
    """Handle text messages"""
    
    @staticmethod
    async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Main message router"""
        user_id = update.effective_user.id
        
        # Check if user is waiting to enter city
        if user_id in user_states and user_states[user_id] == 'waiting_for_city':
            await MessageHandlers.handle_city_input(update, context)
        else:
            # Unknown message - show menu
            await update.message.reply_text(
                "🚀 <b>NEOwatch</b>\n\nВикористовуй кнопки меню або команду /start",
                parse_mode='HTML',
                reply_markup=CallbackHandlers.get_main_menu()
            )
    
    @staticmethod
    async def handle_city_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle city name input"""
        user_id = update.effective_user.id
        city_name = update.message.text.strip()
        
        try:
            # First try direct geocoding
            lat, lon, display_name = geocode_city(city_name)
            update_user_location(user_id, lat, lon, city_name)
            
            # Clear state
            del user_states[user_id]
            
            await update.message.reply_text(
                f"✅ Місто встановлено: <b>{city_name}</b>\n"
                f"📍 Координати: {lat:.4f}, {lon:.4f}",
                parse_mode='HTML',
                reply_markup=CallbackHandlers.get_main_menu()
            )
            
        except Exception as e:
            logger.warning(f"Direct geocoding failed for {city_name}: {e}")
            
            # Try to get suggestions
            try:
                suggestions = get_city_suggestions(city_name)
                
                if suggestions:
                    keyboard = []
                    message = "🌍 Знайдено кілька варіантів. Обери своє місто:\n\n"
                    
                    for i, city in enumerate(suggestions[:5], 1):
                        name = city['name']
                        country = city.get('country', '')
                        display = f"{name}, {country}" if country else name
                        message += f"{i}. {display}\n"
                        keyboard.append([
                            InlineKeyboardButton(display, callback_data=f"city_{name}")
                        ])
                    
                    keyboard.append([
                        InlineKeyboardButton("🔙 Назад", callback_data='back_menu')
                    ])
                    
                    await update.message.reply_text(
                        message,
                        parse_mode='HTML',
                        reply_markup=InlineKeyboardMarkup(keyboard)
                    )
                else:
                    await update.message.reply_text(
                        f"❌ Не вдалося знайти місто '\u003cb>{city_name}</b>'\n\n"
                        f"Спробуй ще раз або вибери інше місто.",
                        parse_mode='HTML',
                        reply_markup=InlineKeyboardMarkup([[
                            InlineKeyboardButton("🔙 Назад", callback_data='back_menu')
                        ]])
                    )
                    
            except Exception as e2:
                logger.error(f"City suggestions failed: {e2}")
                await update.message.reply_text(
                    "❌ Помилка при пошуку міста. Спробуй інше місто.",
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton("🔙 Назад", callback_data='back_menu')
                    ]])
                )
