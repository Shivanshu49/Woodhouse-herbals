'use client';

import { PageHeader } from '@/components/common/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminUser } from '@/hooks/use-admin-auth';
import { StoreProfileTab } from './_tabs/store-profile-tab';
import { UsersTab } from './_tabs/users-tab';
import { IntegrationsTab } from './_tabs/integrations-tab';

export default function SettingsPage() {
  const admin = useAdminUser();
  const isAdmin = admin.data?.role === 'ADMIN';

  return (
    <div>
      <PageHeader title="Settings" description="Store profile, staff & roles, and integrations." />
      {!isAdmin ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Settings are available to administrators only.
        </div>
      ) : (
        <Tabs defaultValue="store">
          <TabsList>
            <TabsTrigger value="store">Store profile</TabsTrigger>
            <TabsTrigger value="users">Users &amp; roles</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
          </TabsList>
          <TabsContent value="store">
            <StoreProfileTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="integrations">
            <IntegrationsTab />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
