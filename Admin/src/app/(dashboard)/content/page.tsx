import { LayoutTemplate } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function ContentPage() {
  return (
    <div>
      <PageHeader title="Content" description="Homepage banners, sections, and store pages." />
      <EmptyState
        icon={LayoutTemplate}
        title="Nothing to edit yet"
        description="Manage hero banners, the offer strip, testimonials, and policy pages here. Content tools arrive in a later phase."
      />
    </div>
  );
}
