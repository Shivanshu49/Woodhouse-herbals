import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import '@/styles/globals.css';
import { cn } from '@/lib/cn';
import { Providers } from './providers';

const fontSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

// Fraunces is a variable font — do NOT pass both `weight` and `axes`
// (next/font/google rejects the combination). Loading it with only
// `variable` gives the full weight range, which is all the display face needs.
const fontDisplay = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: { default: 'Wood House Herbals — Admin', template: '%s · WHH Admin' },
  description: 'Store management for Wood House Herbals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(fontSans.variable, fontDisplay.variable, 'font-sans antialiased')}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
