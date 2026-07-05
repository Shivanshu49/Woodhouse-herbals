// Storefront content managed under /admin/content. Dates are ISO strings over
// the wire; nullable columns are `T | null`.

export interface HeroBanner {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  accent: string | null;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OfferStripItem {
  id: string;
  headline: string;
  code: string | null;
  href: string;
  active: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorMeta: string | null;
  avatarUrl: string | null;
  rating: number | null;
  body: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  bodyHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
  published: boolean;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A product currently populating a homepage section (via its flags). */
export interface HomepageSectionProduct {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl: string;
  status: string;
  priceMinor: number;
}

export interface HomepageSections {
  bestsellers: HomepageSectionProduct[];
  newArrivals: HomepageSectionProduct[];
  comboPacks: HomepageSectionProduct[];
}

// ── Create / update bodies (mirror the backend DTOs) ──────────────────

export interface BannerBody {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  imageUrl: string;
  accent?: string;
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface OfferStripBody {
  headline: string;
  code?: string;
  href?: string;
  active?: boolean;
  startsAt?: string;
  endsAt?: string;
}

export interface TestimonialBody {
  authorName: string;
  authorMeta?: string;
  avatarUrl?: string;
  rating?: number;
  body: string;
  active?: boolean;
}

export interface FaqBody {
  question: string;
  answer: string;
  category?: string;
  active?: boolean;
}

export interface StaticPageBody {
  slug: string;
  title: string;
  bodyHtml: string;
  metaTitle?: string;
  metaDescription?: string;
  published?: boolean;
}

export interface ReorderBody {
  items: Array<{ id: string; sortOrder: number }>;
}
