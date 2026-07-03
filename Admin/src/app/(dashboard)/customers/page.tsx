import { Users } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function CustomersPage() {
  return (
    <div>
      <PageHeader title="Customers" description="Everyone who shops with Wood House Herbals." />
      <EmptyState
        icon={Users}
        title="No customers yet"
        description="Customer profiles, order history, and segments will appear here as people sign up and buy."
      />
    </div>
  );
}
