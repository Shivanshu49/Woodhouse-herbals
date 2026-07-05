'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  useCategorySlugCheck,
  useCreateCategory,
  useUpdateCategory,
} from '@/hooks/use-admin-categories';
import type { AdminCategory } from '@/types/admin-category';
import { slugifyContent as slugify } from '@/lib/slugify';
import { ImageUploadField } from './image-upload-field';

const selectCls = 'h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export function CategoryDialog({
  open,
  onOpenChange,
  editing,
  parentOptions,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AdminCategory | null;
  parentOptions: Array<{ id: string; name: string }>;
}) {
  const create = useCreateCategory();
  const update = useUpdateCategory(editing?.id ?? '');
  const pending = create.isPending || update.isPending;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [parentId, setParentId] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setSlug(editing?.slug ?? '');
    setSlugTouched(!!editing);
    setDescription(editing?.description ?? '');
    setImageUrl(editing?.imageUrl ?? null);
    setParentId(editing?.parentId ?? '');
    setIsActive(editing?.isActive ?? true);
  }, [open, editing]);

  // Auto-derive the slug from the name until the user edits the slug directly.
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  const { status } = useCategorySlugCheck(slug, editing?.id);
  const slugTaken = status === 'taken';

  function submit() {
    if (!name.trim() || !slug || slugTaken) return;
    const body = {
      name: name.trim(),
      slug,
      description: description.trim() || undefined,
      imageUrl: imageUrl ?? undefined,
      parentId: parentId || undefined,
      isActive,
    };
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing)
      // On edit, clear-to-empty is explicit: '' un-nests to top level / clears the
      // image / clears the description (create omits them instead). An omitted key
      // means "leave unchanged" on the backend, so a blanked parent needs ''.
      update.mutate({ ...body, imageUrl: imageUrl ?? '', description: description.trim(), parentId: parentId || '' }, done);
    else create.mutate(body, done);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogDescription>Categories power the storefront’s “Shop by category”.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="cat-name">Name</Label>
          <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cat-slug">Slug</Label>
          <Input
            id="cat-slug"
            value={slug}
            onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)); }}
            className={slugTaken ? 'border-red-500' : ''}
          />
          <p className="text-xs text-muted-foreground">
            {status === 'checking' && 'Checking…'}
            {status === 'available' && <span className="text-emerald-600">Available</span>}
            {status === 'taken' && <span className="text-red-600">Already in use</span>}
          </p>
        </div>

        <div className="space-y-1">
          <Label>Image</Label>
          <ImageUploadField value={imageUrl} onChange={setImageUrl} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="cat-desc">Description</Label>
          <textarea
            id="cat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="cat-parent">Parent category</Label>
            <select id="cat-parent" className={selectCls} value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">— Top level —</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="cat-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="cat-active" className="text-sm">Active (visible on storefront)</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !slug || slugTaken || pending}>
            {pending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
