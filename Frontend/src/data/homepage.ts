import type { HomepagePayload } from '@/types';
import { productSummaries } from './products';
import { concerns } from './concerns';

export const homepage: HomepagePayload = {
  offerStrip: [
    { headline: 'AMAZING OFFER · Get extra 20% off on ₹499+ — use code WH20', code: 'WH20', href: '/shop' },
    { headline: 'Free shipping on orders above ₹499', href: '/shop' },
    { headline: 'Cash on delivery available across India', href: '/shop' },
    { headline: 'No Sulphate · No Silicone · No Paraben · Made in India', href: '/about' },
  ],
  hero: {
    eyebrow: 'Skincare essentials',
    title: 'Glow naturally\nwith Wood House.',
    subtitle:
      "Crafted with nature's finest ingredients to deeply nourish, hydrate, and restore your skin's natural glow. Science-backed actives in a herbal base — visible results in 2–4 weeks.",
    ctaLabel: 'Explore the ritual',
    ctaHref: '/shop',
    image: '/products/vitamin-c-face-wash.png',
    accent: 'Extra 20% OFF · Code WH20',
  },
  bestsellers: productSummaries.filter((p) => p.badges?.some((b) => b.tone === 'bestseller')),
  newArrivals: productSummaries.filter((p) => p.badges?.some((b) => b.tone === 'new')),
  comboPacks: productSummaries.filter((p) => p.category === 'combo'),
  concerns,
  trust: [
    { icon: 'leaf',     title: 'All Natural Ingredients', subtitle: 'Plant-first formulations' },
    { icon: 'heart',    title: 'No Animal Testing',       subtitle: 'Cruelty-free always' },
    { icon: 'sparkles', title: 'No Harmful Chemicals',    subtitle: 'No Sulphates, No Paraben, No Silicone' },
    { icon: 'shield',   title: 'Dermatologically Tested', subtitle: 'Safe for daily use' },
    { icon: 'check',    title: 'FDA Approved',            subtitle: 'GMP-certified facility' },
    { icon: 'india',    title: 'Clinically crafted in Bharat', subtitle: 'Science of fruits and root extracts' },
  ],
};
