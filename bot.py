"""NEOwatch Bot - Track asteroids and satellites"""
import logging
import requests
import os
from datetime import datetime, timedelta
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters
from config import NASA_API_KEY, N2YO_API_KEY, BOT_TOKEN
from config import NASA_NEO_URL, N2YO_BASE_URL
from config import DEFAULT_LAT, DEFAULT_LON, DEFAULT_ALT, ISS_NORAD_ID
from database import init_db, create_or_update_user, update_user_location, toggle_subscription
from database import get_subscription_status, get_iss_subscribers, get_apod_subscribers
from database import update_last_iss_pass, update_last_apod_date, get_last_apod_for_user
from database import geocode_city, get_user

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# User states for conversation
user_states = {}

def get_asteroids_today():
    """Fetch near-Earth objects from NASA API"""
    today = datetime.now().strftime('%Y-%m-%d')
    params = {
        'start_date': today,
        'end_date': today,
        'api_key': NASA_API_KEY
    }
    
    try:
        response = requests.get(NASA_NEO_URL, params=params, timeout=10)
        data = response.json()
        
        asteroids = data['near_earth_objects'].get(today, [])
        
        if not asteroids:
            return "🌌 Сьогодні немає близьких астероїдів"
        
        asteroids.sort(key=lambda x: float(x['close_approach_data'][0]['miss_distance']['kilometers']))
        
        message = f"🌑 <b>Астероїди поблизу Землі ({today})</b>\n\n"
        message += f"Всього знайдено: <b>{len(asteroids)}</b>\n\n"
        
        for i, neo in enumerate(asteroids[:5], 1):
            name = neo['name']
            diameter = neo['estimated_diameter']['meters']
            diameter_min = int(diameter['estimated_diameter_min'])
            diameter_max = int(diameter['estimated_diameter_max'])
            
            approach = neo['close_approach_data'][0]
            distance_km = float(approach['miss_distance']['kilometers'])
            distance_lunar = float(approach['miss_distance']['lunar'])
            velocity = float(approach['relative_velocity']['kilometers_per_hour'])
            
            is_hazardous = neo['is_potentially_hazardous_asteroid']
            hazard_emoji = "⚠️ ПОТЕНЦІЙНО НЕБЕЗПЕЧНИЙ" if is_hazardous else "✅ Безпечний"
            
            message += f"<b>{i}. {name}</b>\n"
            message += f"   📏 Розмір: {diameter_min}-{diameter_max} м\n"
            message += f"   📏 Відстань: {distance_km:,.0f} км ({distance_lunar:.1f} відстаней до Місяця)\n"
            message += f"   🚀 Швидкість: {velocity:,.0f} км/год\n"
            message += f"   {hazard_emoji}\n\n"
        
        return message
        
    except Exception as e:
        logger.error(f"Error fetching asteroids: {e}")
        return "❌ Помилка отримання даних про астероїди"


