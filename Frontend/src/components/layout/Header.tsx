'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { Logo } from './Logo';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import { useUiStore } from '@/store/ui';
import { cn } from '@/lib/cn';

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop All', href: '/shop' },
  { label: 'Combo Packs', href: '/shop?category=combo' },
  { label: 'Skin', href: '/shop?category=face-wash' },
  { label: 'Hair', href: '/shop?category=hair-oil' },
  { label: 'About', href: '/about' },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const cartCount = useCartStore((s) => s.lines.reduce((acc, l) => acc + l.quantity, 0));
  const wishCount = useWishlistStore((s) => s.ids.length);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const safeCartCount = mounted ? cartCount : 0;
  const safeWishCount = mounted ? wishCount : 0;

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-cream/85 backdrop-blur-md border-b border-forest-900/5 shadow-soft'
          : 'bg-cream/0',
      )}
    >
      <div className="container-wide flex h-16 sm:h-20 items-center justify-between gap-4">
        {/* Left: mobile menu + logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-full text-forest-900 hover:bg-forest-900/5"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo />
        </div>

        {/* Center: desktop nav */}
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 text-sm font-medium text-ink hover:text-forest-900 rounded-full hover:bg-forest-900/5 transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-900 hover:bg-forest-900/5"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            href="/account/wishlist"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-900 hover:bg-forest-900/5"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
            {safeWishCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-clay-300 px-1 text-[10px] font-semibold text-white">
                {safeWishCount}
              </span>
            )}
          </Link>
          <Link
            href="/account"
            className="hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-900 hover:bg-forest-900/5"
            aria-label="Account"
          >
            <User className="h-5 w-5" />
          </Link>
          <Link
            href="/cart"
            className="relative inline-flex h-10 items-center gap-2 rounded-full bg-forest-900 px-4 text-cream hover:bg-forest-800"
            aria-label={`Cart with ${safeCartCount} items`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="text-sm font-medium hidden sm:inline">Cart</span>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-cream/15 px-1.5 text-[11px] font-semibold">
              {safeCartCount}
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-cream p-6 shadow-lift animate-fade-up">
            <div className="flex items-center justify-between mb-8">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-2 text-ink-muted hover:bg-forest-900/5"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-2xl px-4 py-3 text-base font-medium text-forest-900 hover:bg-forest-900/5"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/career"
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-base font-medium text-forest-900 hover:bg-forest-900/5"
              >
                Career
              </Link>
              <Link
                href="/distributorship"
                onClick={() => setMobileOpen(false)}
                className="rounded-2xl px-4 py-3 text-base font-medium text-forest-900 hover:bg-forest-900/5"
              >
                Distributorship
              </Link>
            </nav>
            <div className="mt-8 rounded-3xl bg-sand-100 p-5">
              <p className="text-xs uppercase tracking-wider text-ink-muted mb-1">Need help?</p>
              <p className="font-display text-lg text-forest-900">+91 98194 88857</p>
              <p className="text-sm text-ink-muted mt-1">info@woodhouseherbals.com</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
