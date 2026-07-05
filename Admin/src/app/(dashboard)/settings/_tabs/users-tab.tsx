'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateStaff, useStaffUsers, useUpdateStaff } from '@/hooks/use-settings';
import type { AdminRole } from '@/types/api';
import type { StaffUser } from '@/types/settings';

const ROLES: AdminRole[] = ['ADMIN', 'MANAGER', 'STAFF'];
const selectCls =
  'h-8 rounded-md border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring';

function StaffRow({ user }: { user: StaffUser }) {
  const update = useUpdateStaff(user.id);
  const active = user.deletedAt === null;
  return (
    <tr className="border-b">
      <td className="py-2">
        <div className="font-medium">{user.fullName}</div>
        <div className="text-xs text-muted-foreground">{user.email ?? '—'}</div>
      </td>
      <td className="py-2">
        <select
          className={selectCls}
          value={user.role}
          disabled={update.isPending}
          onChange={(e) => update.mutate({ role: e.target.value as AdminRole })}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2">
        <span className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}>
          {active ? 'Active' : 'Deactivated'}
        </span>
      </td>
      <td className="py-2 text-right">
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ active: !active })}
        >
          {active ? 'Deactivate' : 'Reactivate'}
        </Button>
      </td>
    </tr>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const create = useCreateStaff();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<AdminRole>('STAFF');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  function submit() {
    if (!email.trim() || !fullName.trim()) return;
    create.mutate(
      { email: email.trim(), fullName: fullName.trim(), role },
      { onSuccess: (r) => setInviteUrl(r.inviteUrl) },
    );
  }

  function close() {
    onOpenChange(false);
    setEmail('');
    setFullName('');
    setRole('STAFF');
    setInviteUrl(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite staff member</DialogTitle>
          <DialogDescription>
            They receive a link to set their own password; the account can’t sign in until they do.
          </DialogDescription>
        </DialogHeader>
        {inviteUrl ? (
          <div className="space-y-2">
            <p className="text-sm">Invite created. Send this link to the new member:</p>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} className="font-mono text-xs" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(inviteUrl);
                  toast.success('Invite link copied');
                }}
              >
                Copy
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="inv-name">Full name</Label>
              <Input id="inv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="inv-role">Role</Label>
              <select
                id="inv-role"
                className="h-9 w-full rounded-md border bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={role}
                onChange={(e) => setRole(e.target.value as AdminRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={create.isPending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!email.trim() || !fullName.trim() || create.isPending}>
                {create.isPending ? 'Inviting…' : 'Send invite'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function UsersTab() {
  const { data: users, isLoading } = useStaffUsers();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full max-w-3xl" />;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setInviteOpen(true)}>Invite staff</Button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase text-muted-foreground">
            <th className="py-2 font-medium">Member</th>
            <th className="py-2 font-medium">Role</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((u) => (
            <StaffRow key={u.id} user={u} />
          ))}
        </tbody>
      </table>
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}
