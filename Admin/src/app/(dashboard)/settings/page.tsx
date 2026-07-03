import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Store details, payments, integrations, and staff." />
      <EmptyState
        icon={Settings}
        title="Settings arrive in a later phase"
        description="Store info, payment configuration, integrations, and user roles will be managed here."
      />
    </div>
  );
}
