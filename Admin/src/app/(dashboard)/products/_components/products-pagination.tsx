'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PAGE_SIZES = [10, 25, 50, 100];

export function ProductsPagination({
  page,
  perPage,
  total,
  onPage,
  onPerPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const to = Math.min(page * perPage, total);
  // Clamp so a transient out-of-range page (before the page-snap effect fires)
  // can never render a "from" greater than "to".
  const from = total === 0 ? 0 : Math.min((page - 1) * perPage + 1, to);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm">
      <p className="text-muted-foreground">
        Showing{' '}
        <span className="font-medium text-foreground">
          {from}–{to}
        </span>{' '}
        of <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 w-16 justify-between px-2">
                {perPage}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={String(perPage)}
                onValueChange={(v) => onPerPage(Number(v))}
              >
                {PAGE_SIZES.map((s) => (
                  <DropdownMenuRadioItem key={s} value={String(s)}>
                    {s}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
