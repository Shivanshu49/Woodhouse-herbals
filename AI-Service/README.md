# Wood House Herbals — AI Service

A FastAPI service for skin/hair concern analysis and personalised product recommendations. Powered by Claude when an Anthropic API key is set; falls back to a deterministic recommender so the service is fully usable offline during local development.

## Quick start

```bash
cd apps/ai
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # optional: add ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8001
```

## Endpoints

| Method | Path                   | Purpose                                          |
|--------|------------------------|--------------------------------------------------|
| GET    | `/health`              | Liveness probe                                   |
| GET    | `/v1/health`           | Readiness + model info                           |
| POST   | `/v1/skin-analysis`    | Concern analysis + product recommendations       |

### Example

```bash
curl -s http://localhost:8001/v1/skin-analysis \
  -H 'Content-Type: application/json' \
  -d '{"skin_type":"oily","concerns":["acne","pigmentation"],"routine_preference":"complete"}' | jq
```

## Notes

- The service is **optional**. The storefront and commerce API run fully without it.
- The catalog used for ranking lives in `app/catalog.py`. In production, swap to a call against the commerce API or a Meilisearch index.
- When `ANTHROPIC_API_KEY` is configured, the summary is enriched via Claude with prompt caching on the system prompt to keep responses fast and cheap.
