"""Message handlers for text input"""
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from database import (
    get_city_suggestions, reverse_geocode,
    update_user_location, get_user,
)
from handlers.callbacks import CallbackHandlers
from utils.keyboards import get_main_menu
from utils.i18n import t, normalize_lang, DEFAULT_LANG
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
            user = get_user(user_id)
            lang = normalize_lang(user.get('lang')) if user else DEFAULT_LANG
            # Unknown message - show menu
            await update.message.reply_text(
                t('msg.unknown', lang),
                parse_mode='HTML',
                reply_markup=get_main_menu(lang)
            )

    @staticmethod
    async def handle_city_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle city name text input — always show a disambiguated picker.

        We never auto-pick the top Nominatim result: ambiguous names like
        "Paris" or "Springfield" would silently resolve to the wrong country.
        Instead we show up to 5 candidates (each labelled with its country)
        and encode the exact coordinates in the callback_data, so the user's
        choice is stored verbatim — no re-geocoding of a bare name.
        """
        user_id = update.effective_user.id
        city_name = update.message.text.strip()
        user = get_user(user_id)
        lang = normalize_lang(user.get('lang')) if user else DEFAULT_LANG

        try:
            suggestions = get_city_suggestions(city_name, lang, limit=5)

            if not suggestions:
                await update.message.reply_text(
                    t('city.not_found', lang, city=city_name),
                    parse_mode='HTML',
                    reply_markup=InlineKeyboardMarkup([[
                        InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu')
                    ]])
                )
                return

            keyboard = []
            message = t('city.suggest_header', lang)

            for i, city in enumerate(suggestions[:5], 1):
                name = city['short_name'] or city.get('display_name', '').split(',')[0]
                country = city.get('country', '')
                state = city.get('state', '')
                # Compact, disambiguating label
                if state and country and state != country:
                    display = f"{name}, {state}, {country}"
                elif country:
                    display = f"{name}, {country}"
                else:
                    display = name
                message += f"{i}. {city.get('display_name') or display}\n"

                # Encode exact coordinates (handles negative lat/lon; ~25 bytes)
                try:
                    lat = float(city['lat'])
                    lon = float(city['lon'])
                except (TypeError, ValueError):
                    continue
                callback_data = f"cityloc:{lat:.4f}:{lon:.4f}"
                keyboard.append([InlineKeyboardButton(display, callback_data=callback_data)])

            keyboard.append([
                InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu')
            ])

            await update.message.reply_text(
                message,
                parse_mode='HTML',
                reply_markup=InlineKeyboardMarkup(keyboard)
            )

        except Exception as e:
            logger.error(f"City suggestions failed for '{city_name}': {e}")
            await update.message.reply_text(
                t('city.search_error', lang),
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu')
                ]])
            )

    @staticmethod
    async def handle_location(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle a Telegram location message.

        Only acted upon while the user is in the 'waiting_for_city' state —
        the most reliable way for an international user to set their exact
        coordinates without any geocoding ambiguity.
        """
        user_id = update.effective_user.id
        if user_id not in user_states or user_states[user_id] != 'waiting_for_city':
            return

        location = update.message.location
        if location is None:
            return

        user = get_user(user_id)
        lang = normalize_lang(user.get('lang')) if user else DEFAULT_LANG
        lat = location.latitude
        lon = location.longitude

        try:
            # Reverse-geocode for a human-readable city label in the user's lang
            rev = reverse_geocode(lat, lon, lang)
            if rev:
                city_label = rev[0]
            else:
                city_label = f"{lat:.2f}, {lon:.2f}"

            update_user_location(user_id, city_label, lat, lon)
            del user_states[user_id]

            await update.message.reply_text(
                t('city.set', lang, city=city_label, lat=f'{lat:.4f}', lon=f'{lon:.4f}'),
                parse_mode='HTML',
                reply_markup=get_main_menu(lang)
            )
        except Exception as e:
            logger.error(f"Location set failed for {user_id}: {e}")
            await update.message.reply_text(
                t('city.save_error', lang),
                reply_markup=InlineKeyboardMarkup([[
                    InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu')
                ]])
            )