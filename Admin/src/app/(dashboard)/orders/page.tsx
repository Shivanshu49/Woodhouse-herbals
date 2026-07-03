import { ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function OrdersPage() {
  return (
    <div>
      <PageHeader title="Orders" description="Track and fulfill customer orders." />
      <EmptyState
        icon={ShoppingCart}
        title="No orders yet"
        description="When customers check out, their orders show up here for you to process, ship, and track."
      />
    </div>
  );
}
