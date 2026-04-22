"""Telegram inline keyboards — single source of truth."""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def get_main_menu() -> InlineKeyboardMarkup:
    """Return the bot's main menu keyboard."""
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
            InlineKeyboardButton("🌌 Полярне сяйво", callback_data='aurora'),
            InlineKeyboardButton("👽 Погода на Марсі", callback_data='mars'),
        ],
        [
            InlineKeyboardButton("🔭 Астроподії", callback_data='astronomy'),
            InlineKeyboardButton("🌙 Фаза місяця", callback_data='moon'),
        ],
        [
            InlineKeyboardButton("⚙️ Налаштування", callback_data='settings'),
        ]
    ])
