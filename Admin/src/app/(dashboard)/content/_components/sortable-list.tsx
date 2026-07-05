'use client';

import type { ReactNode } from 'react';
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
import { GripVertical } from 'lucide-react';

/**
 * Generic drag-to-reorder list. `renderRow` receives the item plus a ready-made
 * drag handle to place wherever it fits the row. On drop it hands back the full
 * ordered list as `{ id, sortOrder }[]` (0-based) for a bulk reorder call.
 */
export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderRow,
}: {
  items: T[];
  onReorder: (ordered: Array<{ id: string; sortOrder: number }>) => void;
  renderRow: (item: T, handle: ReactNode) => ReactNode;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((n) => n.id === active.id);
    const newIndex = items.findIndex((n) => n.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const ordered = arrayMove(items, oldIndex, newIndex);
    onReorder(ordered.map((n, i) => ({ id: n.id, sortOrder: i })));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableRow key={item.id} item={item} renderRow={renderRow} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow<T extends { id: string }>({
  item,
  renderRow,
}: {
  item: T;
  renderRow: (item: T, handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const handle = (
    <button
      className="cursor-grab text-muted-foreground"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-60' : ''}
    >
      {renderRow(item, handle)}
    </div>
  );
}
