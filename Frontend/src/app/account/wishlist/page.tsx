'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { AccountShell } from '@/components/account/AccountShell';
import { ProductCard } from '@/components/product/ProductCard';
import { Button } from '@/components/ui/Button';
import { useWishlistStore } from '@/store/wishlist';
import { useCatalog } from '@/hooks/use-catalog';

function WishlistGrid() {
  // Zustand persist hydrates from localStorage after mount — gate on it to
  // avoid a server/client hydration mismatch.
  const ids = useWishlistStore((s) => s.ids);
  const { products, isLoading, isError } = useCatalog();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || isLoading) return <div className="h-40 rounded-3xl bg-navy-900/5 animate-pulse" />;

  if (isError) {
    return (
      <div className="rounded-3xl bg-white border border-navy-900/8 p-10 text-center">
        <p className="font-inter text-[15px] text-ink-muted">
          We couldn&apos;t load your saved items right now. Please refresh in a moment.
        </p>
      </div>
    );
  }

  // Saved wishlist ids are live DB product ids; look them up in the live catalog.
  const items = products.filter((p) => ids.includes(p.id));

  if (items.length === 0) {
    return (
      <div className="rounded-3xl bg-white border border-navy-900/8 p-10 text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-blush-100 text-blush-600">
          <Heart className="h-7 w-7" />
        </span>
        <p className="mt-4 font-inter text-[15px] text-ink-muted">
          Nothing saved yet. Tap the heart on any product to keep it here.
        </p>
        <Link href="/shop">
          <Button className="mt-6">Browse the shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

export default function WishlistPage() {
  return <AccountShell title="wishlist.">{() => <WishlistGrid />}</AccountShell>;
}
