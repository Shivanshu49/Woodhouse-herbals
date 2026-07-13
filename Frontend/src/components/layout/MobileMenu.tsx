'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  Gift,
  Heart,
  Info,
  LayoutGrid,
  Leaf,
  Minus,
  Plus,
  ScanFace,
  Sparkles,
  Store,
  Truck,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { STORE_CATEGORIES } from '@/data/categories';
import { concerns } from '@/data/concerns';
import { useHomepage } from '@/hooks/use-homepage';

/**
 * Mobile navigation drawer — a mini storefront, not a link list (July 2026
 * client round; dotandkey.com mobile menu is the reference). Live top-pick
 * bestsellers lead, then icon rows whose green-ringed circles inherit the
 * header's client-approved icon idiom, category/concern accordions on the
 * canonical data sources, and the admin-managed live offer as the footer.
 */

// The client's approved concern-tile tokens, cycled as color plates behind the
// top-pick packshots. Our product shots are full photos (not cutouts), so the
// tile reads as a ring of color around the photo — never a tint over it.
const TILE_PLATES = ['bg-tile-olive', 'bg-tile-peach', 'bg-tile-lemon', 'bg-tile-teal', 'bg-tile-butter'];

type Section = 'category' | 'concern' | null;

export function MobileMenu({ onClose, signedIn }: { onClose: () => void; signedIn: boolean }) {
  const { data, isError } = useHomepage();
  const [openSection, setOpenSection] = useState<Section>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Dialog basics for a full-height drawer: freeze the page behind it, close
  // on Escape, and keep Tab inside (aria-modal alone doesn't contain focus).
  // Cleanup restores overflow to '' — the same hard reset SmartSearch and
  // ReelsSection use, so overlapping lockers can never strand a stale lock.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // The drawer is display:none from lg up (`lg:hidden`), but it stays mounted
  // — crossing the breakpoint with it open (tablet rotation, window resize)
  // would leave the scroll lock alive with no visible UI. Close instead.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) onClose();
    };
    onChange(mq);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [onClose]);

  const topPicks = (data?.bestsellers ?? []).slice(0, 6);
  const offer = data?.offerStrip?.[0];
  // Admin free-text href — trust only site-relative paths ('//' would be
  // protocol-relative off-site); anything else falls back to the shop.
  const offerHref = offer && offer.href.startsWith('/') && !offer.href.startsWith('//') ? offer.href : '/shop';

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      {/* Tap-to-dismiss scrim — deliberately not a button: Escape and the X
          are the accessible close controls, so this stays out of tab order. */}
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-brand-forest/40 animate-overlay-in" />
      <div
        ref={panelRef}
        className="absolute left-0 top-0 flex h-full w-[88%] max-w-sm flex-col rounded-r-3xl bg-white shadow-xl animate-drawer-in"
      >
        <div className="flex items-center justify-between border-b border-navy-900/8 px-5 py-3">
          <Link href="/" onClick={onClose} aria-label="Wood House Herbals home">
            <Image
              src="/brand/logo.png"
              alt="Wood House Herbals"
              width={102}
              height={72}
              className="h-10 w-auto object-contain"
            />
          </Link>
          <button
            autoFocus
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-brand-leaf text-brand-forest hover:bg-brand-cream"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {/* Live bestsellers; skeletons while loading, hidden only on an
              outage with no cached data or an empty payload — a failed
              background refetch keeps showing the cached picks. */}
          {!(isError && data === undefined) && (data === undefined || topPicks.length > 0) && (
            <section aria-label="Top picks" className="pt-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-900">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                Top picks
              </p>
              <ul aria-busy={data === undefined} className="-mx-5 mt-3 flex gap-4 overflow-x-auto px-5 pb-1 no-scrollbar snap-x">
                {data === undefined
                  ? Array.from({ length: 4 }, (_, i) => (
                      <li key={i} className="shrink-0" aria-hidden="true">
                        <span className="flex w-[74px] flex-col items-center gap-1.5">
                          <span className="block h-[74px] w-[74px] animate-pulse rounded-full bg-cream-200" />
                          <span className="block h-[27px] w-14 animate-pulse rounded bg-cream-200" />
                        </span>
                      </li>
                    ))
                  : topPicks.map((p, i) => (
                      <li key={p.id} className="shrink-0 snap-start">
                        <Link
                          href={`/shop/${p.slug}`}
                          onClick={onClose}
                          className="group flex w-[74px] flex-col items-center gap-1.5"
                        >
                          <span
                            className={`block h-[74px] w-[74px] rounded-full p-[5px] ring-1 ring-navy-900/5 transition-shadow group-hover:shadow-lift ${TILE_PLATES[i % TILE_PLATES.length]}`}
                          >
                            <span className="relative block h-full w-full overflow-hidden rounded-full bg-white">
                              {/* Decorative — the name below labels the link. */}
                              <Image src={p.thumbnail.url} alt="" fill sizes="74px" className="object-cover" />
                            </span>
                          </span>
                          <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-navy-900">
                            {p.name}
                          </span>
                        </Link>
                      </li>
                    ))}
              </ul>
            </section>
          )}

          <nav aria-label="Menu" className="-mx-5 mt-2 divide-y divide-navy-900/8">
            <MenuRow icon={Store} label="Shop all" href="/shop" onClose={onClose} />
            <AccordionRow
              id="shop-by-category"
              icon={LayoutGrid}
              label="Shop by category"
              open={openSection === 'category'}
              onToggle={() => setOpenSection((s) => (s === 'category' ? null : 'category'))}
            >
              {STORE_CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/shop?category=${c.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-2 py-3 pl-[76px] pr-5 text-[15px] font-medium text-ink-muted transition-colors hover:text-brand-forest active:bg-cream-100"
                >
                  {c.label}
                  {c.comingSoon && <ComingSoonBadge />}
                </Link>
              ))}
            </AccordionRow>
            <AccordionRow
              id="shop-by-concern"
              icon={Leaf}
              label="Shop by concern"
              open={openSection === 'concern'}
              onToggle={() => setOpenSection((s) => (s === 'concern' ? null : 'concern'))}
            >
              {concerns.map((c) => (
                <Link
                  key={c.slug}
                  href={`/shop?concern=${c.slug}`}
                  onClick={onClose}
                  className="flex items-center gap-2 py-3 pl-[76px] pr-5 text-[15px] font-medium text-ink-muted transition-colors hover:text-brand-forest active:bg-cream-100"
                >
                  {c.title}
                  {c.comingSoon && <ComingSoonBadge />}
                </Link>
              ))}
            </AccordionRow>
            <MenuRow icon={Gift} label="Combos & gifts" href="/shop?category=combo" onClose={onClose} />
            <MenuRow icon={ScanFace} label="Skin analysis" href="/ai/skin-analysis" onClose={onClose} />
            <MenuRow icon={Truck} label="Track your order" href="/account/orders" onClose={onClose} />
            <MenuRow icon={Heart} label="Wishlist" href="/account/wishlist" onClose={onClose} />
            <MenuRow
              icon={User}
              label={signedIn ? 'My account' : 'Sign in'}
              href={signedIn ? '/account' : '/login'}
              onClose={onClose}
            />
            <MenuRow icon={Info} label="About us" href="/about" onClose={onClose} />
          </nav>
        </div>

        {offer && (
          <div className="border-t border-navy-900/8 px-5 py-4">
            <Link
              href={offerHref}
              onClick={onClose}
              className="flex min-h-11 items-center gap-2 rounded-full bg-brand-500/12 px-4 py-2.5"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              <span className="line-clamp-1 text-[13px] font-semibold text-navy-900">{offer.headline}</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ComingSoonBadge() {
  return (
    <span className="rounded-full bg-navy-900/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
      Coming soon
    </span>
  );
}

function IconRing({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-brand-leaf text-brand-forest">
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

function MenuRow({
  icon,
  label,
  href,
  onClose,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-4 px-5 py-3 transition-colors active:bg-cream-100"
    >
      <IconRing icon={icon} />
      <span className="flex-1 text-[15px] font-semibold text-brand-forest">{label}</span>
    </Link>
  );
}

function AccordionRow({
  id,
  icon,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        id={`${id}-trigger`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        className="flex w-full items-center gap-4 px-5 py-3 text-left transition-colors active:bg-cream-100"
      >
        <IconRing icon={icon} />
        <span className="flex-1 text-[15px] font-semibold text-brand-forest">{label}</span>
        {open ? (
          <Minus className="h-4 w-4 text-brand-forest" aria-hidden="true" />
        ) : (
          <Plus className="h-4 w-4 text-brand-forest" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-trigger`} className="pb-2">
          {children}
        </div>
      )}
    </div>
  );
}
