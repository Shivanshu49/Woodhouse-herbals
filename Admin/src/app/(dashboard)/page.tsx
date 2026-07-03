import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Your store at a glance." />
      <EmptyState
        icon={LayoutDashboard}
        title="Metrics arrive with your first orders"
        description="Sales, orders, low-stock alerts, and top products will appear here once the store is live. This section is built in the next phase."
      />
    </div>
  );
}
