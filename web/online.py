"""In-process online-visitor counter for the site footer.

Tracks unique client IPs that have hit ``GET /api/online`` within
``ONLINE_WINDOW`` seconds. State lives in a module-level dict shared by all
requests on the single uvicorn process; a restart simply resets the count,
which is fine for a "who's here right now" indicator. No persistence, no
external store.
"""
from __future__ import annotations

import time

# How long a visitor stays "online" after their last heartbeat. The footer
# polls every 30 s, so 90 s survives a single missed poll without dropping a
# still-present visitor.
ONLINE_WINDOW = 90.0

_SEEN: dict[str, float] = {}


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