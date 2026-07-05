'use client';

import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInr } from '@/lib/money';
import { useHomepageSections } from '@/hooks/use-content';
import type { HomepageSectionProduct } from '@/types/content';

const SECTIONS: Array<{ key: 'bestsellers' | 'newArrivals' | 'comboPacks'; title: string; flag: string }> = [
  { key: 'bestsellers', title: 'Best sellers', flag: 'a “Bestseller” badge' },
  { key: 'newArrivals', title: 'New arrivals', flag: 'a “New” badge' },
  { key: 'comboPacks', title: 'Combo packs', flag: 'the “Combo pack” toggle' },
];

const isLive = (p: HomepageSectionProduct) => p.status === 'PUBLISHED';
const statusLabel = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);

function ProductRow({ p }: { p: HomepageSectionProduct }) {
  return (
    <Link
      href={`/products/${p.id}/edit`}
      className="flex items-center gap-3 rounded-md border p-2 transition-colors hover:bg-muted/50"
    >
      {p.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover" />
      ) : (
        <div className="h-9 w-9 rounded bg-muted" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
      {!isLive(p) && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400">
          Not live · {statusLabel(p.status)}
        </span>
      )}
      <span className="text-sm text-muted-foreground">{formatInr(p.priceMinor)}</span>
    </Link>
  );
}

export function HomepageSectionsTab() {
  const { data, isLoading } = useHomepageSections();

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">
        Homepage product carousels are driven by <strong>product flags</strong>, not a separate list. To add or remove a
        product, open it and toggle the relevant flag. This lists every product carrying each flag; the storefront also
        requires a product to be <strong>Published</strong> and shows only the first few per section, so a row marked
        “Not live” won’t appear on the homepage.
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        SECTIONS.map(({ key, title, flag }) => {
          const items = data?.[key] ?? [];
          const live = items.filter(isLive).length;
          return (
            <section key={key} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">{title}</h3>
                <span className="text-xs text-muted-foreground">
                  {items.length === 0
                    ? '0 products'
                    : live === items.length
                      ? `${items.length} live`
                      : `${live} of ${items.length} live`}
                </span>
              </div>
              {items.length === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  <LayoutGrid className="h-4 w-4" />
                  No products carry {flag} yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((p) => (
                    <ProductRow key={p.id} p={p} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
