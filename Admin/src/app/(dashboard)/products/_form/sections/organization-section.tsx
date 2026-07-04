'use client';

import { useState } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/cn';
import { useCategories } from '@/hooks/use-categories';
import { useConcerns } from '@/hooks/use-concerns';
import { FormSection } from '../form-section';
import type { ProductFormValues } from '../product-form-schema';
import {
  BADGE_TONE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  SKIN_TYPE_OPTIONS,
  TAG_MAX_LENGTH,
  addTag,
  type BadgeToneValue,
} from '../organization';

/** A bounded multi-select rendered as toggle chips. */
function ChipMultiSelect({
  options,
  selected,
  onToggle,
  loading,
  error,
  onRetry,
  emptyText,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  emptyText?: string;
}) {
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Couldn’t load these.{' '}
        <button type="button" onClick={onRetry} className="underline underline-offset-2">
          Retry
        </button>
      </p>
    );
  }
  if (options.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText ?? 'Nothing to choose from yet.'}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(o.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function OrganizationSection() {
  const form = useFormContext<ProductFormValues>();
  const categoryIds = form.watch('categoryIds');
  const concernIds = form.watch('concernIds');
  const skinTypes = form.watch('skinTypes');
  const tags = form.watch('tags');
  const badges = form.watch('badges');
  const [tagDraft, setTagDraft] = useState('');
  const { errors } = useFormState({ control: form.control });
  // badges is managed manually (not via Controller), so read its nested leaf
  // errors directly — a bare <FormMessage/> resolves no field name and stays blank.
  const badgeLabelError = (i: number): string | undefined =>
    (errors.badges as { label?: { message?: string } }[] | undefined)?.[i]?.label?.message;

  const categories = useCategories();
  const concerns = useConcerns();

  const DIRTY = { shouldDirty: true, shouldValidate: true } as const;
  const toggle = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const commitTag = () => {
    const next = addTag(tags, tagDraft);
    if (next !== tags) form.setValue('tags', next, DIRTY);
    setTagDraft('');
  };

  const setBadges = (next: ProductFormValues['badges']) => form.setValue('badges', next, DIRTY);

  return (
    <FormSection
      id="organization"
      title="Organization"
      description="How this product is classified, filtered, and found on the storefront."
    >
      {/* Primary category (enum, required) */}
      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem className="sm:max-w-xs">
            <FormLabel>Category</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {PRODUCT_CATEGORY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>The primary product type.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Relational catalog categories (optional, multi) */}
      <FormItem>
        <FormLabel>Catalog categories</FormLabel>
        <ChipMultiSelect
          options={(categories.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          selected={categoryIds}
          onToggle={(id) => form.setValue('categoryIds', toggle(categoryIds, id), DIRTY)}
          loading={categories.isLoading}
          error={categories.isError}
          onRetry={() => void categories.refetch()}
          emptyText="No catalog categories yet."
        />
        <FormDescription>Extra categories used by the shop’s filters (the first is primary).</FormDescription>
      </FormItem>

      {/* Concerns (relational, multi) — powers Shop by Concern */}
      <FormItem>
        <FormLabel>Concerns</FormLabel>
        <ChipMultiSelect
          options={(concerns.data ?? []).map((c) => ({ value: c.id, label: c.title }))}
          selected={concernIds}
          onToggle={(id) => form.setValue('concernIds', toggle(concernIds, id), DIRTY)}
          loading={concerns.isLoading}
          error={concerns.isError}
          onRetry={() => void concerns.refetch()}
          emptyText="No concerns configured yet."
        />
        <FormDescription>What this product targets — drives “Shop by Concern”.</FormDescription>
      </FormItem>

      {/* Skin types (enum, multi) */}
      <FormItem>
        <FormLabel>Skin types</FormLabel>
        <ChipMultiSelect
          options={SKIN_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          selected={skinTypes}
          onToggle={(value) =>
            form.setValue('skinTypes', toggle(skinTypes, value) as ProductFormValues['skinTypes'], DIRTY)
          }
        />
      </FormItem>

      {/* Tags (free custom) */}
      <FormItem>
        <FormLabel>Tags</FormLabel>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Remove tag ${t}`}
                  onClick={() => form.setValue('tags', tags.filter((x) => x !== t), DIRTY)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <FormControl>
          <Input
            value={tagDraft}
            maxLength={TAG_MAX_LENGTH}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                commitTag();
              }
            }}
            onBlur={commitTag}
            placeholder="Type a tag and press Enter"
          />
        </FormControl>
        {errors.tags ? (
          <p className="text-sm font-medium text-destructive">Remove any tag over {TAG_MAX_LENGTH} characters.</p>
        ) : null}
      </FormItem>

      {/* Badges (label + tone) */}
      <FormItem>
        <FormLabel>Badges</FormLabel>
        <div className="space-y-2">
          {badges.map((badge, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <Input
                  value={badge.label}
                  onChange={(e) =>
                    setBadges(badges.map((b, i) => (i === index ? { ...b, label: e.target.value } : b)))
                  }
                  placeholder="Badge label"
                  aria-invalid={!!badgeLabelError(index)}
                />
                {badgeLabelError(index) ? (
                  <p className="mt-1 text-xs font-medium text-destructive">{badgeLabelError(index)}</p>
                ) : null}
              </div>
              <Select
                value={badge.tone}
                onValueChange={(tone) =>
                  setBadges(
                    badges.map((b, i) => (i === index ? { ...b, tone: tone as BadgeToneValue } : b)),
                  )
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BADGE_TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove badge ${badge.label || index + 1}`}
                onClick={() => setBadges(badges.filter((_, i) => i !== index))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => setBadges([...badges, { label: '', tone: 'NEW' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add badge
        </Button>
      </FormItem>
    </FormSection>
  );
}
