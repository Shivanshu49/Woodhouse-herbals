'use client';

import { useFormContext } from 'react-hook-form';
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

type NumberFieldName = 'stockQty' | 'lowStockThreshold' | 'weightGrams' | 'lengthCm' | 'widthCm' | 'heightCm';
type SwitchFieldName = 'trackInventory' | 'allowBackorder' | 'freeShipping';

function NumberField({
  name,
  label,
  description,
  placeholder,
  suffix,
  disabled,
}: {
  name: NumberFieldName;
  label: string;
  description?: string;
  placeholder?: string;
  suffix?: string;
  disabled?: boolean;
}) {
  const form = useFormContext<ProductFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className={cn(disabled && 'text-muted-foreground')}>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                {...field}
                disabled={disabled}
                inputMode="decimal"
                placeholder={placeholder}
                className={cn('tabular-nums', suffix && 'pr-9')}
              />
              {suffix ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {suffix}
                </span>
              ) : null}
            </div>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SwitchRow({
  name,
  label,
  description,
  disabled,
  revalidate,
}: {
  name: SwitchFieldName;
  label: string;
  description: string;
  disabled?: boolean;
  /** Fields whose validity depends on this toggle — re-validated when it changes. */
  revalidate?: NumberFieldName[];
}) {
  const form = useFormContext<ProductFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            'flex items-center justify-between space-y-0 rounded-md border p-3',
            disabled && 'opacity-60',
          )}
        >
          <div className="space-y-0.5 pr-4">
            <FormLabel className="text-sm">{label}</FormLabel>
            <FormDescription>{description}</FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                // Toggling tracking gates the stock fields' validation; re-validate
                // them so a stale error on a now-disabled field clears.
                revalidate?.forEach((n) => void form.trigger(n));
              }}
              disabled={disabled}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function InventorySection() {
  const form = useFormContext<ProductFormValues>();
  const tracking = form.watch('trackInventory');

  return (
    <FormSection
      id="inventory"
      title="Inventory & shipping"
      description="Stock tracking and the details couriers need."
    >
      <div className="space-y-4">
        <SwitchRow
          name="trackInventory"
          label="Track inventory"
          description="Count stock for this product and warn when it runs low."
          revalidate={['stockQty', 'lowStockThreshold']}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField
            name="stockQty"
            label="Initial stock"
            placeholder="0"
            disabled={!tracking}
            description="Starting quantity. After creating, manage stock in Inventory."
          />
          <NumberField
            name="lowStockThreshold"
            label="Low-stock alert at"
            placeholder="5"
            suffix="units"
            disabled={!tracking}
            description="Flag the product as low when stock reaches this."
          />
        </div>

        <SwitchRow
          name="allowBackorder"
          label="Allow backorders"
          description="Let customers order beyond the available stock."
          disabled={!tracking}
        />
      </div>

      <div className="space-y-4">
        <p className="text-sm font-medium">Shipping</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <NumberField name="weightGrams" label="Weight" placeholder="250" suffix="g" />
          <FormField
            control={form.control}
            name="shippingClass"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Shipping class</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="standard" />
                </FormControl>
                <FormDescription>Optional — e.g. standard, fragile, cold-chain.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <FormLabel className="text-sm">Dimensions</FormLabel>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <NumberField name="lengthCm" label="Length" placeholder="0" suffix="cm" />
            <NumberField name="widthCm" label="Width" placeholder="0" suffix="cm" />
            <NumberField name="heightCm" label="Height" placeholder="0" suffix="cm" />
          </div>
        </div>

        <SwitchRow
          name="freeShipping"
          label="Free shipping"
          description="Waive shipping charges for this product."
        />
      </div>
    </FormSection>
  );
}
