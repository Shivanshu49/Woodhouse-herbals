"""
Wood House Herbals — AI service entrypoint.

Endpoints:
- GET  /health                  liveness probe
- GET  /v1/health               readiness + model info
- POST /v1/skin-analysis        skin/hair concern analysis + recommendations

Security posture:
- CORS allow-list bound to ALLOWED_ORIGINS env (no wildcard).
- Per-IP rate limiting via slowapi (burst + hourly).
- Strict body size cap (32 KB) — recommendations only need a few hundred bytes.
- Input is validated by Pydantic; we never echo user content as raw markdown
  or HTML, so prompt-injection risk is bounded to the model layer.
- ANTHROPIC_API_KEY is server-only and never returned in any response.
"""

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from .config import get_settings
from .rate_limit import limiter
from .schemas import AnalyzeRequest, AnalyzeResponse, HealthResponse
from .services.recommender import analyze

settings = get_settings()
MAX_BODY_BYTES = 32 * 1024


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized bodies before they reach the handler / parser."""

    async def dispatch(self, request: Request, call_next):
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > MAX_BODY_BYTES:
                    return Response(status_code=413, content="Payload too large")
            except ValueError:
                return Response(status_code=400, content="Invalid Content-Length")
        return await call_next(request)


app = FastAPI(
    title="Wood House Herbals AI",
    version="0.1.0",
    description="Skin/hair concern analysis and personalised recommendations.",
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
def _rate_limit_handler(_request: Request, exc: RateLimitExceeded) -> Response:
    return Response(status_code=429, content=f"Rate limit exceeded: {exc.detail}")


app.add_middleware(SlowAPIMiddleware)
app.add_middleware(BodySizeLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
    max_age=600,
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="woodhouse-ai", model=settings.anthropic_model)


@app.get("/v1/health", response_model=HealthResponse)
def v1_health() -> HealthResponse:
    return health()


@app.post("/v1/skin-analysis", response_model=AnalyzeResponse)
@limiter.limit("10/minute;100/hour")
def skin_analysis(request: Request, payload: AnalyzeRequest) -> AnalyzeResponse:
    if not payload.concerns and not payload.skin_type:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one of: skin_type or concerns.",
        )
    return analyze(payload)
