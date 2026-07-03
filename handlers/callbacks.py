"""Callback query handlers"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputFile
from telegram.ext import ContextTypes
from services import NasaAPI, N2YOAPI, LaunchAPI, SpaceWeatherAPI, ISSCrewAPI
from services.moon_mars import MoonMarsAPI
from services.meteor_shower import MeteorShower
from services.astronomy import format_events
from database import (get_user, update_user_location, toggle_subscription, geocode_city,
                      reverse_geocode, create_or_update_user, update_user_lang)
from utils.keyboards import (get_main_menu, get_iss_menu, get_weather_menu, get_sky_menu,
                             get_language_picker)
from utils.i18n import t, normalize_lang, DEFAULT_LANG
import logging

logger = logging.getLogger(__name__)

# User states for conversation
user_states = {}

# Subscription types -> i18n keys for full names and short button labels
SUB_KEYS = {
    'iss': ('settings.iss', 'sub.iss'),
    'apod': ('settings.apod', 'sub.apod'),
    'launches': ('settings.launches', 'sub.launches'),
    'neo': ('settings.neo', 'sub.neo'),
    'news': ('settings.news', 'sub.news'),
    'meteors': ('settings.meteors', 'sub.meteors'),
    'flares': ('settings.flares', 'sub.flares'),
    'grb': ('settings.grb', 'sub.grb'),
}
SUB_ORDER = ['iss', 'apod', 'launches', 'neo', 'news', 'meteors', 'flares', 'grb']


def _lang_from(context: ContextTypes.DEFAULT_TYPE) -> str:
    return normalize_lang(context.user_data.get('lang'))


class CallbackHandlers:
    """Handle inline keyboard callbacks"""

    @staticmethod
    async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Main callback router"""
        query = update.callback_query
        await query.answer()

        data = query.data or ''
        user_id = update.effective_user.id

        # Language selection callbacks (handled before the user-exists check,
        # since a brand-new user picks a language here).
        if data.startswith('lang_'):
            await CallbackHandlers.handle_language_selection(update, context, data)
            return

        # Choke point: a user with no DB record hasn't chosen a language yet.
        user = get_user(user_id)
        if user is None:
            await CallbackHandlers._replace_message(update, context,
                t('lang.pick'),
                parse_mode='HTML',
                reply_markup=get_language_picker('menu')
            )
            return

        lang = normalize_lang(user.get('lang'))
        context.user_data['lang'] = lang

        # Route to appropriate handler
        handlers = {
            'neo': CallbackHandlers.neo,
            'apod': CallbackHandlers.apod,
            'launches': CallbackHandlers.launches,
            'iss_menu': CallbackHandlers.iss_menu,
            'iss_now': CallbackHandlers.iss_now,
            'iss_passes': CallbackHandlers.iss_passes,
            'iss_crew': CallbackHandlers.iss_crew,
            'starlink': CallbackHandlers.starlink,
            'weather_menu': CallbackHandlers.weather_menu,
            'space_weather': CallbackHandlers.space_weather,
            'aurora': CallbackHandlers.aurora,
            'mars': CallbackHandlers.mars,
            'sky_menu': CallbackHandlers.sky_menu,
            'meteor_showers': CallbackHandlers.meteor_showers,
            'astronomy': CallbackHandlers.astronomy,
            'moon': CallbackHandlers.moon,
            'settings': CallbackHandlers.settings,
            'set_location': CallbackHandlers.set_location,
            'language': CallbackHandlers.choose_language,
            'back_menu': CallbackHandlers.back_to_menu,
        }

        if data in handlers:
            await handlers[data](update, context)
        elif data.startswith('cityloc:'):
            await CallbackHandlers.handle_cityloc_selection(update, context, data)
        elif data.startswith('city_'):
            await CallbackHandlers.handle_city_selection(update, context, data)
        elif data.startswith('sub_'):
            await CallbackHandlers.handle_subscription_toggle(update, context, data)

    @staticmethod
    async def _replace_message(update, context, text, **kwargs):
        """Replace current message. Works for both text and media messages."""
        try:
            await update.callback_query.message.edit_text(text, **kwargs)
        except Exception:
            try:
                await update.callback_query.message.delete()
            except Exception:
                pass
            await context.bot.send_message(
                chat_id=update.effective_chat.id,
                text=text,
                **kwargs
            )

    @staticmethod
    async def handle_language_selection(update: Update, context: ContextTypes.DEFAULT_TYPE, data: str):
        """Handle language picker selection. data is 'lang_uk:<origin>' or 'lang_en:<origin>'."""
        query = update.callback_query
        await query.answer()

        user = update.effective_user
        user_id = user.id
        parts = data.split(':', 1)
        lang = parts[0].replace('lang_', '')
        origin = parts[1] if len(parts) > 1 else 'menu'
        lang = normalize_lang(lang)
        context.user_data['lang'] = lang

        existing = get_user(user_id)
        if existing is None:
            # Create the user with the chosen language
            create_or_update_user(
                user_id=user_id,
                chat_id=update.effective_chat.id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                lang=lang
            )
        else:
            update_user_lang(user_id, lang)

        # Brief confirmation toast
        try:
            await query.answer(t('lang.set', lang, lang_name=t(f'lang.name.{lang}', lang)))
        except Exception:
            pass

        # Render the originating view in the new language
        if origin == 'settings':
            await CallbackHandlers.settings(update, context)
        else:
            await CallbackHandlers.back_to_menu(update, context)

    @staticmethod
    async def iss_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show ISS & satellites sub-menu"""
        lang = _lang_from(context)
        await CallbackHandlers._replace_message(update, context,
            t('iss.menu.header', lang),
            parse_mode='HTML',
            reply_markup=get_iss_menu(lang)
        )

    @staticmethod
    async def weather_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show space weather sub-menu"""
        lang = _lang_from(context)
        await CallbackHandlers._replace_message(update, context,
            t('weather.menu.header', lang),
            parse_mode='HTML',
            reply_markup=get_weather_menu(lang)
        )

    @staticmethod
    async def sky_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show sky events sub-menu"""
        lang = _lang_from(context)
        await CallbackHandlers._replace_message(update, context,
            t('sky.menu.header', lang),
            parse_mode='HTML',
            reply_markup=get_sky_menu(lang)
        )

    @staticmethod
    async def neo(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle asteroids button - show today + upcoming hazardous"""
        lang = _lang_from(context)
        # Get today's asteroids
        today_result = NasaAPI.get_asteroids_today(lang)

        # Get upcoming hazardous asteroids
        hazardous = NasaAPI.get_hazardous_asteroids()

        # Build combined message
        message = today_result + "\n\n"

        # Add upcoming hazardous section
        if hazardous:
            message += t('neo.upcoming_header', lang)
            for i, neo in enumerate(hazardous[:3], 1):
                name = neo['name']
                distance_km = neo['miss_distance_km']
                approach_date = neo['approach_date']

                # Format distance
                if distance_km >= 1_000_000:
                    distance_str = t('neo.dist_mln', lang, v=f'{distance_km/1_000_000:.2f}')
                else:
                    distance_str = t('neo.dist_k', lang, v=f'{distance_km/1000:,.0f}')

                message += t('neo.entry', lang, i=i, name=name, date=approach_date, dist=distance_str)

        await CallbackHandlers._replace_message(update, context,
            message,
            parse_mode='HTML',
            reply_markup=get_main_menu(lang)
        )

    @staticmethod
    async def apod(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle APOD button"""
        lang = _lang_from(context)
        try:
            data = NasaAPI.get_apod()
            if not data:
                logger.error("APOD: get_apod() returned None")
                await update.callback_query.message.reply_text(
                    t('apod.error', lang),
                    reply_markup=get_main_menu(lang)
                )
                return
            formatted = NasaAPI.format_apod(data, lang)

            logger.info(f"APOD data: media_type={data.get('media_type')}, url={data.get('url', '')[:50]}...")
            logger.info(f"APOD image URL: {formatted.get('image', 'N/A')[:50]}...")

            # Check if it's a video
            if data.get('media_type') == 'video':
                video_url = data.get('url', '')

                caption = f"{t('apod.video_title', lang)}\n\n"
                caption += f"{t('apod.date', lang, date=data.get('date', ''))}\n"
                caption += f"{t('apod.media', lang, title=data.get('title', ''))}\n\n"
                caption += t('apod.full_below', lang)

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
                            f"{t('apod.video_title', lang)}\n\n"
                            f"{t('apod.date', lang, date=data.get('date', ''))}\n"
                            f"{t('apod.media', lang, title=data.get('title', ''))}\n\n"
                            f"<a href='{video_url}'>{t('apod.watch', lang)}</a>\n\n"
                            f"{t('apod.full_below', lang)}",
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
                            caption=f"{t('apod.video_title', lang)}\n\n"
                                    f"{t('apod.date', lang, date=data.get('date', ''))}\n"
                                    f"{t('apod.media', lang, title=data.get('title', ''))}\n\n"
                                    f"<a href='{video_url}'>{t('apod.watch', lang)}</a>\n\n"
                                    f"{t('apod.full_below', lang)}",
                            parse_mode='HTML'
                        )
                    except:
                        await update.callback_query.message.reply_text(
                            f"{t('apod.video_title', lang)}\n\n"
                            f"{t('apod.date', lang, date=data.get('date', ''))}\n"
                            f"{t('apod.media', lang, title=data.get('title', ''))}\n\n"
                            f"<a href='{video_url}'>{t('apod.watch', lang)}</a>\n\n"
                            f"{t('apod.full_below', lang)}",
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
                        text=f"{t('apod.title', lang)}\n\n"
                             f"{t('apod.date', lang, date=data.get('date', ''))}\n\n"
                             f"<a href='{formatted['image']}'>{t('apod.watch_photo', lang)}</a>\n\n",
                        parse_mode='HTML'
                    )

            # Send full description as separate message
            await update.callback_query.message.reply_text(
                formatted['text'],
                parse_mode='HTML',
                reply_markup=get_main_menu(lang)
            )
        except Exception as e:
            logger.error(f"APOD handler error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await update.callback_query.message.reply_text(
                t('apod.handler_error', lang, err=str(e)[:200]),
                parse_mode='HTML',
                reply_markup=get_main_menu(lang)
            )

    @staticmethod
    async def launches(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle launches button"""
        lang = _lang_from(context)
        result = LaunchAPI.get_upcoming_launches(lang)
        await CallbackHandlers._replace_message(update, context,
            result['text'],
            parse_mode='HTML',
            reply_markup=get_main_menu(lang)
        )

    @staticmethod
    async def iss_now(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle ISS position button - now with map image"""
        from services.iss_map import ISSMapService
        lang = _lang_from(context)

        try:
            # Get map image, caption and map link
            map_image, caption, maps_link = ISSMapService.get_iss_map_with_info(lang)

            # Build keyboard with map button
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton(t('iss.open_maps', lang), url=maps_link)],
                [InlineKeyboardButton(t('iss.back', lang), callback_data='iss_menu')]
            ])

            if map_image:
                # Delete original message, then send photo + caption + keyboard in one message
                await update.callback_query.message.delete()
                await context.bot.send_photo(
                    chat_id=update.effective_chat.id,
                    photo=InputFile(map_image, filename='iss_map.png'),
                    caption=caption,
                    parse_mode='HTML',
                    reply_markup=keyboard,
                )
            else:
                # Fallback: text with map link (Telegram shows preview)
                message = caption + '\n' + t('iss.map_link', lang, link=maps_link)
                await CallbackHandlers._replace_message(update, context,
                    message,
                    parse_mode='HTML',
                    disable_web_page_preview=False,
                    reply_markup=keyboard
                )
        except Exception as e:
            logger.error(f"ISS now handler error: {e}")
            # Fallback to original method
            result = N2YOAPI.get_iss_position(lang)
            await CallbackHandlers._replace_message(update, context,
                result,
                parse_mode='HTML',
                reply_markup=get_iss_menu(lang)
            )

    @staticmethod
    async def iss_passes(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle ISS passes button"""
        user = get_user(update.effective_user.id)
        lang = normalize_lang(user.get('lang')) if user else _lang_from(context)
        if not user or not user.get('lat'):
            await CallbackHandlers._replace_message(update, context,
                t('city.need_set', lang),
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton(t('city.set_btn', lang), callback_data='set_location'),
                    InlineKeyboardButton(t('iss.back', lang), callback_data='iss_menu')
                ]])
            )
            return

        lat, lon = user['lat'], user['lon']
        result = N2YOAPI.get_iss_passes(lat, lon, lang)
        await CallbackHandlers._replace_message(update, context,
            result,
            parse_mode='HTML',
            reply_markup=get_iss_menu(lang)
        )

    @staticmethod
    async def iss_crew(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle ISS crew button - show crew list as text"""
        lang = _lang_from(context)
        data = ISSCrewAPI.get_iss_crew()
        result = ISSCrewAPI.format_crew_for_telegram(data, lang)

        await CallbackHandlers._replace_message(update, context,
            result['text'],
            parse_mode='HTML',
            reply_markup=get_iss_menu(lang)
        )

    @staticmethod
    async def starlink(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle Starlink button"""
        user = get_user(update.effective_user.id)
        lang = normalize_lang(user.get('lang')) if user else _lang_from(context)
        if not user or not user.get('lat'):
            await CallbackHandlers._replace_message(update, context,
                t('city.need_set', lang),
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton(t('city.set_btn', lang), callback_data='set_location'),
                    InlineKeyboardButton(t('iss.back', lang), callback_data='iss_menu')
                ]])
            )
            return

        lat, lon = user['lat'], user['lon']
        result = N2YOAPI.get_starlink_passes(lat, lon, lang)
        await CallbackHandlers._replace_message(update, context,
            result,
            parse_mode='HTML',
            reply_markup=get_iss_menu(lang)
        )

    @staticmethod
    async def space_weather(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle space weather button"""
        user = get_user(update.effective_user.id)
        lang = normalize_lang(user.get('lang')) if user else _lang_from(context)
        lat = user.get('lat') if user else None

        result = SpaceWeatherAPI.get_space_weather(user_lat=lat, lang=lang)
        await CallbackHandlers._replace_message(update, context,
            result,
            parse_mode='HTML',
            reply_markup=get_weather_menu(lang)
        )

    @staticmethod
    async def meteor_showers(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle meteor showers button"""
        lang = _lang_from(context)
        result = MeteorShower.format_upcoming_showers(lang)
        await CallbackHandlers._replace_message(update, context,
            result,
            parse_mode='HTML',
            reply_markup=get_sky_menu(lang)
        )

    @staticmethod
    async def aurora(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle aurora map button"""
        lang = _lang_from(context)
        map_url = SpaceWeatherAPI.get_aurora_map_url()
        caption = t('aurora.caption', lang)
        await update.callback_query.message.delete()
        await context.bot.send_photo(
            chat_id=update.effective_chat.id,
            photo=map_url,
            caption=caption,
            parse_mode='HTML',
            reply_markup=get_weather_menu(lang),
        )

    @staticmethod
    async def astronomy(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle astronomy events button"""
        lang = _lang_from(context)
        result = format_events(lang)
        await CallbackHandlers._replace_message(update, context,
            result,
            parse_mode='HTML',
            reply_markup=get_sky_menu(lang)
        )

    @staticmethod
    async def moon(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle moon button"""
        lang = _lang_from(context)
        moon_data = MoonMarsAPI.get_moon_phase(lang)

        message = t('moon.title', lang)
        if moon_data:
            message += f"{moon_data['phase_name']}\n"
            message += t('moon.illumination', lang, pct=moon_data['illumination'])
            if moon_data['days_to_full'] < moon_data['days_to_new']:
                message += t('moon.to_full', lang, n=moon_data['days_to_full'])
            else:
                message += t('moon.to_new', lang, n=moon_data['days_to_new'])
        else:
            message += t('moon.calc_error', lang)

        message += '\n' + t('moon.synodic', lang)

        await CallbackHandlers._replace_message(update, context,
            message,
            parse_mode='HTML',
            reply_markup=get_sky_menu(lang)
        )

    @staticmethod
    async def mars(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle mars button"""
        lang = _lang_from(context)
        mars_data = MoonMarsAPI.get_mars_weather()

        message = t('mars.title', lang)
        if mars_data:
            message += t('mars.sol', lang, sol=mars_data['sol'])
            message += t('mars.range', lang, a=mars_data.get('first_date', 'N/A'),
                          b=mars_data.get('last_date', 'N/A'))

            # Temperature
            if mars_data.get('temp_avg') is not None:
                message += t('mars.temp_header', lang)
                message += t('mars.temp_avg', lang, t=mars_data['temp_avg'])
                if mars_data.get('temp_min') is not None and mars_data.get('temp_max') is not None:
                    message += t('mars.temp_range', lang,
                                  a=mars_data['temp_min'], b=mars_data['temp_max'])
                if mars_data.get('temp_samples'):
                    message += t('mars.temp_samples', lang, n=mars_data['temp_samples'])
                message += '\n'

            # Pressure
            if mars_data.get('pressure_avg') is not None:
                message += t('mars.pressure_header', lang)
                message += t('mars.pressure_avg', lang, p=mars_data['pressure_avg'])
                if mars_data.get('pressure_min') is not None and mars_data.get('pressure_max') is not None:
                    message += t('mars.pressure_range', lang,
                                  a=mars_data['pressure_min'], b=mars_data['pressure_max'])
                message += '\n'

            # Wind
            if mars_data.get('wind_avg') is not None:
                message += t('mars.wind_header', lang)
                message += t('mars.wind_avg', lang, w=mars_data['wind_avg'])
                if mars_data.get('wind_min') is not None and mars_data.get('wind_max') is not None:
                    message += t('mars.wind_range', lang,
                                  a=mars_data['wind_min'], b=mars_data['wind_max'])
                if mars_data.get('wind_direction'):
                    message += t('mars.wind_dir', lang,
                                 dir=mars_data['wind_direction'],
                                 deg=mars_data.get('wind_direction_deg', 0))
                message += '\n'

            # Season
            if mars_data.get('season'):
                season_emoji = "🌸" if "spring" in mars_data['season'].lower() else \
                              "☀️" if "summer" in mars_data['season'].lower() else \
                              "🍂" if "fall" in mars_data['season'].lower() else "❄️"
                message += t('mars.season', lang, emoji=season_emoji, season=mars_data['season'])
                if mars_data.get('northern_season'):
                    message += t('mars.north_season', lang, s=mars_data['northern_season'])
                if mars_data.get('southern_season'):
                    message += t('mars.south_season', lang, s=mars_data['southern_season'])

            message += t('mars.source', lang)
        else:
            message += t('mars.error', lang)
            message += t('mars.error_hint', lang)

        await CallbackHandlers._replace_message(update, context,
            message,
            parse_mode='HTML',
            reply_markup=get_weather_menu(lang)
        )

    @staticmethod
    async def settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle settings button"""
        user_id = update.effective_user.id
        user = get_user(user_id)
        lang = normalize_lang(user.get('lang')) if user else _lang_from(context)

        def chk(key):
            return '✅' if user and user.get(f'subscribed_{key}') else '☑️'

        city = user.get('city', t('settings.city_none', lang)) if user else t('settings.city_none', lang)

        message = t('settings.title', lang)
        message += t('settings.city', lang, city=city)
        message += t('settings.notifications', lang)
        for key in SUB_ORDER:
            full_key, _short = SUB_KEYS[key]
            message += f"{chk(key)} {t(full_key, lang)}\n"

        keyboard = [
            [
                InlineKeyboardButton(f"{chk('iss')} {t(SUB_KEYS['iss'][1], lang)}", callback_data='sub_iss'),
                InlineKeyboardButton(f"{chk('apod')} {t(SUB_KEYS['apod'][1], lang)}", callback_data='sub_apod'),
                InlineKeyboardButton(f"{chk('launches')} {t(SUB_KEYS['launches'][1], lang)}", callback_data='sub_launches'),
            ],
            [
                InlineKeyboardButton(f"{chk('neo')} {t(SUB_KEYS['neo'][1], lang)}", callback_data='sub_neo'),
                InlineKeyboardButton(f"{chk('news')} {t(SUB_KEYS['news'][1], lang)}", callback_data='sub_news'),
                InlineKeyboardButton(f"{chk('meteors')} {t(SUB_KEYS['meteors'][1], lang)}", callback_data='sub_meteors'),
            ],
            [
                InlineKeyboardButton(f"{chk('flares')} {t(SUB_KEYS['flares'][1], lang)}", callback_data='sub_flares'),
                InlineKeyboardButton(f"{chk('grb')} {t(SUB_KEYS['grb'][1], lang)}", callback_data='sub_grb'),
            ],
            [
                InlineKeyboardButton(t('settings.change_city', lang), callback_data='set_location'),
            ],
            [
                InlineKeyboardButton(t('menu.language', lang), callback_data='language'),
            ],
            [
                InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu'),
            ]
        ]

        await CallbackHandlers._replace_message(update, context,
            message,
            parse_mode='HTML',
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    @staticmethod
    async def choose_language(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Show language picker from settings."""
        lang = _lang_from(context)
        await CallbackHandlers._replace_message(update, context,
            t('lang.pick', lang),
            parse_mode='HTML',
            reply_markup=get_language_picker('settings')
        )

    @staticmethod
    async def set_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle set location button"""
        user_id = update.effective_user.id
        lang = _lang_from(context)
        user_states[user_id] = 'waiting_for_city'

        await CallbackHandlers._replace_message(update, context,
            t('city.prompt', lang),
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton(t('city.cancel', lang), callback_data='back_menu')
            ]])
        )

    @staticmethod
    async def handle_city_selection(update: Update, context: ContextTypes.DEFAULT_TYPE, data: str):
        """Handle city selection from list"""
        user_id = update.effective_user.id
        lang = _lang_from(context)
        city_name = data.replace('city_', '')

        try:
            lat, lon, display_name = geocode_city(city_name)
            update_user_location(user_id, city_name, lat, lon)

            await CallbackHandlers._replace_message(update, context,
                t('city.set', lang, city=city_name, lat=f'{lat:.4f}', lon=f'{lon:.4f}'),
                parse_mode='HTML',
                reply_markup=get_main_menu(lang)
            )

            if user_id in user_states:
                del user_states[user_id]

        except Exception as e:
            logger.error(f"City selection error: {e}")
            await CallbackHandlers._replace_message(update, context,
                t('city.save_error', lang),
                reply_markup=get_main_menu(lang)
            )

    @staticmethod
    async def handle_cityloc_selection(update: Update, context: ContextTypes.DEFAULT_TYPE, data: str):
        """Handle a city picked from the disambiguated suggestions list.

        ``callback_data`` is ``cityloc:{lat}:{lon}`` — the exact coordinates
        Nominatim returned for the chosen candidate, so the user's selection is
        stored verbatim. We only reverse-geocode the coordinates for a
        human-readable city label (in the user's language); we never re-geocode
        a bare name, which is what caused wrong-country results before.
        """
        user_id = update.effective_user.id
        lang = _lang_from(context)

        try:
            parts = data.split(':')
            # parts == ['cityloc', '<lat>', '<lon>']
            lat = float(parts[1])
            lon = float(parts[2])
        except (IndexError, ValueError):
            logger.error(f"Malformed cityloc callback data: {data}")
            await CallbackHandlers._replace_message(update, context,
                t('city.save_error', lang),
                reply_markup=get_main_menu(lang)
            )
            return

        try:
            rev = reverse_geocode(lat, lon, lang)
            if rev:
                city_label = rev[0]
            else:
                city_label = f"{lat:.2f}, {lon:.2f}"

            update_user_location(user_id, city_label, lat, lon)

            if user_id in user_states:
                del user_states[user_id]

            await CallbackHandlers._replace_message(update, context,
                t('city.set', lang, city=city_label, lat=f'{lat:.4f}', lon=f'{lon:.4f}'),
                parse_mode='HTML',
                reply_markup=get_main_menu(lang)
            )

        except Exception as e:
            logger.error(f"Cityloc selection error: {e}")
            await CallbackHandlers._replace_message(update, context,
                t('city.save_error', lang),
                reply_markup=get_main_menu(lang)
            )

    @staticmethod
    async def handle_subscription_toggle(update: Update, context: ContextTypes.DEFAULT_TYPE, data: str):
        """Handle subscription toggle"""
        user_id = update.effective_user.id
        lang = _lang_from(context)
        sub_type = data.replace('sub_', '')

        try:
            new_status = toggle_subscription(user_id, sub_type)
            full_key, _short = SUB_KEYS.get(sub_type, (None, None))
            name = t(full_key, lang) if full_key else sub_type
            if new_status:
                status_text = t('settings.toggle_on', lang, name=name)
            else:
                status_text = t('settings.toggle_off', lang, name=name)

            await update.callback_query.answer(status_text)
            await CallbackHandlers.settings(update, context)

        except Exception as e:
            logger.error(f"Subscription toggle error: {e}")
            await update.callback_query.answer(t('settings.toggle_error', lang))

    @staticmethod
    async def back_to_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Return to main menu"""
        user_id = update.effective_user.id
        if user_id in user_states:
            del user_states[user_id]

        lang = _lang_from(context)

        message = t('back.title', lang)
        message += t('back.greeting', lang)
        message += t('back.line.iss', lang)
        message += t('back.line.launches', lang)
        message += t('back.line.neo', lang)
        message += t('back.line.apod', lang)
        message += t('back.line.weather', lang)
        message += t('back.line.sky', lang)
        message += t('back.note', lang)

        await CallbackHandlers._replace_message(
            update, context, message,
            parse_mode='HTML',
            reply_markup=get_main_menu(lang)
        )