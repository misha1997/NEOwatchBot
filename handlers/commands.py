"""Command handlers for bot"""
from telegram import Update
from telegram.ext import ContextTypes
from database import get_user
from utils.keyboards import get_main_menu, get_language_picker
from utils.i18n import t, normalize_lang, DEFAULT_LANG
import logging

logger = logging.getLogger(__name__)


class CommandHandlers:
    """Handle Telegram commands"""

    @staticmethod
    async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /start command.

        New users (not yet in DB) see the language picker first; the user
        record is created only when a language is chosen. Existing users go
        straight to the main menu in their saved language.
        """
        user = update.effective_user
        user_id = user.id

        existing = get_user(user_id)
        if existing is None:
            # New user — choose language before anything else
            await update.message.reply_text(
                t('lang.pick'),
                reply_markup=get_language_picker('start'),
                parse_mode='HTML'
            )
            return

        lang = normalize_lang(existing.get('lang'))
        context.user_data['lang'] = lang

        message = t('start.title', lang) + '\n\n'
        message += t('start.greeting', lang, name=user.first_name or '')
        message += t('start.line.iss', lang)
        message += t('start.line.launches', lang)
        message += t('start.line.neo', lang)
        message += t('start.line.apod', lang)
        message += t('start.line.weather', lang)
        message += t('start.line.sky', lang)
        message += t('start.note', lang)

        await update.message.reply_text(
            message,
            reply_markup=get_main_menu(lang),
            parse_mode='HTML'
        )

    @staticmethod
    async def help(update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle /help command"""
        await CommandHandlers.start(update, context)