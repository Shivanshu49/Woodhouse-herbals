import { TicketPercent } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function CouponsPage() {
  return (
    <div>
      <PageHeader title="Coupons & discounts" description="Run promotions and reward loyal shoppers." />
      <EmptyState
        icon={TicketPercent}
        title="No coupons yet"
        description="Create percentage, fixed-amount, or free-shipping codes. Coupon management arrives in a later phase."
      />
    </div>
  );
}
