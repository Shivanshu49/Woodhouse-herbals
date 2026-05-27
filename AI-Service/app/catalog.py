"""
Lightweight in-memory catalog the AI service uses to map concerns -> product slugs.
In production this is replaced by a call to the commerce API (`/api/products`) or
a precomputed embedding index in Meilisearch.
"""

from typing import List, TypedDict


class CatalogItem(TypedDict):
    slug: str
    name: str
    concerns: List[str]
    skin_types: List[str]
    category: str
    base_score: float


CATALOG: List[CatalogItem] = [
    {
        "slug": "vit-c-face-wash-100ml",
        "name": "Vit C Brightening Face Wash",
        "concerns": ["dullness", "pigmentation", "tan"],
        "skin_types": ["oily", "dry", "combination", "sensitive", "normal"],
        "category": "face-wash",
        "base_score": 0.92,
    },
    {
        "slug": "anti-acne-salicylic-face-wash",
        "name": "Anti-Acne Salicylic Face Wash",
        "concerns": ["acne", "oily-skin"],
        "skin_types": ["oily", "combination"],
        "category": "face-wash",
        "base_score": 0.95,
    },
    {
        "slug": "rice-water-oats-face-wash",
        "name": "Rice Water + Oats Face Wash",
        "concerns": ["dry-skin", "dullness"],
        "skin_types": ["dry", "sensitive", "normal"],
        "category": "face-wash",
        "base_score": 0.9,
    },
    {
        "slug": "vit-c-brightening-serum",
        "name": "Vit C Brightening Serum",
        "concerns": ["pigmentation", "dullness", "aging"],
        "skin_types": ["oily", "dry", "combination", "sensitive", "normal"],
        "category": "serum",
        "base_score": 0.96,
    },
    {
        "slug": "niacinamide-10-serum",
        "name": "Niacinamide 10% Serum",
        "concerns": ["acne", "oily-skin", "pigmentation"],
        "skin_types": ["oily", "combination"],
        "category": "serum",
        "base_score": 0.93,
    },
    {
        "slug": "bhringraj-hair-fall-oil",
        "name": "Bhringraj Hair Fall Control Oil",
        "concerns": ["hair-fall", "thinning", "dry-scalp"],
        "skin_types": ["oily", "dry", "combination", "sensitive", "normal"],
        "category": "hair-oil",
        "base_score": 0.94,
    },
    {
        "slug": "amla-reetha-shampoo",
        "name": "Amla & Reetha Repair Shampoo",
        "concerns": ["hair-fall", "damage", "frizz"],
        "skin_types": ["oily", "dry", "combination", "sensitive", "normal"],
        "category": "shampoo",
        "base_score": 0.88,
    },
    {
        "slug": "green-tea-night-repair-gel",
        "name": "Green Tea Night Repair Gel",
        "concerns": ["acne", "dullness"],
        "skin_types": ["oily", "combination", "normal"],
        "category": "cream",
        "base_score": 0.86,
    },
]
