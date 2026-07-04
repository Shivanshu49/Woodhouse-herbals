'use client';

import { useFormContext, useFormState } from 'react-hook-form';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { cn } from '@/lib/cn';
import { FormSection } from '../form-section';
import type { ProductFormValues } from '../product-form-schema';

const DIRTY = { shouldDirty: true, shouldValidate: true } as const;

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const FREE_FROM_FLAGS = [
  { name: 'parabenFree', label: 'Paraben-free' },
  { name: 'sulfateFree', label: 'Sulfate-free' },
  { name: 'crueltyFree', label: 'Cruelty-free' },
  { name: 'vegan', label: 'Vegan' },
  { name: 'alcoholFree', label: 'Alcohol-free' },
] as const;

export function IngredientsSection() {
  const form = useFormContext<ProductFormValues>();
  const ingredients = form.watch('ingredients');
  const benefits = form.watch('benefits');
  const howToUse = form.watch('howToUse');
  const { errors } = useFormState({ control: form.control });

  // Nested leaf errors for the manually-managed lists (bare FormMessage can't
  // resolve these — see GROUP 5). Cast narrowly rather than use `any`.
  const ingErr = (i: number, field: 'name' | 'benefit'): string | undefined =>
    (errors.ingredients as { name?: { message?: string }; benefit?: { message?: string } }[] | undefined)?.[i]?.[
      field
    ]?.message;

  const setIngredients = (next: ProductFormValues['ingredients']) => form.setValue('ingredients', next, DIRTY);

  return (
    <FormSection
      id="ingredients"
      title="Ingredients & usage"
      description="What’s inside, what it does, and how to use it."
    >
      {/* Ingredients — name + benefit */}
      <FormItem>
        <FormLabel>Key ingredients</FormLabel>
        <FormDescription>Each needs a name and what it does.</FormDescription>
        <div className="space-y-2">
          {ingredients.map((row, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="w-1/3">
                <Input
                  value={row.name}
                  maxLength={100}
                  placeholder="Niacinamide"
                  aria-invalid={!!ingErr(index, 'name')}
                  onChange={(e) =>
                    setIngredients(ingredients.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)))
                  }
                />
                {ingErr(index, 'name') ? (
                  <p className="mt-1 text-xs font-medium text-destructive">{ingErr(index, 'name')}</p>
                ) : null}
              </div>
              <div className="flex-1">
                <Input
                  value={row.benefit}
                  maxLength={200}
                  placeholder="Brightens and evens tone"
                  aria-invalid={!!ingErr(index, 'benefit')}
                  onChange={(e) =>
                    setIngredients(ingredients.map((r, i) => (i === index ? { ...r, benefit: e.target.value } : r)))
                  }
                />
                {ingErr(index, 'benefit') ? (
                  <p className="mt-1 text-xs font-medium text-destructive">{ingErr(index, 'benefit')}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ingredient ${row.name || index + 1}`}
                onClick={() => setIngredients(ingredients.filter((_, i) => i !== index))}
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
          onClick={() => setIngredients([...ingredients, { name: '', benefit: '' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add ingredient
        </Button>
      </FormItem>

      {/* Benefits + How to use — single-text repeatable lists */}
      <div className="grid gap-6 sm:grid-cols-2">
        <TextList
          label="Benefits"
          items={benefits}
          placeholder="Visibly smoother skin"
          addLabel="Add benefit"
          maxLength={200}
          onChange={(next) => form.setValue('benefits', next, DIRTY)}
        />
        <TextList
          label="How to use"
          items={howToUse}
          placeholder="Apply to damp skin, morning and night"
          addLabel="Add step"
          maxLength={300}
          ordered
          onChange={(next) => form.setValue('howToUse', next, DIRTY)}
        />
      </div>

      {/* INCI list — long, uncapped, auto-grows */}
      <FormField
        control={form.control}
        name="inciText"
        render={({ field }) => (
          <FormItem>
            <FormLabel>INCI list</FormLabel>
            <FormControl>
              <textarea
                {...field}
                rows={4}
                className={cn(TEXTAREA_CLASS, 'min-h-[6rem] resize-y')}
                placeholder="Aqua, Niacinamide, Glycerin, Sodium Hyaluronate, …"
                onInput={(e) => {
                  // Auto-grow so a full 30+ ingredient declaration is readable.
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${el.scrollHeight}px`;
                }}
              />
            </FormControl>
            <FormDescription>The full cosmetic ingredient declaration — can be long.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="usageFrequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Usage frequency</FormLabel>
              <FormControl>
                <Input {...field} maxLength={200} placeholder="Twice daily" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="recommendedTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Best time to use</FormLabel>
              <FormControl>
                <Input {...field} maxLength={200} placeholder="Morning & night" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Free-from flags */}
      <FormItem>
        <FormLabel>Free-from claims</FormLabel>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FREE_FROM_FLAGS.map((flag) => (
            <FormField
              key={flag.name}
              control={form.control}
              name={flag.name}
              render={({ field }) => (
                <FormItem className="flex items-center justify-between space-y-0 rounded-md border px-3 py-2">
                  <FormLabel className="text-sm font-normal">{flag.label}</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
        </div>
      </FormItem>
    </FormSection>
  );
}

/** A repeatable single-text list (benefits, how-to-use steps). */
function TextList({
  label,
  items,
  placeholder,
  addLabel,
  maxLength,
  ordered,
  onChange,
}: {
  label: string;
  items: string[];
  placeholder: string;
  addLabel: string;
  maxLength: number;
  ordered?: boolean;
  onChange: (next: string[]) => void;
}) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {ordered ? (
              <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                {index + 1}.
              </span>
            ) : null}
            <Input
              value={item}
              maxLength={maxLength}
              placeholder={placeholder}
              onChange={(e) => onChange(items.map((v, i) => (i === index ? e.target.value : v)))}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${label} ${index + 1}`}
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onChange([...items, ''])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </FormItem>
  );
}
