import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone } from 'lucide-react';
import { Logo } from './Logo';
import { NewsletterForm } from './NewsletterForm';

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
    <footer className="relative mt-24 bg-navy-900 text-cream overflow-hidden">
      {/* Decorative wash */}
      <div
        className="absolute -top-20 -left-20 h-72 w-72 rounded-full blur-3xl opacity-40"
        style={{ background: 'radial-gradient(closest-side, #7AC143 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />

      {/* Newsletter band */}
      <div className="relative container-wide pt-16 pb-12 border-b border-cream/10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="max-w-xl">
            <p className="text-[11px] uppercase tracking-[0.22em] text-brand-300 font-bold mb-3">
              Join the ritual
            </p>
            <h3 className="text-display-md text-cream mb-3 leading-tight">
              Get 10% off your first order.
            </h3>
            <p className="text-cream/70 leading-relaxed">
              Skincare tips, ingredient deep-dives and member-only drops — straight to your inbox. No spam, ever.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </div>

      {/* Link grid */}
      <div className="relative container-wide grid gap-10 lg:grid-cols-12 py-14">
        <div className="lg:col-span-4">
          <div className="inline-flex rounded-2xl bg-cream/8 p-4 border border-cream/10">
            <Logo light />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-cream/70 max-w-sm">
            Wood House Herbals — authentic, modern skincare crafted with ancient botanicals and science-backed actives. Made in India, loved across the country.
          </p>
          <div className="mt-5 flex items-center gap-2">
            {[
              { Icon: Facebook,  label: 'Facebook',  href: '#' },
              { Icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/woodhouseherbals/' },
              { Icon: Linkedin,  label: 'LinkedIn',  href: '#' },
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
                Simran Sapphire, Plot 364, Sector 34C Kharghar, Navi Mumbai, MAHARASHTRA – 410210
              </span>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-brand-300" />
              <span>
                <strong className="block text-cream/90 font-semibold">Regional Office</strong>
                Suncity, Dixit Nagar, Nagpur, MAHARASHTRA – 440026
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
