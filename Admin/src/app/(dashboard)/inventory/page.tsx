import { Boxes } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function InventoryPage() {
  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels and low-stock alerts across your catalog." />
      <EmptyState
        icon={Boxes}
        title="Nothing to track yet"
        description="Once you add products, their stock levels and movement history show up here."
      />
    </div>
  );
}
