import {
  PrismaClient,
  ConcernType,
  ProductCategory,
  ProductStatus,
  StockStatus,
  BadgeTone,
  SkinType,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Wood House Herbals database…');

  // 1. Offer strip
  await prisma.offerStripItem.deleteMany();
  await prisma.offerStripItem.createMany({
    data: [
      { headline: 'AMAZING OFFER · Get 25% off on purchase of ₹499 & above, use code WH25', code: 'WH25', href: '/shop', sortOrder: 0 },
      { headline: 'Free shipping on orders above ₹499', href: '/shop', sortOrder: 1 },
      { headline: 'Cash on delivery available across India', href: '/shop', sortOrder: 2 },
      { headline: 'No Sulphate · No Silicone · No Paraben · Made in India', href: '/about', sortOrder: 3 },
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

  // 3.5 Retire the original placeholder catalogue. These sample rows predate
  //     the real product data below; we soft-delete (archive) them so the live
  //     admin list shows only the real Wood House Herbals catalogue. This is
  //     reversible from the admin "Restore" action and preserves any order
  //     history that references them.
  const LEGACY_PLACEHOLDER_SLUGS = [
    'vit-c-face-wash-100ml',
    'rice-water-oats-face-wash',
    'vit-c-brightening-serum',
    'bhringraj-hair-fall-oil',
    'anti-acne-glow-combo',
    'anti-acne-salicylic-face-wash',
  ];
  const retired = await prisma.product.updateMany({
    where: { slug: { in: LEGACY_PLACEHOLDER_SLUGS }, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (retired.count) console.log(`🗄️  Archived ${retired.count} legacy placeholder product(s).`);

  // 4. Products — the real Wood House Herbals catalogue (names, prices and
  //    categories taken from woodhouseherbals.com). Prices are in paise.
  //    Stock levels and publish states are deliberately varied so the admin
  //    products list demonstrates every status badge (Published / Draft /
  //    Archived) and every stock bucket (In stock / Low / Out).
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
    stockQty: number;
    status: ProductStatus;
    // Soft-deleted == "Archived" in the admin UI.
    archived?: boolean;
    thumbnailUrl: string;
    // PDP gallery images. Optional: only seeds that own their gallery set it;
    // products without it keep whatever gallery the admin uploaded (the seed
    // must not clobber admin-managed images on re-run).
    gallery?: { url: string; alt: string }[];
    skinTypes: SkinType[];
    concernSlugs: string[];
    badges: { label: string; tone: BadgeTone }[];
    ingredients: { name: string; benefit: string }[];
    benefits: string[];
    howToUse: string[];
  };

  const productSeeds: ProductSeed[] = [
    {
      slug: 'vitamin-c-hyaluronic-face-wash',
      sku: 'WHH-FW-VCH100',
      name: 'Vitamin-C Hyaluronic Face Wash',
      short: 'Brightening daily cleanser with Vitamin C & hyaluronic acid.',
      long: 'A gentle daily cleanser that brightens, hydrates and lifts away dirt and pollution without stripping the skin barrier.',
      category: ProductCategory.FACE_WASH,
      size: '100 ml',
      isCombo: false,
      priceMinor: 19900,
      compareAtPriceMinor: 29500,
      rating: 4.7,
      reviewCount: 1284,
      stockQty: 120,
      status: ProductStatus.PUBLISHED,
      thumbnailUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.ALL],
      concernSlugs: ['dullness', 'pigmentation'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Vitamin C', benefit: 'Brightens & evens tone' },
        { name: 'Hyaluronic Acid', benefit: 'Hydrates & plumps' },
      ],
      benefits: ['Visible glow in 2 weeks', 'Paraben & sulphate free', 'Daily use'],
      howToUse: ['Wet face with lukewarm water', 'Lather a pea-sized amount', 'Massage 30 seconds, rinse'],
    },
    {
      slug: 'niacinamide-face-wash',
      sku: 'WHH-FW-NIA100',
      name: 'Niacinamide Face Wash',
      short: 'Oil-balancing niacinamide cleanser for clear, even skin.',
      long: 'A lightweight foaming cleanser with niacinamide that controls excess oil and fades the look of dark spots over time.',
      category: ProductCategory.FACE_WASH,
      size: '100 ml',
      isCombo: false,
      priceMinor: 12000,
      compareAtPriceMinor: 14500,
      rating: 4.5,
      reviewCount: 742,
      stockQty: 4,
      status: ProductStatus.PUBLISHED,
      // Real client packshots (Cloudinary, July 2026 asset drop). f_auto,q_auto
      // + c_limit,w_1600 baked in so every consumer gets optimized delivery.
      thumbnailUrl: 'https://res.cloudinary.com/j5gjlpct/image/upload/f_auto,q_auto,c_limit,w_1600/v1783716785/woodhouse/products/niacinamide-face-wash/1',
      gallery: [
        { url: 'https://res.cloudinary.com/j5gjlpct/image/upload/f_auto,q_auto,c_limit,w_1600/v1783716785/woodhouse/products/niacinamide-face-wash/1', alt: 'Neem Face Wash tube, front' },
        { url: 'https://res.cloudinary.com/j5gjlpct/image/upload/f_auto,q_auto,c_limit,w_1600/v1783716788/woodhouse/products/niacinamide-face-wash/2', alt: 'Neem Face Wash tube with neem leaves and texture smear' },
      ],
      skinTypes: [SkinType.OILY, SkinType.COMBINATION],
      concernSlugs: ['acne', 'pigmentation'],
      badges: [{ label: 'Value', tone: BadgeTone.SALE }],
      ingredients: [
        { name: 'Niacinamide', benefit: 'Controls oil & fades spots' },
        { name: 'Aloe Vera', benefit: 'Soothes & softens' },
      ],
      benefits: ['Controls shine', 'Evens skin tone', 'Non-drying'],
      howToUse: ['Wet face', 'Lather and massage', 'Rinse thoroughly'],
    },
    {
      slug: 'salicylic-exfoliating-face-wash',
      sku: 'WHH-FW-SAL100',
      name: 'Salicylic Exfoliating Face Wash',
      short: 'Salicylic acid cleanser that clears pores and breakouts.',
      long: 'A clarifying cleanser with salicylic acid that gently exfoliates inside the pores to clear and prevent breakouts.',
      category: ProductCategory.FACE_WASH,
      size: '100 ml',
      isCombo: false,
      priceMinor: 22400,
      compareAtPriceMinor: 29900,
      rating: 4.6,
      reviewCount: 942,
      stockQty: 0,
      status: ProductStatus.PUBLISHED,
      thumbnailUrl: 'https://images.unsplash.com/photo-1631730486572-226d1f595b68?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.OILY, SkinType.COMBINATION],
      concernSlugs: ['acne'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Salicylic Acid', benefit: 'Unclogs pores' },
        { name: 'Neem', benefit: 'Anti-bacterial' },
      ],
      benefits: ['Clears active acne', 'Refines pores'],
      howToUse: ['Wet face', 'Apply 2-3 drops, lather', 'Avoid eyes, rinse'],
    },
    {
      slug: 'vitamin-c-niacinamide-serum',
      sku: 'WHH-SR-VCN30',
      name: 'Vitamin-C Niacinamide Face Serum',
      short: 'Brightening serum with Vitamin C + niacinamide for glow.',
      long: 'A featherlight serum pairing stabilised Vitamin C with niacinamide to brighten, fade pigmentation and boost radiance.',
      category: ProductCategory.SERUM,
      size: '30 ml',
      isCombo: false,
      priceMinor: 24400,
      compareAtPriceMinor: 34900,
      rating: 4.7,
      reviewCount: 821,
      stockQty: 62,
      status: ProductStatus.PUBLISHED,
      // Real client packshot (Cloudinary, July 2026 asset drop) — see note on
      // the niacinamide-face-wash record.
      thumbnailUrl: 'https://res.cloudinary.com/j5gjlpct/image/upload/f_auto,q_auto,c_limit,w_1600/v1783716780/woodhouse/products/vitamin-c-niacinamide-serum/1',
      gallery: [
        { url: 'https://res.cloudinary.com/j5gjlpct/image/upload/f_auto,q_auto,c_limit,w_1600/v1783716780/woodhouse/products/vitamin-c-niacinamide-serum/1', alt: 'Vitamin-C Niacinamide Face Serum dropper bottle with orange and ginger' },
      ],
      skinTypes: [SkinType.ALL],
      concernSlugs: ['pigmentation', 'dullness', 'aging'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Vitamin C', benefit: 'Brightens & evens tone' },
        { name: 'Niacinamide', benefit: 'Fades pigmentation' },
      ],
      benefits: ['Reduces pigmentation', 'Boosts radiance'],
      howToUse: ['Apply 3-4 drops after cleansing', 'Use morning with SPF'],
    },
    {
      slug: 'glow-booster-dtan-scrub',
      sku: 'WHH-SC-GBD100',
      name: 'Glow Booster D-Tan Face Scrub',
      short: 'Walnut & coffee scrub that lifts tan and dead skin.',
      long: 'A buffing scrub with walnut and coffee that removes tan, unclogs pores and reveals brighter, smoother skin.',
      category: ProductCategory.SCRUB,
      size: '100 g',
      isCombo: false,
      priceMinor: 16900,
      compareAtPriceMinor: 24500,
      rating: 4.6,
      reviewCount: 512,
      stockQty: 88,
      status: ProductStatus.PUBLISHED,
      thumbnailUrl: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.ALL],
      concernSlugs: ['tan', 'dullness'],
      badges: [{ label: 'New', tone: BadgeTone.NEW }],
      ingredients: [
        { name: 'Walnut', benefit: 'Exfoliates gently' },
        { name: 'Coffee', benefit: 'De-tans & energises' },
      ],
      benefits: ['Removes tan', 'Smooths texture'],
      howToUse: ['Apply to damp skin', 'Scrub in circles 1 min', 'Rinse — use 2x a week'],
    },
    {
      slug: 'hyaluronic-probiotic-face-cream',
      sku: 'WHH-CR-HAP50',
      name: 'Hyaluronic & Probiotic Face Cream',
      short: 'Barrier-repair moisturiser with hyaluronic acid & probiotics.',
      long: 'A rich yet non-greasy cream with hyaluronic acid and probiotics that deeply hydrates and strengthens the skin barrier.',
      category: ProductCategory.CREAM,
      size: '50 g',
      isCombo: false,
      priceMinor: 27500,
      compareAtPriceMinor: 39500,
      rating: 4.8,
      reviewCount: 388,
      stockQty: 45,
      status: ProductStatus.PUBLISHED,
      thumbnailUrl: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.DRY, SkinType.NORMAL, SkinType.SENSITIVE],
      concernSlugs: ['dry-skin', 'aging'],
      badges: [{ label: 'Bestseller', tone: BadgeTone.BESTSELLER }],
      ingredients: [
        { name: 'Hyaluronic Acid', benefit: 'Deep hydration' },
        { name: 'Probiotics', benefit: 'Strengthens barrier' },
      ],
      benefits: ['48-hour hydration', 'Repairs barrier'],
      howToUse: ['Apply to cleansed skin morning & night'],
    },
    {
      slug: 'green-tea-night-gel',
      sku: 'WHH-CR-GTN15',
      name: 'Green Tea Night Gel',
      short: 'Overnight soothing gel with green tea & antioxidants.',
      long: 'A lightweight overnight gel with green tea that calms, hydrates and refreshes tired, dull skin while you sleep.',
      category: ProductCategory.CREAM,
      size: '15 g',
      isCombo: false,
      priceMinor: 13500,
      compareAtPriceMinor: 19500,
      rating: 4.4,
      reviewCount: 96,
      stockQty: 30,
      // Not launched yet — kept as a Draft so it stays out of the storefront.
      status: ProductStatus.DRAFT,
      thumbnailUrl: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.OILY, SkinType.COMBINATION],
      concernSlugs: ['acne', 'dullness'],
      badges: [{ label: 'New', tone: BadgeTone.NEW }],
      ingredients: [
        { name: 'Green Tea', benefit: 'Soothes & calms' },
        { name: 'Niacinamide', benefit: 'Refines skin' },
      ],
      benefits: ['Calms overnight', 'Oil-free hydration'],
      howToUse: ['Apply a thin layer at night on cleansed skin'],
    },
    {
      slug: 'anti-acne-glow-booster-combo',
      sku: 'WHH-CB-AAGB',
      name: 'Anti-Acne & Glow Booster Combo',
      short: 'Complete anti-acne + glow ritual — face wash, serum & scrub.',
      long: 'Our most-loved multi-step kit for breakout-prone skin: cleanse, treat and glow.',
      category: ProductCategory.COMBO,
      size: '3-piece kit',
      isCombo: true,
      priceMinor: 94800,
      compareAtPriceMinor: 143800,
      rating: 4.8,
      reviewCount: 256,
      stockQty: 0,
      // Discontinued this season — archived (soft-deleted) so it drops off the
      // storefront while its order history stays intact.
      status: ProductStatus.PUBLISHED,
      archived: true,
      thumbnailUrl: 'https://images.unsplash.com/photo-1556228453-efd6c1ff04f6?w=900&q=80&auto=format&fit=crop',
      skinTypes: [SkinType.OILY, SkinType.COMBINATION],
      concernSlugs: ['acne'],
      badges: [{ label: 'Combo Saver', tone: BadgeTone.SALE }],
      ingredients: [{ name: 'Salicylic Acid', benefit: 'Clears pores' }],
      benefits: ['Save ₹490', 'Complete 3-step ritual'],
      howToUse: ['Cleanse → treat → glow'],
    },
  ];

  for (const seed of productSeeds) {
    const stockStatus = seed.stockQty > 0 ? StockStatus.IN_STOCK : StockStatus.OUT_OF_STOCK;
    const deletedAt = seed.archived ? new Date() : null;
    // Authoritative on the demo-relevant fields so re-running the seed always
    // reproduces the intended stock levels / statuses even for rows that
    // already exist. Editorial relations (badges/ingredients/concerns) are
    // reset below.
    const writable = {
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
      stockQty: seed.stockQty,
      inStock: seed.stockQty > 0,
      stockStatus,
      status: seed.status,
      thumbnailUrl: seed.thumbnailUrl,
      thumbnailAlt: seed.name,
      benefits: seed.benefits,
      howToUse: seed.howToUse,
      skinTypes: seed.skinTypes,
      deletedAt,
    };

    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      create: { slug: seed.slug, ...writable },
      update: writable,
    });

    // Reset relations to keep the seed idempotent
    await prisma.productBadge.deleteMany({ where: { productId: product.id } });
    await prisma.ingredient.deleteMany({ where: { productId: product.id } });
    await prisma.productConcern.deleteMany({ where: { productId: product.id } });

    // Gallery reset is scoped to seeds that declare one — a blanket delete
    // would clobber admin-uploaded galleries on every other product.
    if (seed.gallery) {
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      await prisma.productImage.createMany({
        data: seed.gallery.map((g, idx) => ({ productId: product.id, url: g.url, alt: g.alt, sortOrder: idx })),
      });
    }

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

  console.log(`✅ Seed completed — ${productSeeds.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
