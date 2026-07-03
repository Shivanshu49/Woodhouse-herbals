import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export default function ProductsPage() {
  return (
    <div>
      <PageHeader
        title="Products"
        description="Your catalog — herbal skincare, combos, and everything you sell."
        action={
          <Button asChild>
            <Link href="/products/new">
              <Plus className="h-4 w-4" />
              Add product
            </Link>
          </Button>
        }
      />
      <EmptyState
        icon={Package}
        title="No products yet"
        description="Add your first product to start building the catalog. The full product editor lands in a later phase."
        action={
          <Button asChild>
            <Link href="/products/new">
              <Plus className="h-4 w-4" />
              Add product
            </Link>
          </Button>
        }
      />
    </div>
  );
}
