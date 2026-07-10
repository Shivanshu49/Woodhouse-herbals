import type { HairConcern, SkinConcern } from './product';

export interface ConcernCard {
  slug: SkinConcern | HairConcern;
  title: string;
  description: string;
  imageUrl: string;
  /** Line announced but not launched — the tile carries a Coming-soon overlay. */
  comingSoon?: boolean;
}
