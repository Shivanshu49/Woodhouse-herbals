'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAdminUser, useLogout } from '@/hooks/use-admin-auth';
import { useIdleTimeout, THIRTY_MINUTES_MS } from '@/hooks/use-idle-timeout';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useAdminUser();
  const logout = useLogout();

  // Redirect to /login once we know there's no valid admin session.
  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useIdleTimeout({
    timeoutMs: THIRTY_MINUTES_MS,
    onIdle: () => {
      if (!user) return;
      void logout.mutateAsync().finally(() => {
        toast.info('Signed out after 30 minutes of inactivity.');
        router.replace('/login');
      });
    },
  });

  if (isLoading || !user) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Task 8 replaces this placeholder wrapper with the sidebar + topbar shell.
  return (
    <div className="min-h-screen bg-background" data-admin-role={user.role}>
      {children}
    </div>
  );
}
