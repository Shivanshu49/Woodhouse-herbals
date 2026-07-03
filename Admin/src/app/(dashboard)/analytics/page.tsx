import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader title="Analytics" description="Revenue, best sellers, and customer trends." />
      <EmptyState
        icon={BarChart3}
        title="No data to chart yet"
        description="Once orders start coming in, revenue and product performance appear here."
      />
    </div>
  );
}
