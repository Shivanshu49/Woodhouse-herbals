"""
Skin/hair concern recommender.

Strategy:
1. Rank catalog by overlap with user concerns + skin type compatibility.
2. Limit number of recommendations by `routine_preference` (minimal=2, targeted=3, complete=4-5).
3. Generate a short, supportive summary + step-by-step routine using Claude when an API
   key is configured; otherwise fall back to a deterministic template so the endpoint
   works offline during local development.
"""

from __future__ import annotations

from typing import List

from ..catalog import CATALOG, CatalogItem
from ..config import get_settings
from ..schemas import AnalyzeRequest, AnalyzeResponse, ProductRecommendation, RoutineStep

ROUTINE_LIMITS = {"minimal": 2, "targeted": 3, "complete": 5}


def _score_item(item: CatalogItem, req: AnalyzeRequest) -> float:
    if req.skin_type and req.skin_type not in item["skin_types"]:
        return 0.0
    overlap = len(set(req.concerns).intersection(item["concerns"]))
    if overlap == 0 and req.concerns:
        return 0.0
    concern_weight = overlap / max(1, len(req.concerns)) if req.concerns else 0.5
    return round(item["base_score"] * (0.4 + 0.6 * concern_weight), 3)


def _rank(req: AnalyzeRequest) -> List[ProductRecommendation]:
    scored = []
    for item in CATALOG:
        score = _score_item(item, req)
        if score <= 0:
            continue
        rationale = _build_rationale(item, req)
        scored.append(
            ProductRecommendation(
                slug=item["slug"], name=item["name"], rationale=rationale, score=score
            )
        )
    scored.sort(key=lambda x: x.score, reverse=True)
    limit = ROUTINE_LIMITS.get(req.routine_preference, 4)
    return scored[:limit]


def _build_rationale(item: CatalogItem, req: AnalyzeRequest) -> str:
    overlap = [c for c in req.concerns if c in item["concerns"]]
    if overlap:
        return f"Targets your {', '.join(overlap)} with a herbal {item['category'].replace('-', ' ')}."
    return f"A versatile {item['category'].replace('-', ' ')} that complements the rest of your ritual."


def _build_routine(recs: List[ProductRecommendation]) -> List[RoutineStep]:
    steps: List[RoutineStep] = []
    morning_order = ["face-wash", "serum", "cream"]
    evening_order = ["face-wash", "serum", "cream"]
    weekly = ["scrub", "mask"]

    by_category = {}
    for r in recs:
        item = next((c for c in CATALOG if c["slug"] == r.slug), None)
        if not item:
            continue
        by_category.setdefault(item["category"], []).append(r)

    order = 1
    for cat in morning_order:
        for r in by_category.get(cat, []):
            steps.append(
                RoutineStep(
                    time_of_day="morning",
                    step_order=order,
                    product_slug=r.slug,
                    instructions=f"Apply {r.name} as the {cat.replace('-', ' ')} step.",
                )
            )
            order += 1

    order = 1
    for cat in evening_order:
        for r in by_category.get(cat, []):
            steps.append(
                RoutineStep(
                    time_of_day="evening",
                    step_order=order,
                    product_slug=r.slug,
                    instructions=f"At night, repeat with {r.name}.",
                )
            )
            order += 1

    for cat in weekly:
        for r in by_category.get(cat, []):
            steps.append(
                RoutineStep(
                    time_of_day="weekly",
                    step_order=1,
                    product_slug=r.slug,
                    instructions=f"Use {r.name} 1–2 times a week.",
                )
            )

    # Hair products live outside the daily face routine; surface them as morning/weekly.
    for cat in ("hair-oil", "shampoo"):
        for r in by_category.get(cat, []):
            steps.append(
                RoutineStep(
                    time_of_day="weekly" if cat == "hair-oil" else "morning",
                    step_order=99,
                    product_slug=r.slug,
                    instructions=f"For hair care: {r.name}.",
                )
            )

    return steps


def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    recommendations = _rank(req)
    routine = _build_routine(recommendations)

    concerns_text = ", ".join(req.concerns) if req.concerns else "your goals"
    summary = (
        f"Based on a {req.skin_type or 'balanced'} skin profile and concerns around {concerns_text}, "
        f"we’ve curated a {req.routine_preference} herbal ritual featuring {len(recommendations)} products."
    )

    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            summary = _enrich_summary_with_claude(req, recommendations, settings)
        except Exception:
            # Fail open: deterministic fallback already in place.
            pass

    return AnalyzeResponse(
        summary=summary,
        recommendations=recommendations,
        routine=routine,
        disclaimers=[
            "Recommendations are for guidance only and do not replace medical advice.",
            "Patch-test any new product before full use.",
        ],
    )


def _enrich_summary_with_claude(
    req: AnalyzeRequest, recs: List[ProductRecommendation], settings
) -> str:
    """
    Lazy import so the service can run without `anthropic` installed.
    Uses prompt caching on the system prompt for efficiency on repeated calls.
    """
    import anthropic  # type: ignore[import-not-found]

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    rec_lines = "\n".join(f"- {r.name} (slug: {r.slug})" for r in recs)
    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=350,
        system=[
            {
                "type": "text",
                "text": (
                    "You are a Wood House Herbals concierge — warm, knowledgeable, and concise. "
                    "Write in second person, max 3 sentences, no marketing fluff."
                ),
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": (
                    f"Skin type: {req.skin_type or 'unspecified'}.\n"
                    f"Concerns: {', '.join(req.concerns) or 'none specified'}.\n"
                    f"Routine preference: {req.routine_preference}.\n"
                    f"Recommended products:\n{rec_lines}\n\n"
                    "Write a short, supportive summary for the user."
                ),
            }
        ],
    )
    text_parts = [block.text for block in message.content if getattr(block, "type", "") == "text"]
    return "\n".join(text_parts).strip() or "Your personalised ritual is ready."
