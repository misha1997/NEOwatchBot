"""Tiny in-memory TTL cache shared by the web data layer.

The bot and the site run in the same process, so a module-level dict here is
shared between them. External APIs are rate-limited and slow (NOAA, N2YO,
NASA), so we cache their raw payloads for a short TTL and let both the API
endpoints and (eventually) the scheduler reuse the same values.

Keep it dependency-free: no Redis, no disk. If the process restarts the cache
repopulates on first request, which is fine.
"""
import time
from typing import Any, Callable, Tuple, TypeVar

T = TypeVar("T")

_CACHE: dict[str, Tuple[float, Any]] = {}


def get_or_fetch(key: str, ttl: float, factory: Callable[[], T]) -> T:
    """Return cached value for ``key`` if fresh, else call ``factory()``.

    ``factory`` is a synchronous function (the bot services use ``requests``);
    callers wrap it in ``asyncio.to_thread`` so this lookup itself never blocks.
    """
    now = time.monotonic()
    entry = _CACHE.get(key)
    if entry and (now - entry[0]) < ttl:
        return entry[1]
    value = factory()
    _CACHE[key] = (now, value)
    return value


def clear(prefix: str = "") -> int:
    """Drop entries whose key starts with ``prefix``. Returns count removed."""
    keys = [k for k in _CACHE if k.startswith(prefix)]
    for k in keys:
        _CACHE.pop(k, None)
    return len(keys)