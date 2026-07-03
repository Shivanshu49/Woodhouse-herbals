import { FolderTree } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function CategoriesPage() {
  return (
    <div>
      <PageHeader title="Categories" description="Organize your catalog into shoppable groups." />
      <EmptyState
        icon={FolderTree}
        title="No categories yet"
        description="Group products into categories like Face Wash, Serum, or Scrub. Category management arrives in a later phase."
      />
    </div>
  );
}
