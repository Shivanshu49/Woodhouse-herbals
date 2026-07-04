/**
 * Organization taxonomy: enum option lists (ProductCategory, SkinType,
 * BadgeTone), custom-tag handling, and the payload mapping. Relational
 * categories and concerns are fetched live (see use-categories / use-concerns)
 * — only their ids are carried here.
 */

import { CATEGORY_OPTIONS } from '@/lib/product-meta';

// The ProductCategory enum options already live in product-meta (shared with the
// products list) — reuse them here rather than duplicating the label map.
export const PRODUCT_CATEGORY_OPTIONS = CATEGORY_OPTIONS;
export const PRODUCT_CATEGORY_VALUES = CATEGORY_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const SKIN_TYPE_OPTIONS = [
  { value: 'OILY', label: 'Oily' },
  { value: 'DRY', label: 'Dry' },
  { value: 'COMBINATION', label: 'Combination' },
  { value: 'SENSITIVE', label: 'Sensitive' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'ALL', label: 'All skin types' },
] as const;

export const SKIN_TYPE_VALUES = SKIN_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
export type SkinTypeValue = (typeof SKIN_TYPE_OPTIONS)[number]['value'];

export const BADGE_TONE_OPTIONS = [
  { value: 'BESTSELLER', label: 'Bestseller' },
  { value: 'NEW', label: 'New' },
  { value: 'SALE', label: 'Sale' },
  { value: 'LIMITED', label: 'Limited' },
] as const;

// Explicit literal tuple (not a widened .map) so z.enum keeps the union type —
// the create-payload mapper needs form badges' tone to stay BadgeToneValue.
export const BADGE_TONE_VALUES = ['BESTSELLER', 'NEW', 'SALE', 'LIMITED'] as const;
export type BadgeToneValue = (typeof BADGE_TONE_VALUES)[number];

export const TAG_MAX_LENGTH = 30;
export const BADGE_LABEL_MAX_LENGTH = 30;

/**
 * Add a custom tag: trims, ignores empties, rejects over-length values (so an
 * un-submittable tag never enters state), and dedupes case-insensitively.
 */
export function addTag(tags: string[], raw: string): string[] {
  const t = raw.trim();
  if (!t || t.length > TAG_MAX_LENGTH) return tags;
  if (tags.some((existing) => existing.toLowerCase() === t.toLowerCase())) return tags;
  return [...tags, t];
}

export interface BadgeInput {
  label: string;
  tone: BadgeToneValue;
}

export interface OrganizationInput {
  category: string;
  categoryIds: string[];
  concernIds: string[];
  skinTypes: string[];
  tags: string[];
  badges: BadgeInput[];
}

export interface OrganizationPayload {
  category: string;
  categoryIds?: string[];
  concernIds?: string[];
  skinTypes?: string[];
  tags?: string[];
  badges?: BadgeInput[];
}

/** Map the Organization fields to the backend payload — category always sent, empty arrays omitted. */
export function organizationToPayload(v: OrganizationInput): OrganizationPayload {
  const out: OrganizationPayload = { category: v.category };
  if (v.categoryIds.length) out.categoryIds = v.categoryIds;
  if (v.concernIds.length) out.concernIds = v.concernIds;
  if (v.skinTypes.length) out.skinTypes = v.skinTypes;
  if (v.tags.length) out.tags = v.tags;
  if (v.badges.length) out.badges = v.badges;
  return out;
}
