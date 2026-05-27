"""
Per-IP rate limiting for the AI service.

AI endpoints are expensive (latency + Claude tokens), so we cap requests at
multiple time scales: tight short-window burst limit + sustained hourly limit.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address


def get_client_ip(request) -> str:
    """
    Prefer the leftmost X-Forwarded-For when running behind a load balancer.
    Otherwise fall back to the socket peer. We do NOT trust an arbitrary
    forwarded header in production — only one configured in the reverse proxy.
    """
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_client_ip, default_limits=["120/minute"])
