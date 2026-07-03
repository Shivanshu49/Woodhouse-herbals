import { Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function MarketingPage() {
  return (
    <div>
      <PageHeader title="Marketing" description="Email, SMS, and WhatsApp campaigns." />
      <EmptyState
        icon={Megaphone}
        title="No campaigns yet"
        description="Reach customers with campaigns and recover abandoned carts. Marketing tools arrive in a later phase."
      />
    </div>
  );
}
