import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { env } from '@/lib/env';
import type { ProductDetailResponse } from '@/types/api';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductBuyBox } from '@/components/product/ProductBuyBox';
import { ProductDetails } from '@/components/product/ProductDetails';
import { ProductReviews } from '@/components/product/ProductReviews';
import { Recommended } from '@/components/product/Recommended';

// Render live per request so a just-published or just-edited SKU (price, stock,
// gallery) is always correct — no statically generated, stale PDP, and no mock
// fallback that could surface a phantom product a customer can add to cart.
export const dynamic = 'force-dynamic';

interface Props {
  params: { slug: string };
}

/**
 * Fetch the live product detail from the backend, server-side. The endpoint is
 * `@Public` (no cookie needed), so a plain uncached fetch is enough. Returns
 * null on 404 (caller renders `notFound()`); throws on any other failure so the
 * route's error boundary shows an honest error — never a fabricated product.
 */
async function fetchProductDetail(slug: string): Promise<ProductDetailResponse | null> {
  const res = await fetch(`${env.apiUrl}/api/products/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    // Bound the request: a hanging backend must not hang the render — and, at
    // `next build`, generateMetadata evaluates this once, so an unbounded fetch
    // to a slow/unreachable API URL would break the production image build.
    signal: AbortSignal.timeout(8000),
  });
  // A syntactically invalid slug (uppercase, underscore, space, leading/trailing
  // hyphen, >82 chars) is rejected by the backend's SLUG_RE with a 400 BEFORE
  // the lookup — it can never be a real product, so treat it as not-found (a
  // branded 404), not as a 500. See products.controller.ts.
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Failed to load product "${slug}" (${res.status})`);
  return (await res.json()) as ProductDetailResponse;
}

export async function generateMetadata({ params }: Props) {
  // Tolerant of failures — metadata must never crash the render; the page fetch
  // below is the source of truth for not-found / error handling.
  let data: ProductDetailResponse | null = null;
  try {
    data = await fetchProductDetail(params.slug);
  } catch {
    return { title: 'Wood House Herbals' };
  }
  if (!data) return { title: 'Product not found' };
  const { product } = data;
  return {
    title: product.name,
    description: product.shortDescription,
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: [product.thumbnail.url],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const data = await fetchProductDetail(params.slug);
  if (!data) notFound();
  const { product, recommended } = data;

  return (
    <article className="container-wide pt-6 pb-20">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-ink-muted">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-brand-700">
          <Home className="h-3 w-3" /> Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/shop" className="hover:text-brand-700">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-navy-900 font-semibold truncate">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
        <ProductGallery images={product.gallery} />
        <ProductBuyBox product={product} />
      </div>

      <ProductDetails product={product} />
      <ProductReviews product={product} />
      <Recommended items={recommended} />
    </article>
  );
}
