import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { findProductBySlug, productSummaries } from '@/data/products';
import { ProductGallery } from '@/components/product/ProductGallery';
import { ProductBuyBox } from '@/components/product/ProductBuyBox';
import { ProductDetails } from '@/components/product/ProductDetails';
import { ProductReviews } from '@/components/product/ProductReviews';
import { Recommended } from '@/components/product/Recommended';

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return productSummaries.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: Props) {
  const product = findProductBySlug(params.slug);
  if (!product) return { title: 'Product not found' };
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

export default function ProductPage({ params }: Props) {
  const product = findProductBySlug(params.slug);
  if (!product) notFound();

  const recommended = productSummaries
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.concerns.some((c) => product.concerns.includes(c)) || p.category === product.category),
    )
    .slice(0, 4);

  return (
    <article className="container-wide pt-6 pb-20">
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-xs text-ink-muted">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-forest-900">
          <Home className="h-3 w-3" /> Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/shop" className="hover:text-forest-900">Shop</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-forest-900 truncate">{product.name}</span>
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
