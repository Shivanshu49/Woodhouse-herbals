'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, ShoppingBag, Truck, User } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { useUiStore } from '@/store/ui';
import { useProfile } from '@/hooks/use-auth';
import { cn } from '@/lib/cn';
import { MobileMenu } from './MobileMenu';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Product', href: '/shop' },
  { label: 'Others', href: '/about' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  // Stable identity — MobileMenu keys its scroll-lock/focus effects on this.
  const closeMenu = useCallback(() => {
    setMobileOpen(false);
    // Restore keyboard position to the trigger — focus() runs before React
    // commits the unmount, so it survives the drawer's removal.
    menuTriggerRef.current?.focus();
  }, []);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const cartCount = useCartStore((s) => s.lines.reduce((acc, l) => acc + l.quantity, 0));
  const { data: profile } = useProfile();
  const signedIn = mounted && Boolean(profile);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const safeCartCount = mounted ? cartCount : 0;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 bg-white transition-shadow duration-200',
        scrolled ? 'shadow-[0_1px_3px_rgba(15,45,36,0.08)]' : 'shadow-none',
      )}
    >
      <div className="mx-auto max-w-7xl flex h-20 items-center justify-between gap-3 md:gap-6 px-4 sm:px-6 md:px-10">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            ref={menuTriggerRef}
            onClick={() => setMobileOpen(true)}
            className="-ml-1 inline-flex lg:hidden h-11 w-11 items-center justify-center rounded-full text-brand-forest hover:bg-brand-cream"
            aria-label="Open menu"
          >
            {/* Bespoke menu glyph (July 2026 round — client asked for a larger,
                characterful mark): three rounded strokes stepping down in
                length, the middle finished with the brand's green dot — the
                same dot the eyebrow labels and the logo's green "oo" carry. */}
            <svg viewBox="0 0 28 28" className="h-8 w-8" fill="none" aria-hidden="true">
              <path d="M4 7.5h20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M4 14h13.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="21.75" cy="14" r="1.9" className="fill-brand-500" />
              <path d="M4 20.5h9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/" className="flex items-center" aria-label="Wood House Herbals home">
            {/* Asset is the tight-trimmed 677x480 brand lockup; props stay a
                2x display target in that exact ratio so the box hint can't
                stretch it — height alone scales it (client: bigger, not
                wider). On sub-390px phones the header row overflows and flex
                shrinks this img's width while h-14 pins its height, squashing
                the letterforms — object-contain keeps them proportional if
                that ever happens again. */}
            <Image
              src="/brand/logo.png"
              alt="Wood House Herbals"
              width={158}
              height={112}
              priority
              className="h-14 w-auto object-contain"
            />
          </Link>
        </div>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-display font-medium text-brand-forest text-base hover:text-brand-leaf transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex flex-1 max-w-md mx-2">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchOpen(true);
            }}
            className="relative w-full"
          >
            <Search className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-forest/60" />
            <input
              type="search"
              placeholder="Find your preferred product"
              aria-label="Search products"
              onFocus={() => setSearchOpen(true)}
              className="w-full h-11 rounded-full border-2 border-brand-leaf bg-white pl-11 pr-5 font-inter text-sm text-brand-forest placeholder:text-brand-forest/50 outline-none focus:ring-2 focus:ring-brand-leaf/30"
            />
          </form>
        </div>

        <div className="flex items-center gap-2">
          {/* Client (July round four): every navbar icon sits in a simple
              green outlined circle — no fill, truck included. */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-leaf text-brand-forest hover:bg-brand-cream"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            href="/account/orders"
            aria-label="Order tracking"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-leaf text-brand-forest hover:bg-brand-cream transition-colors"
          >
            <Truck className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            aria-label={`Cart with ${safeCartCount} items`}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-leaf text-brand-forest hover:bg-brand-cream"
          >
            <ShoppingBag className="h-5 w-5" />
            {safeCartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-coral px-1 text-[10px] font-bold text-white">
                {safeCartCount}
              </span>
            )}
          </Link>
          <Link
            href={signedIn ? '/account' : '/login'}
            aria-label={signedIn ? 'My account' : 'Sign in'}
            title={signedIn ? `Signed in as ${profile?.fullName}` : 'Sign in'}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand-leaf text-brand-forest hover:bg-brand-cream"
          >
            <User className="h-5 w-5" />
            {signedIn && (
              <span
                // top-2/right-2 keeps the dot + its white ring inside the
                // button's new green border (outer reach 14.5px < 18px inner
                // border edge) — at top-1 it fused with the same-color ring.
                className="absolute top-2 right-2 h-2 w-2 rounded-full bg-brand-leaf ring-2 ring-white"
                aria-hidden="true"
              />
            )}
          </Link>
        </div>
      </div>

      {mobileOpen && <MobileMenu onClose={closeMenu} signedIn={signedIn} />}
    </header>
  );
}
