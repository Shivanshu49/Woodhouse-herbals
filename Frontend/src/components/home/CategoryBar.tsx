'use client';

import Image from 'next/image';
import Link from 'next/link';
import { STORE_CATEGORIES } from '@/data/categories';
import { useCatalog } from '@/hooks/use-catalog';

/**
 * Circular category bar — sits directly under the navbar, mirroring the
 * category row the original woodhouseherbals.com storefront opened with.
 * Mobile: snap-scrolling strip of ~68px circles; desktop: centered row.
 */

// Circle thumbs come from the live catalog (first product of each category) so
// they track real product photography as placeholder shots get replaced; a
// category can pin its own art via `image` when the first product misleads
// (combo shows the gift box, not one member product).
// "Shop All" leads the row — a nav shortcut to the unfiltered shop, not a
// catalog category, so it carries its own art instead of joining STORE_CATEGORIES.
interface Circle {
  label: string;
  slug: string;
  image: string;
  href: string;
  comingSoon?: boolean;
}

const SHOP_ALL: Circle = {
  label: 'Shop All',
  slug: 'shop-all',
  image: '/categories/shop-all.png',
  href: '/shop',
};

export function CategoryBar() {
  const { products } = useCatalog();

  // A category renders once it has art — its own pinned `image` or, failing
  // that, the first live product's thumbnail. Product-derived circles fill in
  // as the catalog loads (categories with pinned art show immediately).
  const circles: Circle[] = [
    SHOP_ALL,
    ...STORE_CATEGORIES.flatMap(({ label, slug, image, comingSoon }) => {
      const art = image ?? products.find((p) => p.category === slug)?.thumbnail.url;
      return art ? [{ label, slug, image: art, href: `/shop?category=${slug}`, comingSoon }] : [];
    }),
  ];

  return (
    <section aria-label="Shop by category" className="border-b border-navy-900/5 bg-white/70">
      {/* `safe center` centers the row but falls back to start alignment the
          moment it would overflow — so a centered row can never clip its start
          items unreachably (the hazard that previously kept centering off below
          lg, leaving the md band's circles pinned left against dead space).
          This also keeps the 7th "coming soon" circle reachable when a hair-oil
          product publishes and the row outgrows the container. */}
      <ul className="container-wide flex gap-4 sm:gap-6 md:gap-8 md:[justify-content:safe_center] lg:gap-12 xl:gap-16 overflow-x-auto no-scrollbar snap-x snap-mandatory py-3 sm:py-4 lg:py-6">
        {circles.map((c) => (
          <li key={c.slug} className="snap-start shrink-0">
            <Link
              href={c.href}
              className="group flex w-[72px] md:w-20 lg:w-28 xl:w-36 flex-col items-center gap-1.5 lg:gap-2.5"
            >
              {/* Desktop steps are sized to the container, not picked freehand:
                  container-wide is max-w-7xl + lg:px-10, so content is 944px at
                  1024 and caps at 1200px from 1280 up. 7 circles + 6 gaps must
                  clear those — 112+48 fills 912/944 at lg, 144+64 fills 1184/1200
                  at xl. Going bigger at lg would force the gaps back below their
                  md value, which is the cramping this sizing exists to fix. */}
              <span className="relative block h-[68px] w-[68px] md:h-20 md:w-20 lg:h-28 lg:w-28 xl:h-36 xl:w-36 overflow-hidden rounded-full ring-1 ring-navy-900/10 shadow-soft transition-all duration-200 group-hover:ring-2 group-hover:ring-brand-500 group-hover:shadow-lift">
                {/* Decorative — the visible label names the link; a product-specific
                    alt would misdescribe the whole-category destination. */}
                {/* eager: the bar is the first thing in the viewport — lazy
                    would deprioritize thumbs the user is already looking at. */}
                {/* `sizes` must track the h-/w- steps above — a stale 80px hint
                    makes Next serve an 80px-wide source into the 144px xl
                    circle, which upscales visibly on photographic thumbs. */}
                <Image
                  src={c.image}
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 144px, (min-width: 1024px) 112px, 80px"
                  loading="eager"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {c.comingSoon && (
                  <span className="absolute inset-x-1 bottom-1.5 lg:bottom-2.5 rounded-full bg-navy-900/85 px-1 py-0.5 lg:py-1 text-center text-[8px] md:text-[9px] lg:text-[10px] xl:text-[11px] font-semibold leading-none text-cream">
                    Coming soon
                  </span>
                )}
              </span>
              <span className="text-center text-[11px] md:text-xs lg:text-[13px] xl:text-sm font-semibold leading-tight text-navy-900 group-hover:text-brand-700">
                {c.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
