"""
Per-IP rate limiting for the AI service.

AI endpoints are expensive (latency + Claude tokens), so we cap requests at
multiple time scales: tight short-window burst limit + sustained hourly limit.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from .config import get_settings


def get_client_ip(request) -> str:
    """
    Resolve the client IP used as the rate-limit key.

    X-Forwarded-For is only honoured when ``TRUST_PROXY`` is enabled (i.e. the
    service really sits behind a reverse proxy we control). In that case we take
    the *rightmost* entry — the hop appended by our immediate trusted proxy —
    because leftmost values are client-supplied and trivially spoofable to evade
    per-IP limits. With no trusted proxy we always use the socket peer.
    """
    if get_settings().trust_proxy:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            parts = [p.strip() for p in fwd.split(",") if p.strip()]
            if parts:
                return parts[-1]
    return get_remote_address(request)


limiter = Limiter(key_func=get_client_ip, default_limits=["120/minute"])
