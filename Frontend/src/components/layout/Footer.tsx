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
  { label: 'Shop', href: '/shop' },
  { label: 'Cart', href: '/cart' },
  { label: 'Checkout', href: '/checkout' },
  { label: 'My Account', href: '/account' },
  { label: 'My Orders', href: '/account/orders' },
  { label: 'Track Order', href: '/account/orders' },
  { label: 'Wishlist', href: '/account/wishlist' },
];

export function Footer() {
  return (
    <footer className="relative mt-24 bg-forest-900 text-cream">
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-sage-200/40 to-transparent" />

      {/* Newsletter band */}
      <div className="container-wide pt-16 pb-12 border-b border-cream/10">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.28em] text-sage-200 mb-3">Join the ritual</p>
            <h3 className="text-display-md text-cream mb-3">Get 10% off your first order.</h3>
            <p className="text-cream/70">
              Skincare tips, ingredient deep-dives and member-only drops — straight to your inbox. No spam, ever.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </div>

      {/* Link grid */}
      <div className="container-wide grid gap-10 lg:grid-cols-12 py-14">
        <div className="lg:col-span-4">
          <div className="bg-cream/5 inline-flex rounded-2xl p-4">
            <Logo />
          </div>
          <p className="mt-5 text-sm leading-relaxed text-cream/70 max-w-sm">
            Wood House Herbals — modern, herbal skincare crafted with ancient botanicals and modern actives.
            Made in India, loved worldwide.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <a aria-label="Facebook" href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream/15 hover:bg-cream/10">
              <Facebook className="h-4 w-4" />
            </a>
            <a aria-label="Instagram" href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream/15 hover:bg-cream/10">
              <Instagram className="h-4 w-4" />
            </a>
            <a aria-label="LinkedIn" href="#" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-cream/15 hover:bg-cream/10">
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-cream font-display text-base mb-4">Help</h4>
          <ul className="space-y-2.5">
            {HELP.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-cream/70 hover:text-cream">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-2">
          <h4 className="text-cream font-display text-base mb-4">Categories</h4>
          <ul className="space-y-2.5">
            {CATEGORIES.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-cream/70 hover:text-cream">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-4">
          <h4 className="text-cream font-display text-base mb-4">Connect</h4>
          <ul className="space-y-3 text-sm text-cream/70">
            <li className="flex items-start gap-3">
              <Phone className="h-4 w-4 mt-0.5 text-sage-200" />
              <a href="tel:+919819488857" className="hover:text-cream">+91 98194 88857</a>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="h-4 w-4 mt-0.5 text-sage-200" />
              <a href="mailto:info@woodhouseherbals.com" className="hover:text-cream">info@woodhouseherbals.com</a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-sage-200" />
              <span>
                <strong className="block text-cream/90">VedicGlory Healthcare</strong>
                Simran Sapphire, Plot 364, Sector 34C Kharghar, Navi Mumbai, MAHARASHTRA – 410210
              </span>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-sage-200" />
              <span>
                <strong className="block text-cream/90">Regional Office</strong>
                Suncity, Dixit Nagar, Nagpur, MAHARASHTRA – 440026
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-cream/10">
        <div className="container-wide flex flex-col sm:flex-row items-center justify-between gap-2 py-6 text-xs text-cream/60">
          <p>© {new Date().getFullYear()} Wood House Herbals · VedicGlory Healthcare. All rights reserved.</p>
          <p>Crafted with care · Made in India</p>
        </div>
      </div>
    </footer>
  );
}
