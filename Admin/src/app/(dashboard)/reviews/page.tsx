import { Star } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function ReviewsPage() {
  return (
    <div>
      <PageHeader title="Reviews" description="Moderate and reply to customer reviews." />
      <EmptyState
        icon={Star}
        title="No reviews yet"
        description="Customer reviews will land here for you to approve, reject, or reply to."
      />
    </div>
  );
}
