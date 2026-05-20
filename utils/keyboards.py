"""Telegram inline keyboards — single source of truth."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def get_main_menu() -> InlineKeyboardMarkup:
    """Return the bot's main menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🛰️ МКС", callback_data='iss_menu'),
            InlineKeyboardButton("🚀 Запуски", callback_data='launches'),
        ],
        [
            InlineKeyboardButton("🌑 Астероїди", callback_data='neo'),
            InlineKeyboardButton("🌌 Фото дня", callback_data='apod'),
        ],
        [
            InlineKeyboardButton("☀️ Космопогода", callback_data='weather_menu'),
            InlineKeyboardButton("🔭 Небо", callback_data='sky_menu'),
        ],
        [
            InlineKeyboardButton("⚙️ Налаштування", callback_data='settings'),
        ]
    ])


def get_iss_menu() -> InlineKeyboardMarkup:
    """Return ISS & satellites sub-menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🛰️ Де зараз?", callback_data='iss_now'),
            InlineKeyboardButton("📡 Проходження", callback_data='iss_passes'),
        ],
        [
            InlineKeyboardButton("👨‍🚀 Екіпаж", callback_data='iss_crew'),
            InlineKeyboardButton("🛰️ Starlink", callback_data='starlink'),
        ],
        [
            InlineKeyboardButton("🔙 Головне меню", callback_data='back_menu'),
        ]
    ])


def get_weather_menu() -> InlineKeyboardMarkup:
    """Return space weather sub-menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📊 Космічна погода", callback_data='space_weather'),
            InlineKeyboardButton("🌌 Полярне сяйво", callback_data='aurora'),
        ],
        [
            InlineKeyboardButton("🔴 Погода на Марсі", callback_data='mars'),
        ],
        [
            InlineKeyboardButton("🔙 Головне меню", callback_data='back_menu'),
        ]
    ])


def get_sky_menu() -> InlineKeyboardMarkup:
    """Return sky events sub-menu keyboard."""
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🌠 Метеорні потоки", callback_data='meteor_showers'),
            InlineKeyboardButton("🔭 Астроподії", callback_data='astronomy'),
        ],
        [
            InlineKeyboardButton("🌙 Фаза Місяця", callback_data='moon'),
        ],
        [
            InlineKeyboardButton("🔙 Головне меню", callback_data='back_menu'),
        ]
    ])