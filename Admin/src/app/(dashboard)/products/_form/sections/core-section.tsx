'use client';

import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Check, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { slugify } from '@/lib/slugify';
import { STATUS_LABELS } from '@/lib/product-meta';
import { useSlugCheck } from '@/hooks/use-slug-check';
import { useProductFormMeta } from '../product-form-context';
import { FormSection } from '../form-section';
import { PRODUCT_STATUS_VALUES, type ProductFormValues } from '../product-form-schema';

function SlugField({ onManualEdit }: { onManualEdit: () => void }) {
  const form = useFormContext<ProductFormValues>();
  const slug = form.watch('slug');
  const { productId } = useProductFormMeta();
  const { status } = useSlugCheck(slug, productId);

  return (
    <FormField
      control={form.control}
      name="slug"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Slug</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                placeholder="vitamin-c-brightening-face-wash"
                className="pr-9 font-mono text-xs"
                onChange={(e) => {
                  onManualEdit();
                  field.onChange(e.target.value);
                }}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {status === 'checking' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : status === 'available' ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : status === 'taken' ? (
                  <X className="h-4 w-4 text-destructive" />
                ) : null}
              </span>
            </div>
          </FormControl>
          <div className="flex items-center justify-between gap-2">
            <FormDescription>
              The product URL. Auto-filled from the name — edit to override.
            </FormDescription>
            {status === 'available' ? (
              <span className="shrink-0 text-xs text-emerald-600">Available</span>
            ) : status === 'taken' ? (
              <span className="shrink-0 text-xs text-destructive">Already in use</span>
            ) : null}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ToggleField({
  name,
  label,
  description,
}: {
  name: 'featured' | 'bestSeller';
  label: string;
  description: string;
}) {
  const form = useFormContext<ProductFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center justify-between space-y-0 rounded-md border p-3">
          <div className="space-y-0.5 pr-4">
            <FormLabel className="text-sm">{label}</FormLabel>
            <FormDescription>{description}</FormDescription>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function CoreSection() {
  const form = useFormContext<ProductFormValues>();
  const [slugEdited, setSlugEdited] = useState(false);
  const name = form.watch('name');
  const status = form.watch('status');

  // Auto-derive the slug from the name until the user edits the slug directly.
  // shouldValidate keeps a previously-shown "Slug is required" error from
  // lingering once the name (and thus the slug) is filled in.
  useEffect(() => {
    if (slugEdited) return;
    const auto = slugify(name);
    if (auto !== form.getValues('slug')) {
      form.setValue('slug', auto, { shouldValidate: true, shouldDirty: true });
    }
  }, [name, slugEdited, form]);

  return (
    <FormSection id="core" title="Core details" description="The essentials every product needs.">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>Product name</FormLabel>
              <FormControl>
                <Input placeholder="Vitamin-C Brightening Face Wash" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="sm:col-span-2">
          <SlugField onManualEdit={() => setSlugEdited(true)} />
        </div>

        <FormField
          control={form.control}
          name="sku"
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>SKU</FormLabel>
              <FormControl>
                <Input placeholder="WHH-FW-VCH100" className="font-mono text-xs" {...field} />
              </FormControl>
              <FormDescription>Stock-keeping unit. Must be unique across the catalog.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="shortDescription"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Short description</FormLabel>
            <RichTextEditor
              plainText
              limit={200}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="One or two lines shown on cards and listings…"
              invalid={!!fieldState.error}
              ariaLabel="Short description"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="longDescription"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>Full description</FormLabel>
            <RichTextEditor
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Tell the full story — ingredients, results, how it feels…"
              invalid={!!fieldState.error}
              ariaLabel="Full description"
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  // The "main image required" rule (on the images field) is
                  // driven by status; re-validate images so a stale error clears
                  // when switching to DRAFT (and shows when switching to publish).
                  void form.trigger('images');
                }}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRODUCT_STATUS_VALUES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Drafts and scheduled products stay off the storefront.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {status === 'SCHEDULED' ? (
          <FormField
            control={form.control}
            name="publishAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Publish at</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormDescription>Goes live automatically at this time.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleField
          name="featured"
          label="Featured"
          description="Surface this product in featured slots."
        />
        <ToggleField
          name="bestSeller"
          label="Best-seller"
          description="Adds a “Bestseller” badge on the storefront."
        />
      </div>
    </FormSection>
  );
}
