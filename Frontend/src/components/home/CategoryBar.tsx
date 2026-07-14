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
      {/* justify-center only from lg — at md the circle row can overflow, and a
          centered overflowing flex row clips its start items unreachably. */}
      <ul className="container-wide flex gap-4 sm:gap-6 lg:justify-center md:gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory py-3 sm:py-4">
        {circles.map((c) => (
          <li key={c.slug} className="snap-start shrink-0">
            <Link
              href={c.href}
              className="group flex w-[72px] md:w-20 flex-col items-center gap-1.5"
            >
              <span className="relative block h-[68px] w-[68px] md:h-20 md:w-20 overflow-hidden rounded-full ring-1 ring-navy-900/10 shadow-soft transition-all duration-200 group-hover:ring-2 group-hover:ring-brand-500 group-hover:shadow-lift">
                {/* Decorative — the visible label names the link; a product-specific
                    alt would misdescribe the whole-category destination. */}
                {/* eager: the bar is the first thing in the viewport — lazy
                    would deprioritize thumbs the user is already looking at. */}
                <Image
                  src={c.image}
                  alt=""
                  fill
                  sizes="80px"
                  loading="eager"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {c.comingSoon && (
                  <span className="absolute inset-x-1 bottom-1.5 rounded-full bg-navy-900/85 px-1 py-0.5 text-center text-[8px] md:text-[9px] font-semibold leading-none text-cream">
                    Coming soon
                  </span>
                )}
              </span>
              <span className="text-center text-[11px] md:text-xs font-semibold leading-tight text-navy-900 group-hover:text-brand-700">
                {c.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
