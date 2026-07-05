'use client';

import { PageHeader } from '@/components/common/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminUser } from '@/hooks/use-admin-auth';
import { BannersTab } from './_tabs/banners-tab';
import { OfferStripTab } from './_tabs/offer-strip-tab';
import { TestimonialsTab } from './_tabs/testimonials-tab';
import { FaqsTab } from './_tabs/faqs-tab';
import { PagesTab } from './_tabs/pages-tab';
import { HomepageSectionsTab } from './_tabs/homepage-sections-tab';

export default function ContentPage() {
  const admin = useAdminUser();
  const canManage = admin.data?.role === 'ADMIN' || admin.data?.role === 'MANAGER';

  return (
    <div>
      <PageHeader title="Content" description="Homepage banners, sections, and store pages." />
      {!canManage ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Content management is available to administrators and managers only.
        </div>
      ) : (
        <Tabs defaultValue="banners">
          <TabsList className="flex-wrap">
            <TabsTrigger value="banners">Banners</TabsTrigger>
            <TabsTrigger value="offer-strip">Offer strip</TabsTrigger>
            <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
            <TabsTrigger value="faqs">FAQs</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="homepage">Homepage sections</TabsTrigger>
          </TabsList>
          <TabsContent value="banners"><BannersTab /></TabsContent>
          <TabsContent value="offer-strip"><OfferStripTab /></TabsContent>
          <TabsContent value="testimonials"><TestimonialsTab /></TabsContent>
          <TabsContent value="faqs"><FaqsTab /></TabsContent>
          <TabsContent value="pages"><PagesTab /></TabsContent>
          <TabsContent value="homepage"><HomepageSectionsTab /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
