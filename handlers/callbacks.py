"""Callback query handlers"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputFile
from telegram.ext import ContextTypes
from services import NasaAPI, N2YOAPI, LaunchAPI, SpaceWeatherAPI, ISSCrewAPI
from services.moon_mars import MoonMarsAPI
from services.meteor_shower import MeteorShower
from database import get_user, update_user_location, toggle_subscription, geocode_city
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
            'meteor_showers': CallbackHandlers.meteor_showers,
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
        ])
    
    @staticmethod
    async def neo(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle asteroids button - show today + upcoming hazardous"""
        # Get today's asteroids
        today_result = NasaAPI.get_asteroids_today()

        # Get upcoming hazardous asteroids
        hazardous = NasaAPI.get_hazardous_asteroids()

        # Build combined message
        message = today_result + "\n\n"

        # Add upcoming hazardous section
        if hazardous:
            message += "⚠️ <b>Небезпечні астероїди (наступні 7 днів):</b>\n\n"
            for i, neo in enumerate(hazardous[:3], 1):
                name = neo['name']
                distance_km = neo['miss_distance_km']
                approach_date = neo['approach_date']

                # Format distance
                if distance_km >= 1_000_000:
                    distance_str = f"{distance_km/1_000_000:.2f} млн км"
                else:
                    distance_str = f"{distance_km/1000:,.0f} тис км"

                message += f"{i}. 🌑 <b>{name}</b>\n"
                message += f"   📅 {approach_date}\n"
                message += f"   📍 {distance_str}\n"
                message += f"   ⚠️ Потенційно небезпечний\n\n"

        await update.callback_query.message.edit_text(
            message,
            parse_mode='HTML',
            reply_markup=CallbackHandlers.get_main_menu()
        )
    
    @staticmethod
    async def apod(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle APOD button"""
        try:
            data = NasaAPI.get_apod()
            if not data:
                logger.error("APOD: get_apod() returned None")
                await update.callback_query.message.reply_text(
                    "❌ Не вдалося отримати фото дня від NASA (API error)",
                    reply_markup=CallbackHandlers.get_main_menu()
                )
                return
            formatted = NasaAPI.format_apod(data)
            
            logger.info(f"APOD data: media_type={data.get('media_type')}, url={data.get('url', '')[:50]}...")
            logger.info(f"APOD image URL: {formatted.get('image', 'N/A')[:50]}...")
            
            # Check if it's a video
            if data.get('media_type') == 'video':
                video_url = data.get('url', '')
                
                caption = f"🎥 <b>Відео дня від NASA</b>\n\n"
                caption += f"📅 {data.get('date', '')}\n"
                caption += f"🎬 {data.get('title', '')}\n\n"
                caption += "<i>Повний опис нижче ↓</i>"
                
                # Check if it's a direct video file (MP4, etc.) - handle query params
                clean_url = video_url.split('?')[0].lower()
                is_direct_video = clean_url.endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm'))
                
                if is_direct_video:
                    try:
                        # Send video directly from URL
                        await context.bot.send_video(
                            chat_id=update.effective_chat.id,
                            video=video_url,
                            caption=caption,
                            parse_mode='HTML',
                            supports_streaming=True
                        )
                    except Exception as e:
                        logger.error(f"Failed to send video: {e}")
                        # Fallback: send as link
                        await update.callback_query.message.reply_text(
                            f"🎥 <b>Відео дня від NASA</b>\n\n"
                            f"📅 {data.get('date', '')}\n"
                            f"🎬 {data.get('title', '')}\n\n"
                            f"<a href='{video_url}'>▶️ Дивитись відео</a>\n\n"
                            f"<i>Повний опис нижче ↓</i>",
                            parse_mode='HTML',
                            disable_web_page_preview=False
                        )
                else:
                    # YouTube or other embedded video - send thumbnail with link
                    thumbnail = data.get('thumbnail', '')
                    
                    # Try to get YouTube thumbnail
                    if 'youtube.com' in video_url or 'youtu.be' in video_url:
                        import re
                        if 'youtu.be' in video_url:
                            video_id = video_url.split('/')[-1].split('?')[0]
                        else:
                            match = re.search(r'[?&]v=([^&]+)', video_url)
                            video_id = match.group(1) if match else ''
                        
                        if video_id:
                            thumbnail = f"https://img.youtube.com/vi/{video_id}/0.jpg"
                    
                    try:
                        await context.bot.send_photo(
                            chat_id=update.effective_chat.id,
                            photo=thumbnail or video_url,
                            caption=f"🎥 <b>Відео дня від NASA</b>\n\n"
                                    f"📅 {data.get('date', '')}\n"
                                    f"🎬 {data.get('title', '')}\n\n"
                                    f"<a href='{video_url}'>▶️ Дивитись відео</a>\n\n"
                                    f"<i>Повний опис нижче ↓</i>",
                            parse_mode='HTML'
                        )
                    except:
                        await update.callback_query.message.reply_text(
                            f"🎥 <b>Відео дня від NASA</b>\n\n"
                            f"📅 {data.get('date', '')}\n"
                            f"🎬 {data.get('title', '')}\n\n"
                            f"<a href='{video_url}'>▶️ Дивитись відео</a>\n\n"
                            f"<i>Повний опис нижче ↓</i>",
                            parse_mode='HTML',
                            disable_web_page_preview=False
                        )
            else:
                # Send photo with short caption
                try:
                    await context.bot.send_photo(
                        chat_id=update.effective_chat.id,
                        photo=formatted['image'],
                        caption=formatted['caption'],
                        parse_mode='HTML'
                    )
                except Exception as e:
                    logger.error(f"Failed to send APOD photo: {e}")
                    # Fallback: send as link
                    await context.bot.send_message(
                        chat_id=update.effective_chat.id,
                        text=f"🌌 <b>{data.get('title', '')}</b>\n\n"
                             f"📅 {data.get('date', '')}\n\n"
                             f"<a href='{formatted['image']}'>📷 Дивитись фото</a>\n\n",
                        parse_mode='HTML'
                    )
            
            # Send full description as separate message
            await update.callback_query.message.reply_text(
                formatted['text'],
                parse_mode='HTML',
                reply_markup=CallbackHandlers.get_main_menu()
            )
        except Exception as e:
            logger.error(f"APOD handler error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await update.callback_query.message.reply_text(
                f"❌ Помилка при отриманні фото дня: {str(e)[:200]}",
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
        """Handle ISS position button - now with map image"""
        from services.iss_map import ISSMapService
        from telegram import InlineKeyboardButton
        
        try:
            # Get map image, caption and map link
            map_image, caption, maps_link = ISSMapService.get_iss_map_with_info()
            
            # Build keyboard with map button
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("🗺️ Відкрити на Google Maps", url=maps_link)],
                [InlineKeyboardButton("🔙 Назад", callback_data='back_menu')]
            ])
            
            if map_image:
                # Send photo with map
                await context.bot.send_photo(
                    chat_id=update.effective_chat.id,
                    photo=InputFile(map_image, filename='iss_map.png'),
                    caption=caption,
                    parse_mode='HTML',
                    reply_markup=keyboard
                )
                # Delete original message to avoid duplication
                await update.callback_query.message.delete()
            else:
                # Fallback: text with map link (Telegram shows preview)
                message = caption + f"\n🗺️ Мапа: {maps_link}"
                await update.callback_query.message.edit_text(
                    message,
                    parse_mode='HTML',
                    disable_web_page_preview=False,
                    reply_markup=keyboard
                )
        except Exception as e:
            logger.error(f"ISS now handler error: {e}")
            # Fallback to original method
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
        """Handle ISS crew button - show expedition patch and crew list"""
        data = ISSCrewAPI.get_iss_crew()
        result = ISSCrewAPI.format_crew_for_telegram(data)
        patch_url = result.get('patch_url')

        try:
            if patch_url:
                # Try to replace current message with photo (keeps same message_id)
                from telegram import InputMediaPhoto
                media = InputMediaPhoto(
                    media=patch_url,
                    caption=result['text'],
                    parse_mode='HTML'
                )
                await context.bot.edit_message_media(
                    media=media,
                    chat_id=update.effective_chat.id,
                    message_id=update.callback_query.message.message_id,
                    reply_markup=CallbackHandlers.get_main_menu()
                )
            else:
                await update.callback_query.message.edit_text(
                    result['text'],
                    parse_mode='HTML',
                    reply_markup=CallbackHandlers.get_main_menu()
                )
        except Exception as e:
            logger.error(f"ISS crew handler error: {e}")
            await update.callback_query.message.edit_text(
                result['text'],
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
    async def meteor_showers(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle meteor showers button"""
        result = MeteorShower.format_upcoming_showers()
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
            message += f"📅 Сол {mars_data['sol']} (марсіанський день)\n"
            message += f"📊 Дані за: {mars_data.get('first_date', 'N/A')} - {mars_data.get('last_date', 'N/A')}\n\n"

            # Temperature
            if mars_data.get('temp_avg') is not None:
                message += "🌡️ <b>Температура повітря:</b>\n"
                message += f"   Середня: {mars_data['temp_avg']}°C\n"
                if mars_data.get('temp_min') is not None and mars_data.get('temp_max') is not None:
                    message += f"   Діапазон: {mars_data['temp_min']}°C ... {mars_data['temp_max']}°C\n"
                if mars_data.get('temp_samples'):
                    message += f"   Вимірювань: {mars_data['temp_samples']}\n"
                message += "\n"

            # Pressure
            if mars_data.get('pressure_avg') is not None:
                message += "💨 <b>Атмосферний тиск:</b>\n"
                message += f"   Середній: {mars_data['pressure_avg']} Па\n"
                if mars_data.get('pressure_min') is not None and mars_data.get('pressure_max') is not None:
                    message += f"   Діапазон: {mars_data['pressure_min']} ... {mars_data['pressure_max']} Па\n"
                message += "\n"

            # Wind
            if mars_data.get('wind_avg') is not None:
                message += "💨 <b>Вітер:</b>\n"
                message += f"   Середня швидкість: {mars_data['wind_avg']} м/с\n"
                if mars_data.get('wind_min') is not None and mars_data.get('wind_max') is not None:
                    message += f"   Діапазон: {mars_data['wind_min']} ... {mars_data['wind_max']} м/с\n"
                if mars_data.get('wind_direction'):
                    message += f"   Напрямок: {mars_data['wind_direction']} ({mars_data.get('wind_direction_deg', 0)}°)\n"
                message += "\n"

            # Season
            if mars_data.get('season'):
                season_emoji = "🌸" if "spring" in mars_data['season'].lower() else \
                              "☀️" if "summer" in mars_data['season'].lower() else \
                              "🍂" if "fall" in mars_data['season'].lower() else "❄️"
                message += f"{season_emoji} <b>Сезон:</b> {mars_data['season']}\n"
                if mars_data.get('northern_season'):
                    message += f"   Північна півкуля: {mars_data['northern_season']}\n"
                if mars_data.get('southern_season'):
                    message += f"   Південна півкуля: {mars_data['southern_season']}\n"

            message += "\n<i>📡 Джерело: NASA InSight</i>"
        else:
            message += "❌ Не вдалося отримати дані\n"
            message += "<i>Можливо, InSight не передає дані</i>"

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
        launches_sub = '✅' if user and user.get('subscribed_launches') else '☑️'
        neo_sub = '✅' if user and user.get('subscribed_neo') else '☑️'
        news_sub = '✅' if user and user.get('subscribed_news') else '☑️'
        meteors_sub = '✅' if user and user.get('subscribed_meteors') else '☑️'
        city = user.get('city', 'Не вказано') if user else 'Не вказано'

        message = f"⚙️ <b>Налаштування</b>\n\n"
        message += f"📍 Місто: <b>{city}</b>\n\n"
        message += f"🔔 Сповіщення:\n"
        message += f"{iss_sub} Проходження МКС\n"
        message += f"{apod_sub} Фото дня (9:00)\n"
        message += f"{launches_sub} Запуски ракет\n"
        message += f"{neo_sub} Небезпечні астероїди\n"
        message += f"{news_sub} Новини (10:00)\n"
        message += f"{meteors_sub} Метеорні потоки (22:00)\n"

        keyboard = [
            [
                InlineKeyboardButton(f"{iss_sub} МКС", callback_data='sub_iss'),
                InlineKeyboardButton(f"{apod_sub} Фото дня", callback_data='sub_apod'),
                InlineKeyboardButton(f"{launches_sub} Запуски", callback_data='sub_launches'),
            ],
            [
                InlineKeyboardButton(f"{neo_sub} Астероїди", callback_data='sub_neo'),
                InlineKeyboardButton(f"{news_sub} Новини", callback_data='sub_news'),
                InlineKeyboardButton(f"{meteors_sub} Метеори", callback_data='sub_meteors'),
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
            update_user_location(user_id, city_name, lat, lon)
            
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

        message = "🛰️ <b>NEOwatch — Твій провідник у космосі</b>\n\n"
        message += "Відстежуй все, що відбувається над головою:\n\n"
        message += "🌑 <b>Астероїди</b> — небезпечні об'єкти поблизу Землі\n"
        message += "🛰️ <b>МКС</b> — позиція та проходження над твоїм містом\n"
        message += "🚀 <b>Запуски</b> — ракети SpaceX, NASA та інших\n"
        message += "🌠 <b>Метеори</b> — потоки зірок у нічному небі\n"
        message += "🌌 <b>Фото дня</b> — вражаючі кадри від NASA\n"
        message += "👨‍🚀 <b>Екіпаж</b> — хто зараз у космосі\n\n"
        message += "☀️ Налаштуй сповіщення, щоб нічого не пропустити!"

        try:
            # Try to edit existing message
            await update.callback_query.message.edit_text(
                message,
                parse_mode='HTML',
                reply_markup=CallbackHandlers.get_main_menu()
            )
        except Exception as e:
            # If editing fails (e.g., message was deleted), send new message
            logger.debug(f"Could not edit message, sending new one: {e}")
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=message,
                parse_mode='HTML',
                reply_markup=CallbackHandlers.get_main_menu()
            )
