"""In-process online-visitor counter for the site footer, plus day/week
unique-visitor tallies.

The "online now" count tracks unique client IPs that have hit
``GET /api/online`` within ``ONLINE_WINDOW`` seconds. State lives in a
module-level dict shared by all requests on the single uvicorn process; a
restart simply resets the count, which is fine for a "who's here right now"
indicator. No persistence, no external store.

The day/week counts need to survive a restart, so they're backed by the
``site_visits`` DB table (one row per unique visitor per day, IP stored only
as a truncated hash). Writes are deduped in-memory per day so a visitor's
repeat 30 s heartbeats don't hit the database, and both are best-effort: if
the DB is unavailable the site keeps serving and these just report 0 (see
CLAUDE.md's "site keeps serving the public dashboard" contract).
"""
from __future__ import annotations

import hashlib
import logging
import time
from datetime import date

from web.cache import get_or_fetch

logger = logging.getLogger(__name__)

# How long a visitor stays "online" after their last heartbeat. The footer
# polls every 30 s, so 90 s survives a single missed poll without dropping a
# still-present visitor.
ONLINE_WINDOW = 90.0

# How often the day/week counts are re-queried from the DB.
VISIT_COUNTS_TTL = 300.0

_SEEN: dict[str, float] = {}

# Visitor hashes already recorded for today, so repeat heartbeats from the
# same visitor skip the DB write. Cleared on date rollover.
_today: str | None = None
_today_recorded: set[str] = set()


def touch(client_id: str) -> int:
    """Record a heartbeat from ``client_id`` and return the current online count.

    Expired entries are pruned on every call — cheap at footer-poll rates and
    keeps the dict from growing unbounded. An empty ``client_id`` (no IP could
    be determined) still returns the count but does not register the caller.
    """
    now = time.monotonic()
    cutoff = now - ONLINE_WINDOW
    for cid in [c for c, t in _SEEN.items() if t < cutoff]:
        del _SEEN[cid]
    if client_id:
        _SEEN[client_id] = now
    return len(_SEEN)


def _hash_client(client_id: str) -> str:
    return hashlib.sha256(client_id.encode()).hexdigest()[:32]


def record_visit(client_id: str) -> None:
    """Best-effort: record ``client_id`` as a visitor for today in the DB.

    Deduped in-memory per calendar day so repeat heartbeats don't write
    twice. On a date rollover, also prunes rows older than a week so
    ``site_visits`` stays small. Silently no-ops if the DB is unavailable.
    """
    global _today
    if not client_id:
        return
    today = date.today().isoformat()
    h = _hash_client(client_id)
    rolled_over = _today != today
    if rolled_over:
        _today = today
        _today_recorded.clear()
    if h in _today_recorded:
        return
    _today_recorded.add(h)

    try:
        from database import get_db_connection

        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "INSERT IGNORE INTO site_visits (visit_date, client_hash) VALUES (%s, %s)",
                (today, h),
            )
            if rolled_over:
                cur.execute(
                    "DELETE FROM site_visits WHERE visit_date < CURDATE() - INTERVAL 7 DAY"
                )
            conn.commit()
        finally:
            cur.close()
            conn.close()
    except Exception:
        logger.debug("record_visit: DB unavailable, skipping", exc_info=True)


def _visit_counts_raw() -> dict:
    try:
        from database import get_db_connection

        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT "
                "COUNT(DISTINCT CASE WHEN visit_date = CURDATE() THEN client_hash END), "
                "COUNT(DISTINCT client_hash) "
                "FROM site_visits WHERE visit_date >= CURDATE() - INTERVAL 6 DAY"
            )
            day_count, week_count = cur.fetchone()
            return {"day": day_count or 0, "week": week_count or 0}
        finally:
            cur.close()
            conn.close()
    except Exception:
        logger.debug("get_visit_counts: DB unavailable", exc_info=True)
        return {"day": 0, "week": 0}


def get_visit_counts() -> dict:
    """Unique-visitor counts for today and the trailing 7 days (today
    inclusive), cached briefly to keep the footer's poll rate off the DB."""
    return get_or_fetch("site_visit_counts", VISIT_COUNTS_TTL, _visit_counts_raw)
