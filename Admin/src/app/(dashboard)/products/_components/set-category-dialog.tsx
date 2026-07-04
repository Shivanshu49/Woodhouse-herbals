'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useCategories } from '@/hooks/use-categories';

export function SetCategoryDialog({
  open,
  onOpenChange,
  count,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  pending: boolean;
  onSubmit: (categoryId: string) => void;
}) {
  const { data: categories, isPending, isError } = useCategories(open);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Set category</DialogTitle>
          <DialogDescription>
            Assign a catalog category to {count} selected product{count === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto rounded-md border">
          {isPending ? (
            <p className="p-4 text-sm text-muted-foreground">Loading categories…</p>
          ) : isError ? (
            <p className="p-4 text-sm text-destructive">Couldn’t load categories.</p>
          ) : !categories?.length ? (
            <p className="p-4 text-sm text-muted-foreground">
              No categories found — create one first.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {categories.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(c.id)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent',
                      selected === c.id && 'bg-accent',
                    )}
                  >
                    <span>{c.name}</span>
                    {selected === c.id ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={() => selected && onSubmit(selected)} disabled={!selected || pending}>
            {pending ? 'Saving…' : 'Set category'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
