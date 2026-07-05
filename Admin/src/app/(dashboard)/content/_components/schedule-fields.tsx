'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/** Optional [starts, ends] window as two datetime-local inputs. Values are local
 *  wall-clock strings (see content-schedule.ts); the note flags that the
 *  storefront doesn't enforce the window yet. */
export function ScheduleFields({
  startsAt,
  endsAt,
  onStartsAt,
  onEndsAt,
}: {
  startsAt: string;
  endsAt: string;
  onStartsAt: (v: string) => void;
  onEndsAt: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>Schedule (optional)</Label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => onStartsAt(e.target.value)}
          aria-label="Starts at"
        />
        <Input
          type="datetime-local"
          value={endsAt}
          onChange={(e) => onEndsAt(e.target.value)}
          aria-label="Ends at"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Start / end dates are stored but not yet enforced on the storefront.
      </p>
    </div>
  );
}
