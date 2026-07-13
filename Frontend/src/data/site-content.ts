/**
 * Frontend-owned storefront chrome copy — the offer ribbon and the trust-badge
 * row. These carry the CLIENT-APPROVED wording (the 25% / WH25 offer and the
 * 6-pillar trust row) and NO product ids, so they are safe as a static frontend
 * module — unlike the product catalog, which must be live (see `useCatalog` /
 * `useHomepage`).
 *
 * ⚠ Divergence note: the live `GET /api/homepage` payload ALSO returns
 * `offerStrip` and `trust`, but with stale/generic copy — the seed still has
 * "FLAT 20% OFF … GLOW20" (superseded by 25% / WH25 in commit 883749b) and
 * `HomepageService` hardcodes a 4-badge trust set. Sourcing these two from the
 * live payload today would REGRESS the client-approved copy. They live here
 * until the backend seed (`offerStripItem`) and `HomepageService.trust` are
 * updated to this copy; moving them to the live payload for a single source of
 * truth is a backend follow-up. See docs/superpowers/plans/storefront-checkout.md.
 */

export interface OfferStripItem {
  headline: string;
  code?: string;
  href: string;
}

export interface TrustPillar {
  icon: string;
  title: string;
  subtitle: string;
}

export const OFFER_STRIP: OfferStripItem[] = [
  { headline: 'AMAZING OFFER · Get 25% off on purchase of ₹499 & above, use code WH25', code: 'WH25', href: '/shop' },
  { headline: 'Free shipping on orders above ₹499', href: '/shop' },
  { headline: 'Cash on delivery available across India', href: '/shop' },
  { headline: 'No Sulphate · No Silicone · No Paraben · Made in India', href: '/about' },
];

export const TRUST_PILLARS: TrustPillar[] = [
  { icon: 'leaf',     title: 'All Natural Ingredients',     subtitle: 'Plant-first formulations' },
  { icon: 'heart',    title: 'No Animal Testing',           subtitle: 'Cruelty-free always' },
  { icon: 'sparkles', title: 'No Harmful Chemicals',        subtitle: 'No Sulphates, No Paraben, No Silicone' },
  { icon: 'shield',   title: 'Dermatologically Tested',     subtitle: 'Safe for daily use' },
  { icon: 'check',    title: 'FDA Approved',                subtitle: 'GMP-certified facility' },
  { icon: 'india',    title: 'Clinically crafted in Bharat', subtitle: 'Science of fruits and root extracts' },
];
