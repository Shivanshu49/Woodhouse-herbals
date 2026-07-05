'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useIntegrations } from '@/hooks/use-settings';
import type { IntegrationsStatus } from '@/types/settings';

const PROVIDERS: { key: keyof IntegrationsStatus; name: string; purpose: string }[] = [
  { key: 'cloudinary', name: 'Cloudinary', purpose: 'Product & content image uploads' },
  { key: 'r2', name: 'Cloudflare R2', purpose: 'Invoice PDF storage' },
  { key: 'phonepe', name: 'PhonePe', purpose: 'Online payments & refunds' },
  { key: 'email', name: 'Email (Resend)', purpose: 'Invites, verification & reset mail' },
];

export function IntegrationsTab() {
  const { data, isLoading } = useIntegrations();
  if (isLoading) return <Skeleton className="h-40 w-full max-w-2xl" />;

  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-sm text-muted-foreground">
        Read-only status from server configuration. Secrets are never shown; edit keys in the deploy
        environment (an in-app key editor is a planned follow-up).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map((p) => {
          const configured = data?.[p.key] ?? false;
          return (
            <div key={p.key} className="flex items-start justify-between rounded-lg border p-4">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.purpose}</div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
                  configured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400'
                    : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {configured ? 'Configured' : 'Not configured'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
