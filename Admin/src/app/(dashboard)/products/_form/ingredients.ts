/**
 * Ingredients & Usage helpers. Repeatable rows map to the backend's ordered
 * item shapes (sortOrder = position after blanks are dropped). A partial
 * ingredient row (only one of name/benefit) is rejected by the schema, not
 * here — this mapper only runs once validation has passed.
 */

export interface IngredientRow {
  name: string;
  benefit: string;
}

export interface IngredientsUsageInput {
  ingredients: IngredientRow[];
  benefits: string[];
  howToUse: string[];
  inciText: string;
  usageFrequency: string;
  recommendedTime: string;
  parabenFree: boolean;
  sulfateFree: boolean;
  crueltyFree: boolean;
  vegan: boolean;
  alcoholFree: boolean;
}

export interface IngredientsUsagePayload {
  ingredients?: { name: string; benefit: string; sortOrder: number }[];
  benefitItems?: { text: string; sortOrder: number }[];
  howToUse?: string[];
  inciText?: string;
  usageFrequency?: string;
  recommendedTime?: string;
  parabenFree: boolean;
  sulfateFree: boolean;
  crueltyFree: boolean;
  vegan: boolean;
  alcoholFree: boolean;
}

/** Classify an ingredient row: both blank, exactly one filled (partial), or both filled. */
export function ingredientRowState(row: IngredientRow): 'blank' | 'partial' | 'complete' {
  const hasName = row.name.trim() !== '';
  const hasBenefit = row.benefit.trim() !== '';
  if (!hasName && !hasBenefit) return 'blank';
  if (hasName && hasBenefit) return 'complete';
  return 'partial';
}

export function ingredientsUsageToPayload(v: IngredientsUsageInput): IngredientsUsagePayload {
  const out: IngredientsUsagePayload = {
    parabenFree: v.parabenFree,
    sulfateFree: v.sulfateFree,
    crueltyFree: v.crueltyFree,
    vegan: v.vegan,
    alcoholFree: v.alcoholFree,
  };

  const ingredients = v.ingredients
    .filter((r) => ingredientRowState(r) !== 'blank')
    .map((r, sortOrder) => ({ name: r.name.trim(), benefit: r.benefit.trim(), sortOrder }));
  if (ingredients.length) out.ingredients = ingredients;

  const benefitItems = v.benefits
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, sortOrder) => ({ text, sortOrder }));
  if (benefitItems.length) out.benefitItems = benefitItems;

  const howToUse = v.howToUse.map((s) => s.trim()).filter(Boolean);
  if (howToUse.length) out.howToUse = howToUse;

  if (v.inciText.trim()) out.inciText = v.inciText.trim();
  if (v.usageFrequency.trim()) out.usageFrequency = v.usageFrequency.trim();
  if (v.recommendedTime.trim()) out.recommendedTime = v.recommendedTime.trim();

  return out;
}
