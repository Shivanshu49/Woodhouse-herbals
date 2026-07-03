'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/nav';

/** Section title for the current path, from the nav config (fallback: prettified segment). */
function currentSection(pathname: string): { label: string; href: string } {
  const top = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
  const match = NAV_SECTIONS.find((n) => n.href === (pathname === '/' ? '/' : top));
  if (match) return match;
  const seg = pathname.split('/').filter(Boolean)[0] ?? 'Admin';
  return { label: seg.charAt(0).toUpperCase() + seg.slice(1), href: top };
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const section = currentSection(pathname);
  const onSubPage = pathname !== section.href && section.href !== '/';

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link href="/" className="text-muted-foreground hover:text-foreground">
        Admin
      </Link>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      {onSubPage ? (
        <Fragment>
          <Link href={section.href} className="text-muted-foreground hover:text-foreground">
            {section.label}
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          <span className="font-medium text-foreground">Details</span>
        </Fragment>
      ) : (
        <span className="font-medium text-foreground">{section.label}</span>
      )}
    </nav>
  );
}
