'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, MapPin, Package, User as UserIcon, Heart } from 'lucide-react';
import { useLogout, useProfile } from '@/hooks/use-auth';
import type { CustomerProfile } from '@/types/auth';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/account', label: 'Profile', Icon: UserIcon },
  { href: '/account/orders', label: 'Orders', Icon: Package },
  { href: '/account/wishlist', label: 'Wishlist', Icon: Heart },
];

/**
 * Auth guard + two-column shell for every /account page. Redirects to
 * /login when the profile query resolves to "not signed in".
 */
export function AccountShell({
  title,
  children,
}: {
  title: string;
  children: (profile: CustomerProfile) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: profile, isPending, isFetching } = useProfile();
  const logout = useLogout();

  // Only redirect once the query is settled — a cached `null` from before
  // login is refetched right after sign-in, and bouncing early would send
  // freshly signed-in users straight back to /login.
  useEffect(() => {
    if (!isPending && !isFetching && !profile) router.replace('/login');
  }, [isPending, isFetching, profile, router]);

  if (isPending || (isFetching && !profile)) {
    return (
      <div className="container-wide py-16">
        <div className="h-8 w-48 rounded-full bg-navy-900/8 animate-pulse" />
        <div className="mt-8 h-64 rounded-3xl bg-navy-900/5 animate-pulse" />
      </div>
    );
  }
  if (!profile) return null; // redirecting

  return (
    <div className="bg-brand-cream/50 min-h-[70vh]">
      <div className="container-wide py-10 sm:py-14">
        <h1 className="font-display text-3xl sm:text-4xl text-brand-forest">
          <span className="font-bold">My</span> <span className="font-normal italic">{title}</span>
        </h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[220px_1fr]">
          <aside className="min-w-0">
            <nav className="flex flex-wrap lg:flex-col gap-2" aria-label="Account">
              {NAV.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'inline-flex items-center gap-2.5 rounded-full px-5 h-11 font-inter text-sm font-semibold whitespace-nowrap transition-colors',
                    pathname === href
                      ? 'bg-brand-forest text-white'
                      : 'bg-white text-brand-forest hover:bg-brand-forest/10 border border-navy-900/8',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
              <button
                onClick={() => logout.mutate(undefined, { onSuccess: () => router.push('/') })}
                className="inline-flex items-center gap-2.5 rounded-full px-5 h-11 font-inter text-sm font-semibold whitespace-nowrap bg-white text-blush-600 hover:bg-blush-100 border border-navy-900/8 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                {logout.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </nav>
          </aside>

          <div className="min-w-0">{children(profile)}</div>
        </div>
      </div>
    </div>
  );
}

export function AddressIcon() {
  return <MapPin className="h-4 w-4" />;
}
