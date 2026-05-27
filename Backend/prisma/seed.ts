import { PrismaClient, ConcernType, ProductCategory, BadgeTone, SkinType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Wood House Herbals database…');

  // 1. Offer strip
  await prisma.offerStripItem.deleteMany();
  await prisma.offerStripItem.createMany({
    data: [
      { headline: 'FLAT 20% OFF on all herbal products — use code GLOW20', code: 'GLOW20', sortOrder: 0 },
      { headline: 'Free shipping on orders above ₹499', sortOrder: 1 },
      { headline: 'Cash on delivery available across India', sortOrder: 2 },
      { headline: 'Made in India · Cruelty-free · Vegan · GMP certified', href: '/about', sortOrder: 3 },
    ],
  });

  // 2. Hero banner
  await prisma.heroBanner.deleteMany();
  await prisma.heroBanner.create({
    data: {
      eyebrow: 'New season · Glow ritual',
      title: 'Rooted in nature.\nCrafted for your skin.',
      subtitle:
        'Modern, herbal skincare powered by Vit C, Niacinamide and time-tested ayurvedic botanicals. Visible results in 2–4 weeks.',
      ctaLabel: 'Shop the ritual',
      ctaHref: '/shop',
      imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1400&q=80&auto=format&fit=crop',
      accent: 'Free shipping over ₹499',
      active: true,
    },
  });

  // 3. Concerns
  const concernData = [
    { slug: 'acne', title: 'Acne & Breakouts', type: ConcernType.SKIN, accent: 'forest', description: 'Clarifying actives to calm, clear and prevent.' },
    { slug: 'pigmentation', title: 'Pigmentation', type: ConcernType.SKIN, accent: 'clay', description: 'Even out tone with Vit C & niacinamide rituals.' },
    { slug: 'dry-skin', title: 'Dry Skin', type: ConcernType.SKIN, accent: 'sand', description: 'Rice water & oats for soft, plump skin.' },
    { slug: 'tan', title: 'D-Tan', type: ConcernType.SKIN, accent: 'sage', description: 'Lift sun damage with antioxidant rinses.' },
    { slug: 'aging', title: 'Anti-Aging', type: ConcernType.SKIN, accent: 'clay', description: 'Plump fine lines with Vit C + ferulic.' },
    { slug: 'dullness', title: 'Dullness', type: ConcernType.SKIN, accent: 'sage', description: 'Bring back glow with brightening blends.' },
    { slug: 'hair-fall', title: 'Hair Fall', type: ConcernType.HAIR, accent: 'forest', description: 'Ayurvedic oils with bhringraj & brahmi.' },
    { slug: 'dandruff', title: 'Dandruff', type: ConcernType.HAIR, accent: 'sand', description: 'Soothe and balance with herbal scalp care.' },
  ];
  for (const [i, c] of concernData.entries()) {
    await prisma.concern.upsert({
      where: { slug: c.slug },
      create: { ...c, sortOrder: i, imageUrl: `https://images.unsplash.com/photo-15${56228720 + i * 1000}?w=800&q=80&auto=format&fit=crop` },
      update: { ...c, sortOrder: i },
    });
  }

  // 4. Products (a representative sample)
  type ProductSeed = {
    slug: string;
    sku: string;
    name: string;
    short: string;
    long: string;
    category: ProductCategory;
    size: string;
    isCombo: boolean;
    priceMinor: number;
    compareAtPriceMinor: number;
    rating: number;
    reviewCount: number;
    thumbnailUrl: string;
    skinTypes: SkinType[];
    concernSlugs: string[];
    badges: { label: string; tone: BadgeTone }[];
    ingredients: { name: string; benefit: string }[];
    benefits: string[];
    howToUse: string[];
  };

  const productSeeds: ProductSeed[] = [
    {
      slug: 'vit-c-face-wash-100ml',
      sku: 'WH-FW-VC100',
      name: 'Vit C Brightening Face Wash',
      short: 'Gentle daily cleanser with Vitamin C & turmeric for radiant skin.',
      long: 'A daily cleanser that lifts away dirt, pollution and excess sebum without stripping your skin.',
      category: ProductCategory.FACE_WASH,
      size: '100 ml',
      isCombo: false,
      priceMinor: 34900,
      compareAtPriceMinor: 49900,
      rating: 4.7,
      reviewCount: 1284,
      thumbnailUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.ALL],
      concernSlugs: ['dullness', 'pigmentation', 'tan'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Vitamin C', benefit: 'Brightens & evens tone' },
        { name: 'Turmeric', benefit: 'Soothes & calms' },
        { name: 'Aloe Vera', benefit: 'Hydrates & softens' },
      ],
      benefits: ['Visible glow in 2 weeks', 'Removes tan', 'Paraben & sulphate free', 'Daily use'],
      howToUse: ['Wet face with lukewarm water', 'Take a pea-sized amount and lather', 'Massage 30 seconds, rinse'],
    },
    {
      slug: 'anti-acne-salicylic-face-wash',
      sku: 'WH-FW-SA100',
      name: 'Anti-Acne Salicylic Face Wash',
      short: '2% salicylic acid + neem to clear breakouts without dryness.',
      long: 'A clarifying cleanser that gently exfoliates inside the pores.',
      category: ProductCategory.FACE_WASH,
      size: '100 ml',
      isCombo: false,
      priceMinor: 39900,
      compareAtPriceMinor: 54900,
      rating: 4.6,
      reviewCount: 942,
      thumbnailUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.OILY, SkinType.COMBINATION],
      concernSlugs: ['acne'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Salicylic Acid 2%', benefit: 'Unclogs pores' },
        { name: 'Neem', benefit: 'Anti-bacterial' },
        { name: 'Niacinamide', benefit: 'Fades dark spots' },
      ],
      benefits: ['Clears active acne', 'Controls oil', 'Refines pores'],
      howToUse: ['Wet face', 'Apply 2-3 drops, lather', 'Avoid eyes, rinse'],
    },
    {
      slug: 'rice-water-oats-face-wash',
      sku: 'WH-FW-RO100',
      name: 'Rice Water + Oats Face Wash',
      short: 'Korean-inspired rice water cleanser for soft, milky skin.',
      long: 'A creamy, low-foam cleanser inspired by Korean glass-skin rituals.',
      category: ProductCategory.FACE_WASH,
      size: '100 ml',
      isCombo: false,
      priceMinor: 37900,
      compareAtPriceMinor: 49900,
      rating: 4.8,
      reviewCount: 612,
      thumbnailUrl: 'https://images.unsplash.com/photo-1631730486572-226d1f595b68?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.DRY, SkinType.SENSITIVE, SkinType.NORMAL],
      concernSlugs: ['dullness', 'dry-skin'],
      badges: [{ label: 'New', tone: BadgeTone.NEW }],
      ingredients: [
        { name: 'Fermented Rice Water', benefit: 'Brightens & smooths' },
        { name: 'Colloidal Oats', benefit: 'Calms sensitive skin' },
      ],
      benefits: ['Plump, dewy finish', 'Repairs barrier'],
      howToUse: ['Apply to damp skin', 'Massage 30 seconds', 'Rinse'],
    },
    {
      slug: 'vit-c-brightening-serum',
      sku: 'WH-SR-VC30',
      name: 'Vit C Brightening Serum',
      short: '15% stabilized Vitamin C for visible glow in 4 weeks.',
      long: 'A featherlight serum with 15% L-Ascorbic Acid, ferulic acid and Vitamin E.',
      category: ProductCategory.SERUM,
      size: '30 ml',
      isCombo: false,
      priceMinor: 59900,
      compareAtPriceMinor: 79900,
      rating: 4.7,
      reviewCount: 821,
      thumbnailUrl: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.ALL],
      concernSlugs: ['pigmentation', 'dullness', 'aging'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Vitamin C 15%', benefit: 'Brightens & evens tone' },
        { name: 'Ferulic Acid', benefit: 'Antioxidant boost' },
      ],
      benefits: ['Reduces pigmentation', 'Boosts collagen'],
      howToUse: ['Apply 3-4 drops after cleansing', 'Use morning with SPF'],
    },
    {
      slug: 'bhringraj-hair-fall-oil',
      sku: 'WH-HO-BR100',
      name: 'Bhringraj Hair Fall Control Oil',
      short: '10 ayurvedic herbs for stronger, fuller hair.',
      long: 'A traditional ayurvedic blend cold-infused with bhringraj, brahmi, amla and curry leaves.',
      category: ProductCategory.HAIR_OIL,
      size: '100 ml',
      isCombo: false,
      priceMinor: 44900,
      compareAtPriceMinor: 59900,
      rating: 4.6,
      reviewCount: 387,
      thumbnailUrl: 'https://images.unsplash.com/photo-1626808642875-0aa545482dfb?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.ALL],
      concernSlugs: ['hair-fall'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Bhringraj', benefit: 'Reduces hair fall' },
        { name: 'Brahmi', benefit: 'Strengthens roots' },
      ],
      benefits: ['Less hair fall in 6 weeks', 'Soothes scalp'],
      howToUse: ['Warm and massage into scalp', 'Leave 2 hours before shampoo'],
    },
    {
      slug: 'anti-acne-glow-combo',
      sku: 'WH-CB-AAG',
      name: 'Anti-Acne & Glow Booster Combo',
      short: 'Face wash + serum + scrub + night gel — a complete kit.',
      long: 'Our most-loved kit for breakout-prone skin.',
      category: ProductCategory.COMBO,
      size: '4-piece kit',
      isCombo: true,
      priceMinor: 114800,
      compareAtPriceMinor: 159600,
      rating: 4.8,
      reviewCount: 256,
      thumbnailUrl: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.OILY, SkinType.COMBINATION],
      concernSlugs: ['acne'],
      badges: [{ label: 'Combo Saver', tone: BadgeTone.SALE }],
      ingredients: [{ name: 'Salicylic Acid', benefit: 'Clears pores' }],
      benefits: ['Save ₹450', 'Complete 4-step ritual'],
      howToUse: ['Cleanse → tone → moisturise', 'Scrub 2x a week'],
    },
  ];

  for (const seed of productSeeds) {
    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      create: {
        slug: seed.slug,
        sku: seed.sku,
        name: seed.name,
        shortDescription: seed.short,
        longDescription: seed.long,
        category: seed.category,
        size: seed.size,
        isCombo: seed.isCombo,
        priceMinor: seed.priceMinor,
        compareAtPriceMinor: seed.compareAtPriceMinor,
        rating: seed.rating,
        reviewCount: seed.reviewCount,
        stockQty: 100,
        thumbnailUrl: seed.thumbnailUrl,
        thumbnailAlt: seed.name,
        benefits: seed.benefits,
        howToUse: seed.howToUse,
        skinTypes: seed.skinTypes,
      },
      update: {},
    });

    // Reset relations to keep the seed idempotent
    await prisma.productBadge.deleteMany({ where: { productId: product.id } });
    await prisma.ingredient.deleteMany({ where: { productId: product.id } });
    await prisma.productConcern.deleteMany({ where: { productId: product.id } });

    if (seed.badges.length) {
      await prisma.productBadge.createMany({
        data: seed.badges.map((b) => ({ productId: product.id, label: b.label, tone: b.tone })),
      });
    }
    await prisma.ingredient.createMany({
      data: seed.ingredients.map((i, idx) => ({ productId: product.id, name: i.name, benefit: i.benefit, sortOrder: idx })),
    });
    for (const slug of seed.concernSlugs) {
      const concern = await prisma.concern.findUnique({ where: { slug } });
      if (concern) {
        await prisma.productConcern.upsert({
          where: { productId_concernId: { productId: product.id, concernId: concern.id } },
          create: { productId: product.id, concernId: concern.id },
          update: {},
        });
      }
    }
  }

  console.log('✅ Seed completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
