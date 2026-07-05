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
import { faqs } from '@/hooks/use-content';
import type { Faq } from '@/types/content';

export function FaqDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Faq | null;
}) {
  const create = faqs.useCreate();
  const update = faqs.useUpdate();
  const pending = create.isPending || update.isPending;

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setQuestion(editing?.question ?? '');
    setAnswer(editing?.answer ?? '');
    setCategory(editing?.category ?? '');
    setActive(editing?.active ?? true);
  }, [open, editing]);

  const valid = !!question.trim() && !!answer.trim();

  function submit() {
    if (!valid) return;
    const done = { onSuccess: () => onOpenChange(false) };
    if (editing) {
      update.mutate(
        { id: editing.id, body: { question: question.trim(), answer: answer.trim(), category, active } },
        done,
      );
    } else {
      create.mutate(
        { question: question.trim(), answer: answer.trim(), category: category || undefined, active },
        done,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit FAQ' : 'New FAQ'}</DialogTitle>
          <DialogDescription>Questions &amp; answers for the storefront help section.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="f-question">Question</Label>
          <Input id="f-question" value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label htmlFor="f-answer">Answer</Label>
          <textarea
            id="f-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-md border bg-transparent p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="f-category">Category (optional)</Label>
            <Input id="f-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="shipping" />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="f-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="f-active" className="text-sm">Active</Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
