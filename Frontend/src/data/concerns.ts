import type { ConcernCard } from '@/types';

export const concerns: ConcernCard[] = [
  {
    slug: 'acne',
    title: 'Acne & Breakouts',
    description: 'Clarifying actives to calm, clear and prevent.',
    imageUrl: '/products/neem-face-wash.png',
  },
  {
    slug: 'pigmentation',
    title: 'Dark Spot & Pigmentation',
    description: 'Even out tone with Vit C & niacinamide rituals.',
    imageUrl: '/products/face-cream.png',
  },
  {
    slug: 'dry-skin',
    title: 'Dry Skin',
    description: 'Rice water & oats for soft, plump skin.',
    imageUrl: '/products/rice-water-oats-scrub.png',
  },
  {
    slug: 'aging',
    title: 'Anti-Aging',
    description: 'Plump fine lines with Vit C + ferulic.',
    imageUrl: '/products/vitamin-c-niacinamide-serum.png',
  },
  {
    slug: 'dullness',
    title: 'Dullness',
    description: 'Bring back glow with brightening blends.',
    imageUrl: '/products/vitamin-c-face-wash.png',
  },
  // Last on purpose (client call): the hair line hasn't launched yet, so the
  // tile closes the grid with a Coming-soon overlay.
  {
    slug: 'hair-fall',
    title: 'Hair care',
    description: 'Science backed precision based hair care products.',
    imageUrl: '/products/body-butter.png',
    comingSoon: true,
  },
];
