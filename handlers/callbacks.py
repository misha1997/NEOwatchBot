"""Callback query handlers"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from services import NasaAPI, N2YOAPI, LaunchAPI, SpaceWeatherAPI, ISSCrewAPI
from services.moon_mars import MoonMarsAPI
from database import get_user, update_user_location, get_subscription_status, toggle_subscription, geocode_city
import logging

logger = logging.getLogger(__name__)

# User states for conversation
user_states = {}


class CallbackHandlers:
    """Handle inline keyboard callbacks"""
    
    @staticmethod
    async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Main callback router"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        user_id = update.effective_user.id
        
        # Route to appropriate handler
        handlers = {
            'neo': CallbackHandlers.neo,
            'apod': CallbackHandlers.apod,
            'launches': CallbackHandlers.launches,
            'iss_now': CallbackHandlers.iss_now,
            'iss_passes': CallbackHandlers.iss_passes,
            'iss_crew': CallbackHandlers.iss_crew,
            'starlink': CallbackHandlers.starlink,
            'space_weather': CallbackHandlers.space_weather,
            'moon': CallbackHandlers.moon,
            'mars': CallbackHandlers.mars,
            'settings': CallbackHandlers.settings,
            'set_location': CallbackHandlers.set_location,
            'back_menu': CallbackHandlers.back_to_menu,
        }
        
        if data in handlers:
            await handlers[data](update, context)
        elif data.startswith('city_'):
            await CallbackHandlers.handle_city_selection(update, context, data)
        elif data.startswith('sub_'):
            await CallbackHandlers.handle_subscription_toggle(update, context, data)
    
    @staticmethod
    def get_main_menu():
        """Return main menu keyboard"""
        return InlineKeyboardMarkup([
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
        ])
    
    @staticmethod
    async def neo(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle asteroids button"""
        result = NasaAPI.get_asteroids_today()
        await update.callback_query.message.edit_text(
            result, 
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def apod(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle APOD button"""
        data = NasaAPI.get_apod()
        if data:
            formatted = NasaAPI.format_apod(data)
            
            # Check if it's a video
            if data.get('media_type') == 'video':
                video_url = data.get('url', '')
                thumbnail = data.get('thumbnail', '')
                
                # Try to get YouTube thumbnail if it's a YouTube video
                if 'youtube.com' in video_url or 'youtu.be' in video_url:
                    import re
                    # Extract video ID
                    if 'youtu.be' in video_url:
                        video_id = video_url.split('/')[-1].split('?')[0]
                    else:
                        match = re.search(r'[?&]v=([^&]+)', video_url)
                        video_id = match.group(1) if match else ''
                    
                    if video_id:
                        thumbnail = f"https://img.youtube.com/vi/{video_id}/0.jpg"
                
                # If still no thumbnail, use a placeholder or skip
                if not thumbnail:
                    thumbnail = video_url  # fallback
                
                caption = f"🎥 <b>Відео дня від NASA</b>\n\n"
                caption += f"📅 {data.get('date', '')}\n"
                caption += f"🎬 {data.get('title', '')}\n\n"
                caption += f"<a href='{video_url}'>▶️ Дивитись відео</a>\n\n"
                caption += "<i>Повний опис нижче ↓</i>"
                
                try:
                    # Skip sending photo if thumbnail is video file
                    if thumbnail.endswith('.mp4') or thumbnail.endswith('.mov') or thumbnail.endswith('.avi'):
                        raise Exception("Cannot send video as photo")
                    
                    await context.bot.send_photo(
                        chat_id=update.effective_chat.id,
                        photo=thumbnail,
                        caption=caption,
                        parse_mode='HTML'
                    )
                except:
                    # If thumbnail fails, send text with link
                    await update.callback_query.message.reply_text(
                        caption,
                        parse_mode='HTML',
                        disable_web_page_preview=False
                    )
            else:
                # Send photo with short caption
                await context.bot.send_photo(
                    chat_id=update.effective_chat.id,
                    photo=formatted['image'],
                    caption=formatted['caption'],
                    parse_mode='HTML'
                )
            
            # Send full description as separate message
            await update.callback_query.message.reply_text(
                formatted['text'],
                parse_mode='HTML',
                reply_markup=CallbackHandlers.get_main_menu()
            )
        else:
            await update.callback_query.message.reply_text(
                "❌ Не вдалося отримати фото дня",
                reply_markup=CallbackHandlers.get_main_menu()
            )
    
    @staticmethod
    async def launches(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle launches button"""
        result = LaunchAPI.get_upcoming_launches()
        await update.callback_query.message.edit_text(
            result['text'],
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def iss_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle ISS position button"""
        result = N2YOAPI.get_iss_position()
        await update.callback_query.message.edit_text(
            result,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def iss_passes(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle ISS passes button"""
        user = get_user(update.effective_user.id)
        if not user or not user.get('lat'):
            await update.callback_query.message.edit_text(
                "📍 Спочатку встанови своє місто!",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("📍 Вказати місто", callback_data='set_location'),
                    InlineKeyboardButton("🔙 Назад", callback_data='back_menu')
                ]])
            )
            return
        
        lat, lon = user['lat'], user['lon']
        result = N2YOAPI.get_iss_passes(lat, lon)
        await update.callback_query.message.edit_text(
            result,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def iss_crew(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle ISS crew button"""
        crew = ISSCrewAPI.get_iss_crew()
        result = ISSCrewAPI.format_crew_for_telegram(crew)
        await update.callback_query.message.edit_text(
            result,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def starlink(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle Starlink button"""
        user = get_user(update.effective_user.id)
        if not user or not user.get('lat'):
            await update.callback_query.message.edit_text(
                "📍 Спочатку встанови своє місто!",
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton("📍 Вказати місто", callback_data='set_location'),
                    InlineKeyboardButton("🔙 Назад", callback_data='back_menu')
                ]])
            )
            return
        
        lat, lon = user['lat'], user['lon']
        result = N2YOAPI.get_starlink_passes(lat, lon)
        await update.callback_query.message.edit_text(
            result,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def space_weather(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle space weather button"""
        user = get_user(update.effective_user.id)
        lat = user.get('lat') if user else None
        
        result = SpaceWeatherAPI.get_space_weather(user_lat=lat)
        await update.callback_query.message.edit_text(
            result,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def moon(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle moon button"""
        moon_data = MoonMarsAPI.get_moon_phase()
        
        message = "🌙 <b>Фаза Місяця</b>\n\n"
        if moon_data:
            message += f"{moon_data['phase_name']}\n"
            message += f"💡 Освітленість: {moon_data['illumination']}%\n\n"
            if moon_data['days_to_full'] < moon_data['days_to_new']:
                message += f"🌕 Повний Місяць через: {moon_data['days_to_full']} дн.\n"
            else:
                message += f"🌑 Новий Місяць через: {moon_data['days_to_new']} дн.\n"
        else:
            message += "❌ Не вдалося розрахувати фазу\n"
        
        message += "\n📖 Синодичний період: 29.5 днів"
        
        await update.callback_query.message.edit_text(
            message,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def mars(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle mars button"""
        mars_data = MoonMarsAPI.get_mars_weather()
        
        message = "🔴 <b>Погода на Марсі</b>\n\n"
        if mars_data:
            message += f"🌡️ Температура: {mars_data['temp_low']}°C ... {mars_data['temp_high']}°C\n"
            message += f"💨 Тиск: {mars_data['pressure']} Па (~0.6% від Земного)\n"
            message += f"🌬️ Вітер: змінний, до 100 км/год\n\n"
            if mars_data['temp_high'] > -20:
                message += "☀️ Зараз місцеве літо\n"
            else:
                message += "❄️ Зараз місцева зима\n"
            if mars_data['source'] == 'InSight':
                message += f"\n📡 Джерело: InSight, Sol {mars_data.get('sol', '?')}"
            else:
                message += "\n📊 Середні показники для екватора Марса"
        else:
            message += "❌ Не вдалося отримати дані\n"
        
        await update.callback_query.message.edit_text(
            message,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle settings button"""
        user_id = update.effective_user.id
        user = get_user(user_id)
        
        iss_sub = '✅' if user and user.get('subscribed_iss') else '☑️'
        apod_sub = '✅' if user and user.get('subscribed_apod') else '☑️'
        city = user.get('city', 'Не вказано') if user else 'Не вказано'
        
        message = f"⚙️ <b>Налаштування</b>\n\n"
        message += f"📍 Місто: <b>{city}</b>\n\n"
        message += f"🔔 Сповіщення:\n"
        message += f"{iss_sub} Проходження МКС\n"
        message += f"{apod_sub} Фото дня (9:00)\n"
        
        keyboard = [
            [
                InlineKeyboardButton(f"{iss_sub} МКС проходження", callback_data='sub_iss'),
                InlineKeyboardButton(f"{apod_sub} Фото дня", callback_data='sub_apod'),
            ],
            [
                InlineKeyboardButton("📍 Змінити місто", callback_data='set_location'),
            ],
            [
                InlineKeyboardButton("🔙 Головне меню", callback_data='back_menu'),
            ]
        ]
        
        await update.callback_query.message.edit_text(
            message,
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    
    @staticmethod
    async def set_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle set location button"""
        user_id = update.effective_user.id
        user_states[user_id] = 'waiting_for_city'
        
        await update.callback_query.message.edit_text(
            "🌍 Напиши назву свого міста українською або англійською:\n\n"
            "Наприклад: Київ, Kyiv, Львів, Lviv",
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔙 Скасувати", callback_data='back_menu')
            ]])
        )
    
    @staticmethod
    async def handle_city_selection(update: Update, context: ContextTypes.DEFAULT_TYPE, data: str):
        """Handle city selection from list"""
        user_id = update.effective_user.id
        city_name = data.replace('city_', '')
        
        try:
            lat, lon, display_name = geocode_city(city_name)
            update_user_location(user_id, lat, lon, city_name)
            
            await update.callback_query.message.edit_text(
                f"✅ Місто встановлено: <b>{city_name}</b>\n"
                f"📍 Координати: {lat:.4f}, {lon:.4f}",
                parse_mode='HTML',
                reply_markup=CallbackHandlers.get_main_menu()
            )
            
            if user_id in user_states:
                del user_states[user_id]
                
        except Exception as e:
            logger.error(f"City selection error: {e}")
            await update.callback_query.message.edit_text(
                "❌ Помилка при збереженні міста",
                reply_markup=CallbackHandlers.get_main_menu()
            )
    
    @staticmethod
    async def handle_subscription_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE, data: str):
        """Handle subscription toggle"""
        user_id = update.effective_user.id
        sub_type = data.replace('sub_', '')
        
        try:
            new_status = toggle_subscription(user_id, sub_type)
            status_text = 'увімкнено ✅' if new_status else 'вимкнено ☑️'
            
            await update.callback_query.answer(f"Сповіщення {status_text}")
            await CallbackHandlers.settings(update, context)
            
        except Exception as e:
            logger.error(f"Subscription toggle error: {e}")
            await update.callback_query.answer("Помилка при зміні налаштувань")
    
    @staticmethod
    async def back_to_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Return to main menu"""
        user_id = update.effective_user.id
        if user_id in user_states:
            del user_states[user_id]
        
        await update.callback_query.message.edit_text(
            "🚀 <b>NEOwatch - Космічний бот</b>\n\nОбери дію:",
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
