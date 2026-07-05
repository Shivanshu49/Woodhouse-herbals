'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAddOrderNote } from '@/hooks/use-order-mutations';
import { RelativeDate } from '../../_components/relative-date';
import type { OrderDetail } from '@/types/order';

export function NotesSection({ order }: { order: OrderDetail }) {
  const add = useAddOrderNote(order.id);
  const [body, setBody] = useState('');
  const [visible, setVisible] = useState(false);

  function submit() {
    if (!body.trim()) return;
    add.mutate(
      { body: body.trim(), isCustomerVisible: visible },
      {
        onSuccess: () => {
          setBody('');
          setVisible(false);
        },
      },
    );
  }

  return (
    <div id="notes" className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-medium">Notes</h3>
      <ul className="space-y-2">
        {order.notes.length === 0 && <li className="text-sm text-muted-foreground">No notes.</li>}
        {order.notes.map((n) => (
          <li key={n.id} className="rounded-md border p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {n.isCustomerVisible ? 'Customer-visible' : 'Internal'}
              </span>
              <RelativeDate iso={n.createdAt} />
            </div>
            <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border-t pt-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="w-full resize-none rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch id="note-visible" checked={visible} onCheckedChange={setVisible} />
            <Label htmlFor="note-visible" className="text-sm">
              Visible to customer
            </Label>
          </div>
          <Button size="sm" onClick={submit} disabled={!body.trim() || add.isPending}>
            {add.isPending ? 'Saving…' : 'Add note'}
          </Button>
        </div>
      </div>
    </div>
  );
}
