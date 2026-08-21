"""Browser Web Push delivery (VAPID) for anonymous site subscribers.

Sibling to the Telegram-send calls in services/scheduler.py: same trigger
points, same dedup logic, just a second delivery channel for people who use
the site but never started the bot. See push_subscriptions in database.py.
"""
import json
import logging

from pywebpush import WebPushException, webpush

from config import VAPID_CLAIM_EMAIL, VAPID_PRIVATE_KEY

logger = logging.getLogger(__name__)


def send_web_push(subscription: dict, title: str, body: str, url: str = None) -> bool | str:
    """Send one push message. Returns True on success, "gone" if the push
    service reports the subscription no longer exists (caller should delete
    it), or False on any other failure.
    """
    if not VAPID_PRIVATE_KEY:
        logger.warning("VAPID_PRIVATE_KEY not configured — skipping web push")
        return False

    subscription_info = {
        "endpoint": subscription["endpoint"],
        "keys": {
            "p256dh": subscription["p256dh"],
            "auth": subscription["auth"],
        },
    }

    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIM_EMAIL or 'admin@example.com'}"},
        )
        return True
    except WebPushException as e:
        status = e.response.status_code if e.response is not None else None
        if status in (404, 410):
            return "gone"
        logger.warning(f"Web push failed ({status}): {e}")
        return False
    except Exception as e:
        logger.error(f"Web push error: {e}")
        return False
