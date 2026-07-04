'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ORDER_SORT_OPTIONS } from '@/lib/order-meta';
import type { AdminOrderSort } from '@/types/order';
import { OrdersFilters } from './orders-filters';
import type { OrdersViewApi } from './use-orders-view';

export function OrdersToolbar({ api }: { api: OrdersViewApi }) {
  const [term, setTerm] = useState(api.view.q);
  const firstRun = useRef(true);

  useEffect(() => {
    setTerm(api.view.q);
  }, [api.view.q]);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const id = setTimeout(() => {
      if (term !== api.view.q) api.setSearch(term);
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[14rem] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search order #, customer, email…"
          className="pl-8"
        />
      </div>
      <OrdersFilters api={api} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Sort
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuRadioGroup
            value={api.view.sort}
            onValueChange={(v) => api.setSort(v as AdminOrderSort)}
          >
            {ORDER_SORT_OPTIONS.map((o) => (
              <DropdownMenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
