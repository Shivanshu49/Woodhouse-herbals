import { Truck } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function ShippingPage() {
  return (
    <div>
      <PageHeader title="Shipping" description="Zones, rates, and delivery estimates." />
      <EmptyState
        icon={Truck}
        title="No shipping rules yet"
        description="Set up shipping zones, rates, and a free-shipping threshold. Shipping settings arrive in a later phase."
      />
    </div>
  );
}
