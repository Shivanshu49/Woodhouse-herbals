import type { SkinType, SkinConcern, HairConcern } from './product';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  skinType?: SkinType;
  primaryConcerns?: (SkinConcern | HairConcern)[];
}
