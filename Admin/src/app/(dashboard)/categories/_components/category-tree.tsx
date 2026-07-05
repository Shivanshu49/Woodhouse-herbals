'use client';

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useReorderCategories, useUpdateCategory } from '@/hooks/use-admin-categories';
import type { AdminCategory } from '@/types/admin-category';

function Row({
  node,
  onEdit,
  onDelete,
}: {
  node: AdminCategory;
  onEdit: (c: AdminCategory) => void;
  onDelete: (c: AdminCategory) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: node.id });
  const update = useUpdateCategory(node.id);
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'opacity-60' : ''}>
      <div className="flex items-center gap-3 rounded-md border p-2">
        <button className="cursor-grab text-muted-foreground" {...attributes} {...listeners} aria-label="Drag to reorder">
          <GripVertical className="h-4 w-4" />
        </button>
        {node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.imageUrl} alt="" className="h-9 w-9 rounded object-cover" />
        ) : (
          <div className="h-9 w-9 rounded bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{node.name}</span>
            {!node.isActive && <span className="text-xs text-amber-600">hidden</span>}
          </div>
          <div className="truncate text-xs text-muted-foreground">/{node.slug} · {node.productCount} product{node.productCount === 1 ? '' : 's'}</div>
        </div>
        <Switch
          checked={node.isActive}
          onCheckedChange={(v) => update.mutate({ isActive: v })}
          aria-label="Active"
        />
        <Button size="sm" variant="ghost" onClick={() => onEdit(node)} aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(node)} aria-label="Delete">
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
      {node.children.length > 0 && (
        <div className="ml-8 mt-2 space-y-2">
          <CategoryTree nodes={node.children} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

/** A drag-reorderable sibling group. Reorder is scoped to one level (dragging is
 *  within a group); moving between parents is done via the edit dialog. */
export function CategoryTree({
  nodes,
  onEdit,
  onDelete,
}: {
  nodes: AdminCategory[];
  onEdit: (c: AdminCategory) => void;
  onDelete: (c: AdminCategory) => void;
}) {
  const reorder = useReorderCategories();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = nodes.findIndex((n) => n.id === active.id);
    const newIndex = nodes.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(nodes, oldIndex, newIndex);
    reorder.mutate({ items: ordered.map((n, i) => ({ id: n.id, sortOrder: i })) });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {nodes.map((n) => (
            <Row key={n.id} node={n} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
