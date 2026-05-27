import type { HomepagePayload } from '@/types';
import { productSummaries } from './products';
import { concerns } from './concerns';

export const homepage: HomepagePayload = {
  offerStrip: [
    { headline: 'FLAT 20% OFF on all herbal products — use code GLOW20', code: 'GLOW20', href: '/shop' },
    { headline: 'Free shipping on orders above ₹499', href: '/shop' },
    { headline: 'Cash on delivery available across India', href: '/shop' },
    { headline: 'Made in India · Cruelty-free · Vegan · GMP certified', href: '/about' },
  ],
  hero: {
    eyebrow: 'New season · Glow ritual',
    title: 'Rooted in nature.\nCrafted for your skin.',
    subtitle:
      'Modern, herbal skincare powered by Vit C, Niacinamide and time-tested ayurvedic botanicals. Visible results in 2–4 weeks.',
    ctaLabel: 'Shop the ritual',
    ctaHref: '/shop',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1400&q=80&auto=format&fit=crop',
    accent: 'Free shipping over ₹499',
  },
  bestsellers: productSummaries.filter((p) => p.badges?.some((b) => b.tone === 'bestseller')),
  newArrivals: productSummaries.filter((p) => p.badges?.some((b) => b.tone === 'new')),
  comboPacks: productSummaries.filter((p) => p.category === 'combo'),
  concerns,
  trust: [
    { icon: 'leaf', title: 'Herbal & natural', subtitle: 'Plant-first formulations' },
    { icon: 'shield', title: 'Dermatologically tested', subtitle: 'Safe for daily use' },
    { icon: 'sparkles', title: 'GMP certified', subtitle: 'Made in our own facility' },
    { icon: 'heart', title: 'Cruelty-free', subtitle: 'Never tested on animals' },
  ],
};
