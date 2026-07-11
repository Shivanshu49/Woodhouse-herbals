import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react';

const HELP = [
  { label: 'Privacy Policy', href: '/policies/privacy' },
  { label: 'Refund & Returns', href: '/policies/refunds' },
  { label: 'Shipping Policy', href: '/policies/shipping' },
  { label: 'Terms of Use', href: '/policies/terms' },
  { label: 'About Us', href: '/about' },
  { label: 'FAQs', href: '/faqs' },
];

const CATEGORIES = [
  { label: 'Shop All', href: '/shop' },
  { label: 'Cart', href: '/cart' },
  { label: 'Checkout', href: '/checkout' },
  { label: 'My Account', href: '/account' },
  { label: 'My Orders', href: '/account/orders' },
  { label: 'Track Order', href: '/account/orders' },
  { label: 'Wishlist', href: '/account/wishlist' },
];

export function Footer() {
  return (
    <footer className="relative mt-12 sm:mt-24 bg-navy-900 text-cream overflow-hidden">
      {/* Decorative wash */}
      <div
        className="absolute -top-20 -left-20 h-72 w-72 rounded-full blur-3xl opacity-40"
        style={{ background: 'radial-gradient(closest-side, #7AC143 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

      {/* Link grid */}
      <div className="relative container-wide grid gap-10 lg:grid-cols-12 py-14">
        <div className="lg:col-span-4">
          {/* Solid cream card — the packaging logo is navy-on-transparent and
              would vanish straight on the navy footer. */}
          <Link
            href="/"
            aria-label="Wood House Herbals home"
            className="inline-flex rounded-xl bg-cream p-2.5 shadow-soft"
          >
            <Image
              src="/brand/logo.png"
              alt="Wood House Herbals"
              width={135}
              height={96}
              className="h-12 w-auto"
            />
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-cream/70 max-w-sm">
            Wood House skincare: authentic, contemporary skincare crafted with fruits and root extracts. Made in Bharat, loved across the globe.
          </p>
          <div className="mt-5 flex items-center gap-2">
            {[
              { Icon: Facebook,  label: 'Facebook',  href: 'https://www.facebook.com/vedicgloryhealth' },
              { Icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/woodhouseherbals/' },
              { Icon: Linkedin,  label: 'LinkedIn',  href: 'https://www.linkedin.com/company/woodhouseskin/' },
            ].map(({ Icon, label, href }) => (
              <a
                key={label}
                aria-label={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/15 hover:border-brand-500 hover:bg-brand-500/15 transition-colors"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
            <a
              href="https://www.instagram.com/woodhouseherbals/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 text-sm text-cream/70 hover:text-brand-300 transition-colors"
            >
              @woodhouseherbals
            </a>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-cream font-display text-base mb-4 font-semibold">Help</h4>
          <ul className="space-y-2.5">
            {HELP.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-cream/70 hover:text-brand-300">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-cream font-display text-base mb-4 font-semibold">Categories</h4>
          <ul className="space-y-2.5">
            {CATEGORIES.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className="text-sm text-cream/70 hover:text-brand-300">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4">
          <h4 className="text-cream font-display text-base mb-4 font-semibold">Connect</h4>
          <ul className="space-y-3 text-sm text-cream/70">
            <li className="flex items-start gap-3">
              <Phone className="h-4 w-4 mt-0.5 text-brand-300" />
              <a href="tel:+919819488857" className="hover:text-brand-300">
                +91 98194 88857
              </a>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="h-4 w-4 mt-0.5 text-brand-300" />
              <a href="mailto:info@woodhouseherbals.com" className="hover:text-brand-300">
                info@woodhouseherbals.com
              </a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-brand-300" />
              <span>
                <strong className="block text-cream/90 font-semibold">VedicGlory Healthcare</strong>
                Simran Sapphire, Plot 3 & 4, Sector 34C Kharghar, Navi Mumbai, MAHARASHTRA - 410210
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="relative border-t border-cream/10">
        <div className="container-wide flex flex-col sm:flex-row items-center justify-between gap-2 py-6 text-xs text-cream/60">
          <p>© {new Date().getFullYear()} Wood House Herbals · VedicGlory Healthcare. All rights reserved.</p>
          <p>Crafted with care · Made in India</p>
        </div>
      </div>
    </footer>
  );
}
