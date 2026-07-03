"""Telegram inline keyboards — single source of truth."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from utils.i18n import t, DEFAULT_LANG


def get_main_menu(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    """Return the bot's main menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t('menu.iss', lang), callback_data='iss_menu'),
            InlineKeyboardButton(t('menu.launches', lang), callback_data='launches'),
        ],
        [
            InlineKeyboardButton(t('menu.neo', lang), callback_data='neo'),
            InlineKeyboardButton(t('menu.apod', lang), callback_data='apod'),
        ],
        [
            InlineKeyboardButton(t('menu.weather', lang), callback_data='weather_menu'),
            InlineKeyboardButton(t('menu.sky', lang), callback_data='sky_menu'),
        ],
        [
            InlineKeyboardButton(t('menu.settings', lang), callback_data='settings'),
        ]
    ])


def get_iss_menu(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    """Return ISS & satellites sub-menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t('iss.now', lang), callback_data='iss_now'),
            InlineKeyboardButton(t('iss.passes', lang), callback_data='iss_passes'),
        ],
        [
            InlineKeyboardButton(t('iss.crew', lang), callback_data='iss_crew'),
            InlineKeyboardButton(t('iss.starlink', lang), callback_data='starlink'),
        ],
        [
            InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu'),
        ]
    ])


def get_weather_menu(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    """Return space weather sub-menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t('weather.space', lang), callback_data='space_weather'),
            InlineKeyboardButton(t('weather.aurora', lang), callback_data='aurora'),
        ],
        [
            InlineKeyboardButton(t('weather.mars', lang), callback_data='mars'),
        ],
        [
            InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu'),
        ]
    ])


def get_sky_menu(lang: str = DEFAULT_LANG) -> InlineKeyboardMarkup:
    """Return sky events sub-menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t('sky.meteors', lang), callback_data='meteor_showers'),
            InlineKeyboardButton(t('sky.astronomy', lang), callback_data='astronomy'),
        ],
        [
            InlineKeyboardButton(t('sky.moon', lang), callback_data='moon'),
        ],
        [
            InlineKeyboardButton(t('menu.back', lang), callback_data='back_menu'),
        ]
    ])


def get_language_picker(origin: str = 'menu') -> InlineKeyboardMarkup:
    """Return the language selection keyboard.

    origin is appended to the callback data so we know where to return after
    the language is chosen (e.g. 'settings', 'menu', 'start').
    """
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(t('lang.uk', 'uk'), callback_data=f'lang_uk:{origin}'),
            InlineKeyboardButton(t('lang.en', 'en'), callback_data=f'lang_en:{origin}'),
        ]
    ])