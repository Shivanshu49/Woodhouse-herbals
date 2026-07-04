'use client';

import type { ReactNode } from 'react';
import { Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import {
  ORDER_STATUS_OPTIONS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from '@/lib/order-meta';
import type { OrdersViewApi } from './use-orders-view';

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-accent',
      )}
    >
      {children}
    </button>
  );
}

export function OrdersFilters({ api }: { api: OrdersViewApi }) {
  const { view, filterCount } = api;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {filterCount > 0 ? (
            <span className="ml-2 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
              {filterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {ORDER_STATUS_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={view.statuses.includes(o.value)}
                onClick={() => api.toggleStatus(o.value)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Payment method</p>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_METHOD_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={view.paymentMethod === o.value}
                onClick={() =>
                  api.setPaymentMethod(view.paymentMethod === o.value ? undefined : o.value)
                }
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Payment status</p>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={view.paymentStatus === o.value}
                onClick={() =>
                  api.setPaymentStatus(view.paymentStatus === o.value ? undefined : o.value)
                }
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Placed between</p>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={view.dateFrom ?? ''}
              onChange={(e) => api.setDateRange(e.target.value || undefined, view.dateTo)}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              type="date"
              value={view.dateTo ?? ''}
              onChange={(e) => api.setDateRange(view.dateFrom, e.target.value || undefined)}
            />
          </div>
        </div>
        {filterCount > 0 ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={api.clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
