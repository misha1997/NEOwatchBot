"""Feedback delivery for the site feedback form.

The footer "Зворотній зв'язок" modal POSTs to ``/api/feedback``; this module
forwards the submission to the owner's Telegram chat via the bot
(``BOT_TOKEN`` → ``FEEDBACK_CHAT_ID``). This replaces an earlier SMTP setup —
no external mail credentials are needed, only the already-configured bot token.

The recipient (chat id) must have started the bot first; otherwise Telegram
rejects the send with 403 ``chat not found``. Without ``BOT_TOKEN`` this module
raises :class:`FeedbackNotConfigured` so the API layer answers 503 and the site
keeps serving.

``telegram.Bot.send_message`` is async (PTB v20+), so the API route can await
it directly — no thread offload needed.
"""
from __future__ import annotations

import logging
import os

from config import FEEDBACK_CHAT_ID

logger = logging.getLogger(__name__)

# Telegram message cap is 4096 chars; leave room for the header fields.
_MAX_MESSAGE = 3800
_MAX_NAME = 120
_MAX_EMAIL = 200


class FeedbackNotConfigured(RuntimeError):
    """Raised when the bot token is missing — API answers 503."""


def _trunc(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[:n]


async def send_feedback_telegram(name: str, email: str, message: str) -> None:
    """Forward a feedback submission to FEEDBACK_CHAT_ID via the bot.

    Raises :class:`FeedbackNotConfigured` if ``BOT_TOKEN`` or ``FEEDBACK_CHAT_ID`` is unset.
    """
    token = os.getenv("BOT_TOKEN")
    if not token or not FEEDBACK_CHAT_ID:
        raise FeedbackNotConfigured("BOT_TOKEN or FEEDBACK_CHAT_ID not set")

    name = _trunc(name, _MAX_NAME)
    email = _trunc(email, _MAX_EMAIL)
    message = _trunc(message, _MAX_MESSAGE)
    if not message:
        raise ValueError("empty message")

    text = (
        "✉ <b>Новий відгук з OrbitLight</b>\n\n"
        f"<b>Ім'я:</b> {name or '—'}\n"
        f"<b>Email:</b> {email or '—'}\n\n"
        "<b>Повідомлення:</b>\n"
        f"{message}"
    )

    # Imported lazily so the site can boot in site-only mode (no telegram deps).
    from telegram import Bot
    from telegram.error import TelegramError

    bot = Bot(token=token)
    try:
        await bot.send_message(
            chat_id=FEEDBACK_CHAT_ID,
            text=text,
            parse_mode="HTML",
        )
    except TelegramError as exc:
        # Re-raise as a generic error so the API layer maps it to a 500 with a
        # generic message — the raw Telegram payload must not leak to clients.
        logger.error("Feedback Telegram send failed: %s", exc)
        raise RuntimeError("telegram send failed") from exc
    logger.info("Feedback sent to Telegram chat %s", FEEDBACK_CHAT_ID)