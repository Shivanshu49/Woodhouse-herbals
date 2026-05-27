import type { HairConcern, SkinConcern } from './product';

export interface ConcernCard {
  slug: SkinConcern | HairConcern;
  title: string;
  description: string;
  imageUrl: string;
  accent: 'forest' | 'clay' | 'sage' | 'sand';
}