def get_apod():
    """Fetch NASA Astronomy Picture of the Day"""
    url = "https://api.nasa.gov/planetary/apod"
    params = {
        'api_key': NASA_API_KEY,
        'thumbs': True
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        data = response.json()
        
        title = data.get('title', 'APOD')
        explanation = data.get('explanation', '')[:500]
        date = data.get('date', '')
        media_type = data.get('media_type', 'image')
        
        message = f"🌌 <b>Фото дня від NASA ({date})</b>\n\n"
        message += f"<b>{title}</b>\n\n"
        
        if media_type == 'image':
            url = data.get('hdurl') or data.get('url')
            message += f"📸 <a href='{url}'>Відкрити зображення</a>\n\n"
        else:
            url = data.get('url')
            message += f"🎥 <a href='{url}'>Відкрити відео</a>\n\n"
        
        message += f"{explanation}..."
        
        return {
            'text': message,
            'image_url': url if media_type == 'image' else None,
            'title': title,
            'date': date
        }
        
    except Exception as e:
        logger.error(f"Error fetching APOD: {e}")
        return None


def get_iss_location():
    """Get current ISS location"""
    url = f"{N2YO_BASE_URL}/positions/{ISS_NORAD_ID}/{DEFAULT_LAT}/{DEFAULT_LON}/{DEFAULT_ALT}/1"
    params = {'apiKey': N2YO_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if 'positions' not in data or not data['positions']:
            return "❌ Неможливо отримати дані про МКС"
        
        pos = data['positions'][0]
        satname = data.get('info', {}).get('satname', 'МКС')
        
        lat = pos['satlatitude']
        lon = pos['satlongitude']
        altitude = pos['sataltitude']
        
        map_url = f"https://www.google.com/maps?q={lat},{lon}"
        
        message = f"🛰️ <b>Поточне положення {satname}</b>\n\n"
        message += f"📍 Координати: {lat:.4f}°{('N' if lat >= 0 else 'S')}, {lon:.4f}°{('E' if lon >= 0 else 'W')}\n"
        message += f"⛰️ Висота: {altitude:.1f} км\n"
        message += f"🚀 Орбітальна швидкість: ~7.66 км/с\n\n"
        message += f"<a href='{map_url}'>🗺️ Подивитись на мапі</a>"
        
        return message
        
    except Exception as e:
        logger.error(f"Error fetching ISS location: {e}")
        return "❌ Помилка отримання даних про МКС"


def get_satellite_passes(lat=DEFAULT_LAT, lon=DEFAULT_LON, alt=DEFAULT_ALT, days=3):
    """Get satellite passes for location"""
    url = f"{N2YO_BASE_URL}/visualpasses/{ISS_NORAD_ID}/{lat}/{lon}/{alt}/{days}/60"
    params = {'apiKey': N2YO_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if 'passes' not in data or not data['passes']:
            return f"🔭 <b>Проходження МКС</b>\n\nНа наступні {days} днів проходжень немає"
        
        message = f"🛰️ <b>Найближчі проходження МКС</b>\n\n"
        
        for pass_data in data['passes'][:5]:
            start_time = datetime.fromtimestamp(pass_data['startUTC'])
            duration = pass_data['duration']
            max_elevation = pass_data['maxEl']
            
            message += f"📅 <b>{start_time.strftime('%d.%m.%Y')}</b>\n"
            message += f"   ⏰ Час: {start_time.strftime('%H:%M')} UTC ({(start_time + timedelta(hours=2)).strftime('%H:%M')} Kyiv)\n"
            message += f"   ⏱️ Тривалість: {duration} сек\n"
            message += f"   📐 Макс. висота: {max_elevation}°\n\n"
        
        return message
        
    except Exception as e:
        logger.error(f"Error fetching satellite passes: {e}")
        return "❌ Помилка отримання даних про проходження"


def get_next_pass(lat=DEFAULT_LAT, lon=DEFAULT_LON, alt=DEFAULT_ALT):
    """Get the next ISS pass"""
    url = f"{N2YO_BASE_URL}/visualpasses/{ISS_NORAD_ID}/{lat}/{lon}/{alt}/1/60"
    params = {'apiKey': N2YO_API_KEY}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if 'passes' in data and data['passes']:
            return data['passes'][0]
        return None
        
    except Exception as e:
        logger.error(f"Error fetching next pass: {e}")
        return None


def get_main_menu_keyboard(user_id: int):
    """Main menu inline keyboard"""
    user = get_user(user_id)
    city_info = f"📍 {user['city']}" if user and user.get('city') else "📍 Вказати місто"
    
    keyboard = [
        [
            InlineKeyboardButton("🌑 Астероїди", callback_data='neo'),
            InlineKeyboardButton("🌌 Фото дня", callback_data='apod')
        ],
        [
            InlineKeyboardButton("🛰️ Положення МКС", callback_data='iss'),
            InlineKeyboardButton("📡 Проходження МКС", callback_data='passes')
        ],
        [
            InlineKeyboardButton(city_info, callback_data='set_location'),
            InlineKeyboardButton("⚙️ Налаштування", callback_data='settings')
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


def get_settings_keyboard(user_id: int):
    """Settings inline keyboard"""
    status = get_subscription_status(user_id)
    
    iss_emoji = "✅" if status['iss'] else "☑️"
    apod_emoji = "✅" if status['apod'] else "☑️"
    
    keyboard = [
        [
            InlineKeyboardButton(f"{iss_emoji} Сповіщення МКС", callback_data='toggle_iss'),
        ],
        [
            InlineKeyboardButton(f"{apod_emoji} Фото дня NASA", callback_data='toggle_apod'),
        ],
        [
            InlineKeyboardButton("🔙 Назад", callback_data='back_menu')
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


# Command handlers
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send welcome message with inline keyboard"""
    user = update.effective_user
    chat = update.effective_chat
    
    # Create or update user
    db_user = create_or_update_user(
        user_id=user.id,
        chat_id=chat.id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name
    )
    
    welcome_text = """
👋 <b>Вітаю в NEOwatch!</b>

Я відстежую:
🌑 Астероїди поблизу Землі
🛰️ Положення МКС та її проходження
🌌 Фото дня від NASA

<b>📍 Важливо:</b> Вкажи своє місто, щоб отримувати точні дані про проходження МКС над тобою!

Обери дію нижче 👇
    """
    
    await update.message.reply_html(welcome_text, reply_markup=get_main_menu_keyboard(user.id))


async def button_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle inline button presses"""
    query = update.callback_query
    await query.answer()
    
    action = query.data
    user_id = update.effective_user.id
    chat_id = query.message.chat_id
    
    user = get_user(user_id)
    if not user:
        # Recreate user if missing
        user_obj = update.effective_user
        user = create_or_update_user(
            user_id=user_obj.id,
            chat_id=chat_id,
            username=user_obj.username,
            first_name=user_obj.first_name,
            last_name=user_obj.last_name
        )
    
    if action == 'neo':
        message = get_asteroids_today()
        await query.edit_message_text(message, parse_mode='HTML', reply_markup=get_main_menu_keyboard(user_id))
    
    elif action == 'apod':
        apod_data = get_apod()

        if apod_data:
            # Video or other media
            await context.bot.send_message(
                chat_id=chat_id,
                text=apod_data['text'],
                parse_mode='HTML',
                reply_markup=get_main_menu_keyboard(user_id)
            )
        else:
            await query.edit_message_text("❌ Помилка отримання фото дня.", reply_markup=get_main_menu_keyboard(user_id))
    
    elif action == 'iss':
        message = get_iss_location()
        await query.edit_message_text(message, parse_mode='HTML', reply_markup=get_main_menu_keyboard(user_id))
    
    elif action == 'passes':
        # Use user location if available
        lat = user.get('lat') or DEFAULT_LAT
        lon = user.get('lon') or DEFAULT_LON
        city = user.get('city')
        
        message = get_satellite_passes(lat, lon)
        if city:
            message = f"📍 <b>Локація: {city}</b>\n\n" + message
        await query.edit_message_text(message, parse_mode='HTML', reply_markup=get_main_menu_keyboard(user_id))
    
    elif action == 'set_location':
        user_states[user_id] = 'awaiting_city'
        await query.edit_message_text(
            "📍 <b>Вкажи своє місто</b>\n\n"
            "Напиши назву міста (англійською або українською):\n"
            "<i>Наприклад:</i> Kyiv, Lviv, Kharkiv",
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Скасувати", callback_data='back_menu')]])
        )
    
    elif action == 'settings':
        status = get_subscription_status(user_id)
        
        settings_text = f"""
⚙️ <b>Налаштування</b>

Вибери, що хочеш отримувати автоматично:

🛰️ <b>Сповіщення МКС</b>
   Стан: {"✅ Активно" if status['iss'] else "☑️ Вимкнено"}
   
🌌 <b>Фото дня NASA</b>
   Стан: {"✅ Активно" if status['apod'] else "☑️ Вимкнено"}

{'📍 Вкажи місто в меню для точніших даних' if not user.get('city') else f"📍 Твоє місто: {user['city']}"}

Натисни кнопку щоб змінити:
        """
        await query.edit_message_text(settings_text, parse_mode='HTML', reply_markup=get_settings_keyboard(user_id))
    
    elif action == 'toggle_iss':
        new_status = toggle_subscription(user_id, 'iss')
        status_text = "✅ активовано" if new_status else "☑️ вимкнено"
        await query.answer(f"Сповіщення МКС {status_text}")
        
        # Refresh settings menu
        status = get_subscription_status(user_id)
        settings_text = f"""
⚙️ <b>Налаштування</b>

Сповіщення МКС: {"✅ Активно" if status['iss'] else "☑️ Вимкнено"}
Фото дня NASA: {"✅ Активно" if status['apod'] else "☑️ Вимкнено"}

Вибери інші опції:
        """
        await query.edit_message_text(settings_text, parse_mode='HTML', reply_markup=get_settings_keyboard(user_id))
    
    elif action == 'toggle_apod':
        new_status = toggle_subscription(user_id, 'apod')
        status_text = "✅ активовано" if new_status else "☑️ вимкнено"
        await query.answer(f"Фото дня {status_text}")
        
        # Refresh settings menu
        status = get_subscription_status(user_id)
        settings_text = f"""
⚙️ <b>Налаштування</b>

Сповіщення МКС: {"✅ Активно" if status['iss'] else "☑️ Вимкнено"}
Фото дня NASA: {"✅ Активно" if status['apod'] else "☑️ Вимкнено"}

Вибери інші опції:
        """
        await query.edit_message_text(settings_text, parse_mode='HTML', reply_markup=get_settings_keyboard(user_id))
    
    elif action == 'back_menu':
        welcome_text = """
👋 <b>NEOwatch</b>

Обери дію нижче 👇
        """
        await query.edit_message_text(welcome_text, parse_mode='HTML', reply_markup=get_main_menu_keyboard(user_id))


async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages (city input)"""
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id
    text = update.message.text.strip()
    
    # Check if user is in city input mode
    if user_states.get(user_id) == 'awaiting_city':
        # Try to geocode city
        await update.message.reply_html(f"🔍 Шукаю місто: <b>{text}</b>...")
        
        result = geocode_city(text)
        
        if result:
            lat, lon, display_name = result
            
            # Update user location
            update_user_location(user_id, display_name, lat, lon)
            
            # Clear waiting state
            del user_states[user_id]
            
            await update.message.reply_html(
                f"✅ <b>Місто знайдено:</b>\n\n"
                f"📍 {display_name}\n"
                f"🗺️ Координати: {lat:.4f}, {lon:.4f}\n\n"
                f"Тепер ти отримуватимеш точні дані про проходження МКС над твоєю локацією!",
                reply_markup=get_main_menu_keyboard(user_id)
            )
        else:
            await update.message.reply_html(
                f"❌ <b>Не вдалося знайти місто: {text}</b>\n\n"
                f"Спробуй написати інше місто або використай англійську назву.\n"
                f"<i>Наприклад:</i> Kyiv, Lviv, Odesa",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Назад", callback_data='back_menu')]])
            )
    else:
        # Unknown message - show menu
        await update.message.reply_html(
            "🤔 Я не розумію це повідомлення.\n\n"
            "Використай /start або кнопки нижче:",
            reply_markup=get_main_menu_keyboard(user_id)
        )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send help message"""
    help_text = """
<b>📖 Довідка NEOwatch</b>

<b>Налаштування локації:</b>
Натисни "📍 Вказати місто" та напиши назву. Бот використовуватиме її для точних прогнозів.

<b>Підписки:</b>
• 🛰️ МКС — сповіщення за 10 хв до проходження
• 🌌 APOD — фото дня щодня о 9:00

<b>Дані:</b>
NASA NEO API, APOD API, N2YO API
    """
    await update.message.reply_html(help_text, reply_markup=get_main_menu_keyboard(update.effective_user.id))


# Background jobs
async def check_iss_passes(context: ContextTypes.DEFAULT_TYPE):
    """Background job to check ISS passes and notify users"""
    subscribers = get_iss_subscribers()
    
    if not subscribers:
        return
    
    for user in subscribers:
        lat = user.get('lat') or DEFAULT_LAT
        lon = user.get('lon') or DEFAULT_LON
        
        next_pass = get_next_pass(lat, lon)
        if not next_pass:
            continue
        
        pass_time = datetime.fromtimestamp(next_pass['startUTC'])
        now = datetime.now()
        time_until_pass = pass_time - now
        minutes_until = time_until_pass.total_seconds() / 60
        
        if 5 < minutes_until <= 15:
            duration = next_pass['duration']
            max_elevation = next_pass['maxEl']
            
            city_text = f" над {user['city']}" if user.get('city') else ""
            
            notification = (
                f"🚨 <b>МКС пролітає{city_text}!</b>\n\n"
                f"⏰ Час: <b>{pass_time.strftime('%H:%M')} UTC</b> ({(pass_time + timedelta(hours=2)).strftime('%H:%M')} Kyiv)\n"
                f"⏱️ Тривалість: {duration} сек\n"
                f"📐 Макс. висота: {max_elevation}°\n\n"
                f"🔭 Готуйся спостерігати!"
            )
            
            last_notified = user.get('last_iss_pass')
            if last_notified == next_pass['startUTC']:
                continue
            
            try:
                await context.bot.send_message(
                    chat_id=user['chat_id'],
                    text=notification,
                    parse_mode='HTML'
                )
                update_last_iss_pass(user['user_id'], next_pass['startUTC'])
                logger.info(f"Notified user {user['user_id']} about ISS pass")
            except Exception as e:
                logger.error(f"Failed to notify user {user['user_id']}: {e}")


async def send_daily_apod(context: ContextTypes.DEFAULT_TYPE):
    """Background job to send daily APOD to subscribed users"""
    today = datetime.now().strftime('%Y-%m-%d')
    
    # Check if it's around 7 AM UTC (9 AM Kyiv)
    current_hour = datetime.now().hour
    if current_hour != 7:
        return
    
    apod_data = get_apod()
    if not apod_data:
        logger.error("Failed to fetch APOD")
        return
    
    subscribers = get_apod_subscribers()
    
    for user in subscribers:
        last_sent = user.get('last_apod_date')
        if last_sent == today:
            continue
        
        try:
            if apod_data.get('image_url'):
                # Send photo with short caption
                short_caption = f"🌌 <b>{apod_data['title']}</b>\n📅 {apod_data['date']}"
                await context.bot.send_photo(
                    chat_id=user['chat_id'],
                    photo=apod_data['image_url'],
                    caption=short_caption,
                    parse_mode='HTML'
                )
                # Send full description
                await context.bot.send_message(
                    chat_id=user['chat_id'],
                    text=apod_data['text'],
                    parse_mode='HTML'
                )
            else:
                await context.bot.send_message(
                    chat_id=user['chat_id'],
                    text=apod_data['text'],
                    parse_mode='HTML'
                )
            
            update_last_apod_date(user['user_id'], today)
            logger.info(f"Sent APOD to user {user['user_id']}")
        except Exception as e:
            logger.error(f"Failed to send APOD to user {user['user_id']}: {e}")


def main():
    """Start the bot"""
    logger.info("Starting NEOwatch bot...")
    
    # Initialize database
    init_db()
    logger.info("Database initialized")
    
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Add handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CallbackQueryHandler(button_handler))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    
    # Add job queue
    job_queue = application.job_queue
    job_queue.run_repeating(check_iss_passes, interval=300, first=10)
    job_queue.run_repeating(send_daily_apod, interval=3600, first=60)
    
    logger.info("Bot is running! Database + job queue active.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
