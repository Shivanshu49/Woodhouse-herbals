import Image from 'next/image';
import Link from 'next/link';
import { STORE_CATEGORIES } from '@/data/categories';
import { products } from '@/data/products';

/**
 * Circular category bar — sits directly under the navbar, mirroring the
 * category row the original woodhouseherbals.com storefront opened with.
 * Mobile: snap-scrolling strip of ~68px circles; desktop: centered row.
 */

// Circle thumbs come from the live catalog (first product of each category) so
// they track real product photography as placeholder shots get replaced.
// "Shop All" leads the row — a nav shortcut to the unfiltered shop, not a
// catalog category, so it carries its own art instead of joining STORE_CATEGORIES.
interface Circle {
  label: string;
  slug: string;
  image: string;
  href: string;
  comingSoon?: boolean;
}

const CIRCLES: Circle[] = [
  { label: 'Shop All', slug: 'shop-all', image: '/categories/shop-all.png', href: '/shop' },
  ...STORE_CATEGORIES.flatMap(({ label, slug, comingSoon }) => {
    const p = products.find((prod) => prod.category === slug);
    return p ? [{ label, slug, image: p.thumbnail.url, href: `/shop?category=${slug}`, comingSoon }] : [];
  }),
];

export function CategoryBar() {
  return (
    <section aria-label="Shop by category" className="border-b border-navy-900/5 bg-white/70">
      {/* justify-center only from lg — at md the circle row can overflow, and a
          centered overflowing flex row clips its start items unreachably. */}
      <ul className="container-wide flex gap-4 sm:gap-6 lg:justify-center md:gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory py-3 sm:py-4">
        {CIRCLES.map((c) => (
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
