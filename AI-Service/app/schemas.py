from typing import List, Literal, Optional

from pydantic import BaseModel, Field

SkinType = Literal["oily", "dry", "combination", "sensitive", "normal"]
Concern = Literal[
    "acne",
    "pigmentation",
    "tan",
    "dry-skin",
    "dullness",
    "aging",
    "oily-skin",
    "hair-fall",
    "dandruff",
    "frizz",
    "dry-scalp",
    "thinning",
    "damage",
]
Routine = Literal["minimal", "complete", "targeted"]


class AnalyzeRequest(BaseModel):
    skin_type: Optional[SkinType] = Field(default=None, description="User-declared skin type")
    concerns: List[Concern] = Field(default_factory=list, description="Top concerns to address")
    routine_preference: Routine = "complete"
    age_range: Optional[Literal["teen", "20s", "30s", "40+"]] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    image_url: Optional[str] = None


class ProductRecommendation(BaseModel):
    slug: str
    name: str
    rationale: str
    score: float


class RoutineStep(BaseModel):
    time_of_day: Literal["morning", "evening", "weekly"]
    step_order: int
    product_slug: str
    instructions: str


class AnalyzeResponse(BaseModel):
    summary: str
    recommendations: List[ProductRecommendation]
    routine: List[RoutineStep]
    disclaimers: List[str]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    model: str
