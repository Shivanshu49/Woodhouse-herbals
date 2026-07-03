'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAdminUser, useLogout } from '@/hooks/use-admin-auth';
import { useIdleTimeout, THIRTY_MINUTES_MS } from '@/hooks/use-idle-timeout';
import { Skeleton } from '@/components/ui/skeleton';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useAdminUser();
  const logout = useLogout();
  const [commandOpen, setCommandOpen] = useState(false);

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        router.push('/products/new');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-60 border-r bg-card lg:block" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenCommand={() => setCommandOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      {/* CommandPalette is mounted here in Task 9, controlled by commandOpen/setCommandOpen. */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
