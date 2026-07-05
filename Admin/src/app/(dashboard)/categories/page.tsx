'use client';

import { useState } from 'react';
import { FolderTree } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAdminCategories, useDeleteCategory } from '@/hooks/use-admin-categories';
import type { AdminCategory } from '@/types/admin-category';
import { CategoryTree } from './_components/category-tree';
import { CategoryDialog } from './_components/category-dialog';

function flatten(nodes: AdminCategory[], acc: AdminCategory[] = []): AdminCategory[] {
  for (const n of nodes) {
    acc.push(n);
    flatten(n.children, acc);
  }
  return acc;
}

export default function CategoriesPage() {
  const { data: tree, isLoading } = useAdminCategories();
  const del = useDeleteCategory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);

  const flat = tree ? flatten(tree) : [];
  const parentOptions = flat.map((c) => ({ id: c.id, name: c.name }));

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(c: AdminCategory) {
    setEditing(c);
    setDialogOpen(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <PageHeader title="Categories" description="Organize your catalog into shoppable groups." />
        <Button onClick={openNew}>New category</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full max-w-3xl" />
      ) : !tree || tree.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Create categories like Face Wash, Serum, or Scrub, then drag to reorder."
        />
      ) : (
        <div className="max-w-3xl">
          <CategoryTree nodes={tree} onEdit={openEdit} onDelete={setDeleting} />
        </div>
      )}

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        parentOptions={editing ? parentOptions.filter((o) => o.id !== editing.id) : parentOptions}
      />

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              Delete “{deleting?.name}”? Categories with products or sub-categories can’t be deleted —
              reassign those first.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={del.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                if (!deleting) return;
                del.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
              }}
            >
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
