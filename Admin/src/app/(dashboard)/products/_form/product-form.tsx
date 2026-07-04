'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { useUnsavedChangesWarning } from '@/hooks/use-unsaved-changes-warning';
import { UploadStatusContext } from './upload-status';
import { ProductFormMetaContext } from './product-form-context';
import {
  DEFAULT_PRODUCT_FORM_VALUES,
  productFormSchema,
  type ProductFormValues,
} from './product-form-schema';
import { CoreSection } from './sections/core-section';
import { MediaSection } from './sections/media-section';
import { PricingSection } from './sections/pricing-section';
import { InventorySection } from './sections/inventory-section';
import { OrganizationSection } from './sections/organization-section';
import { IngredientsSection } from './sections/ingredients-section';

/** Sections rendered so far — grows one group at a time; drives the side-nav. */
const SECTIONS = [
  { id: 'core', label: 'Core details' },
  { id: 'media', label: 'Media' },
  { id: 'pricing', label: 'Pricing & tax' },
  { id: 'inventory', label: 'Inventory & shipping' },
  { id: 'organization', label: 'Organization' },
  { id: 'ingredients', label: 'Ingredients & usage' },
] as const;

export interface ProductFormProps {
  mode: 'create' | 'edit';
  productId?: string;
  defaultValues?: ProductFormValues;
  submitting?: boolean;
  onSubmit: (values: ProductFormValues, opts: { asDraft: boolean }) => void | Promise<void>;
}

export function ProductForm({
  mode,
  productId,
  defaultValues = DEFAULT_PRODUCT_FORM_VALUES,
  submitting = false,
  onSubmit,
}: ProductFormProps) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: 'onBlur',
  });

  const status = form.watch('status');
  const dirty = form.formState.isDirty;
  const [pendingUploads, setPendingUploads] = useState(0);
  const busy = submitting || pendingUploads > 0;
  useUnsavedChangesWarning(dirty && !submitting);

  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px' },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const primaryLabel =
    status === 'PUBLISHED' ? 'Publish' : status === 'SCHEDULED' ? 'Schedule' : 'Save draft';

  // Never submit while images are still uploading — a still-uploading image is
  // not yet in `images`, so it would be silently dropped from what gets saved.
  const guardPending = (): boolean => {
    if (pendingUploads > 0) {
      toast.error('Please wait for image uploads to finish.');
      return true;
    }
    return false;
  };

  // A failed submit must never be silent — some fields (tags, badges) are managed
  // manually and can't be auto-focused by RHF, so surface a toast.
  const onInvalid = () => toast.error('Please fix the highlighted fields before saving.');

  const handlePrimary = form.handleSubmit((values) => {
    if (guardPending()) return;
    return onSubmit(values, { asDraft: false });
  }, onInvalid);

  const handleSaveDraft = () => {
    if (guardPending()) return;
    // Saving as a draft forces DRAFT status so scheduled-date validation is
    // not required, and reflects the choice in the Status field.
    form.setValue('status', 'DRAFT', { shouldDirty: true });
    void form.handleSubmit((values) => onSubmit(values, { asDraft: true }), onInvalid)();
  };

  return (
    <Form {...form}>
      <ProductFormMetaContext.Provider value={{ mode, productId }}>
      <UploadStatusContext.Provider value={{ setPendingUploads }}>
      <form onSubmit={handlePrimary} className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/products" aria-label="Back to products">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {mode === 'create' ? 'New product' : 'Edit product'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'create'
                ? 'Add a product to your catalog.'
                : 'Update this product’s details.'}
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[190px_1fr]">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 space-y-1">
              {SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    'block rounded-md px-3 py-1.5 text-sm transition-colors',
                    active === s.id
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 space-y-6 pb-24">
            <CoreSection />
            <MediaSection />
            <PricingSection />
            <InventorySection />
            <OrganizationSection />
            <IngredientsSection />
          </div>
        </div>

        <div className="sticky bottom-4 z-30 mt-4 flex items-center justify-between gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="text-sm text-muted-foreground">
            {pendingUploads > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Uploading {pendingUploads} image{pendingUploads === 1 ? '' : 's'}…
              </span>
            ) : dirty ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </span>
            ) : (
              'No changes yet'
            )}
          </div>
          <div className="flex items-center gap-2">
            {status !== 'DRAFT' ? (
              <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={busy}>
                Save as draft
              </Button>
            ) : null}
            <Button type="submit" disabled={busy}>
              {submitting ? 'Saving…' : primaryLabel}
            </Button>
          </div>
        </div>
      </form>
      </UploadStatusContext.Provider>
      </ProductFormMetaContext.Provider>
    </Form>
  );
}
