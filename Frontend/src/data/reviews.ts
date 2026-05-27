import type { Review } from '@/types';

export const reviewsByProduct: Record<string, Review[]> = {
  'p_vc_facewash_100': [
    {
      id: 'rv_1',
      productId: 'p_vc_facewash_100',
      authorName: 'Aanya M.',
      rating: 5,
      title: 'My skin finally feels alive again',
      body:
        'Used this for three weeks and the difference is unreal. Pigmentation around my cheeks has visibly faded and my skin feels softer after just one wash.',
      verifiedPurchase: true,
      createdAt: '2026-04-12T10:00:00Z',
    },
    {
      id: 'rv_2',
      productId: 'p_vc_facewash_100',
      authorName: 'Rohan K.',
      rating: 4,
      title: 'Gentle but effective',
      body: 'Doesnt dry out my combination skin and smells lovely. Will repurchase.',
      verifiedPurchase: true,
      createdAt: '2026-04-02T08:00:00Z',
    },
    {
      id: 'rv_3',
      productId: 'p_vc_facewash_100',
      authorName: 'Sneha P.',
      rating: 5,
      title: 'Better than my old brand at 3x the price',
      body: 'Love the bottle, love the ingredients list. No tightness after washing, glow appears within a week.',
      verifiedPurchase: false,
      createdAt: '2026-03-22T18:30:00Z',
    },
  ],
};

export const testimonials = [
  {
    name: 'Priya S.',
    handle: 'Mumbai',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&auto=format&fit=crop&crop=faces',
    quote:
      'The Anti-Acne combo cleared my breakouts in 3 weeks. My dermat actually asked which brand I was using!',
  },
  {
    name: 'Aman D.',
    handle: 'Bengaluru',
    avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=200&q=80&auto=format&fit=crop&crop=faces',
    quote:
      'Bhringraj oil is the real deal — I have noticeably less hair fall and my scalp feels calmer.',
  },
  {
    name: 'Riya V.',
    handle: 'Pune',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&q=80&auto=format&fit=crop&crop=faces',
    quote: 'Wood House feels like a luxury brand at an honest price. The Vit C serum is *chef’s kiss*.',
  },
];
