import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from './providers';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OfferStrip } from '@/components/layout/OfferStrip';
import { SmartSearch } from '@/components/search/SmartSearch';

const fontSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

const fontDisplay = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['SOFT', 'opsz'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://woodhouseherbals.com'),
  title: {
    default: 'Wood House Herbals — Natural skincare crafted in India',
    template: '%s · Wood House Herbals',
  },
  description:
    'Modern, herbal skincare powered by Vitamin C, Niacinamide and time-tested ayurvedic botanicals. Free shipping over ₹499.',
  keywords: ['herbal skincare', 'vitamin c serum', 'natural skincare', 'ayurvedic', 'Wood House Herbals'],
  openGraph: {
    title: 'Wood House Herbals',
    description: 'Modern, herbal skincare crafted in India.',
    type: 'website',
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wood House Herbals',
    description: 'Modern, herbal skincare crafted in India.',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#FAF6EE',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontDisplay.variable}`}>
      <body>
        <Providers>
          <OfferStrip />
          <Header />
          <main id="main" className="min-h-screen">
            {children}
          </main>
          <Footer />
          <SmartSearch />
        </Providers>
      </body>
    </html>
  );
}
