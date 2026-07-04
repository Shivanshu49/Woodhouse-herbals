'use client';

import { useFormContext } from 'react-hook-form';
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
import { formatInr } from '@/lib/money';
import { FormSection } from '../form-section';
import type { ProductFormValues } from '../product-form-schema';
import { GST_PERCENT, GST_RATES, computeMargin, gstBreakdown, rupeesToPaise } from '../pricing';

/** A rupee amount input with a ₹ prefix. */
function AmountField({
  name,
  label,
  description,
  placeholder,
  revalidate,
}: {
  name: 'price' | 'compareAtPrice' | 'costPrice';
  label: string;
  description?: string;
  placeholder?: string;
  /** Other fields whose cross-field rule depends on this one — re-validated on change. */
  revalidate?: ('compareAtPrice' | 'saleEndsAt')[];
}) {
  const form = useFormContext<ProductFormValues>();
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ₹
              </span>
              <Input
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  // The compare-at > price rule lives on compareAtPrice but
                  // depends on price; re-validate it so its error tracks price.
                  revalidate?.forEach((n) => void form.trigger(n));
                }}
                inputMode="decimal"
                placeholder={placeholder}
                className="pl-7 tabular-nums"
              />
            </div>
          </FormControl>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function PricingSection() {
  const form = useFormContext<ProductFormValues>();
  const price = form.watch('price');
  const gstRate = form.watch('gstRate');
  const costPrice = form.watch('costPrice');

  const pricePaise = rupeesToPaise(price);
  const breakdown =
    pricePaise !== null && pricePaise > 0 ? gstBreakdown(pricePaise, GST_PERCENT[gstRate]) : null;

  const costPaise = costPrice.trim() ? rupeesToPaise(costPrice) : null;
  const margin = breakdown && costPaise !== null ? computeMargin(breakdown.netMinor, costPaise) : null;

  return (
    <FormSection id="pricing" title="Pricing & tax" description="Prices are GST-inclusive.">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <AmountField name="price" label="Price" placeholder="199" revalidate={['compareAtPrice']} />
          {breakdown ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {breakdown.ratePercent === 0 ? (
                <>GST-exempt · {formatInr(breakdown.netMinor)} net</>
              ) : (
                <>
                  incl. {breakdown.ratePercent}% GST →{' '}
                  <span className="font-medium text-foreground">{formatInr(breakdown.netMinor)}</span> net +{' '}
                  {formatInr(breakdown.gstMinor)} GST
                </>
              )}
            </p>
          ) : null}
        </div>

        {/* GST rate is prominent (beside price) — ayurvedic vs cosmetic slabs
            differ per product, so this must be easy to change. */}
        <FormField
          control={form.control}
          name="gstRate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GST rate</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select GST rate" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GST_RATES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>Ayurvedic medicaments may fall in a lower slab than cosmetics.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <AmountField
          name="compareAtPrice"
          label="Compare-at price"
          placeholder="249"
          description="The MRP / “was” price, shown struck-through. Must be higher than the price."
        />
        <div>
          <AmountField
            name="costPrice"
            label="Cost price"
            placeholder="80"
            description="Internal only — never shown to customers."
          />
          {margin ? (
            <p
              className={cn(
                'mt-1.5 text-xs',
                margin.profitMinor >= 0 ? 'text-emerald-600' : 'text-destructive',
              )}
            >
              Margin {margin.marginPct}% · {formatInr(margin.profitMinor)} profit
              <span className="text-muted-foreground"> (on net of GST)</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="hsnCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>HSN code</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" placeholder="3304" className="font-mono text-xs" />
              </FormControl>
              <FormDescription>Optional. 4–8 digits, for GST invoicing.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">Sale schedule <span className="font-normal text-muted-foreground">· optional</span></p>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="saleStartsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale starts</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      // "end after start" lives on saleEndsAt but depends on start.
                      void form.trigger('saleEndsAt');
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="saleEndsAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sale ends</FormLabel>
                <FormControl>
                  <Input
                    type="datetime-local"
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);
                      // The "set a start date" rule lives on saleStartsAt but is
                      // triggered by an end date — re-validate it from this side too.
                      void form.trigger('saleStartsAt');
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          When the discount (price below compare-at) runs. Leave blank for an always-on price.
        </p>
      </div>
    </FormSection>
  );
}
