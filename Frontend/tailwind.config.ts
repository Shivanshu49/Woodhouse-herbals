import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Reference-derived palette for the new Hero + BestSellerCarousel sections.
        // See DESIGN.md for rationale. Kept additive — legacy tokens below stay intact.
        'brand-mint':   '#B8DCD6',
        'brand-cream':  '#E8F2EE',
        'brand-teal':   '#60B098',
        'brand-forest': '#0F2D24',
        'brand-leaf':   '#2E7D32',
        'brand-coral':  '#E94B6A',
        'brand-white':  '#FFFFFF',
        'brand-ink':    '#1A1A1A',
        // Wood House brand palette — derived from the logo and packaging:
        //   - the "oo" infinity ring → vibrant herbal green
        //   - the wordmark letters    → deep navy/teal
        //   - packaging backgrounds   → warm cream
        //   - per-range accents       → citrus / violet / charcoal / blush / sun
        brand: {
          50:  '#f3fbe9',
          100: '#e3f6cc',
          200: '#c8ed9b',
          300: '#a7e167',
          400: '#8ad447',
          500: '#7AC143',   // primary herbal green (logo "oo")
          600: '#5fa430',
          700: '#487d25',
          800: '#3a6320',
          900: '#2f521e',
          950: '#16310e',
        },
        navy: {
          50:  '#eff7fb',
          100: '#daecf2',
          200: '#b6d8e4',
          300: '#85bbd0',
          400: '#5298b6',
          500: '#377d9c',
          600: '#296384',
          700: '#23506c',
          800: '#1F4360',
          900: '#1B3F5E',   // primary navy (logo letters)
          950: '#0e2336',
        },
        cream: {
          DEFAULT: '#FAF7F2',
          50:  '#fefdfb',
          100: '#FAF7F2',
          200: '#f3ecdf',
          300: '#e8dec8',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted:   '#475569',
          subtle:  '#94a3b8',
        },
        // Client-specified "Shop by concern" tile backgrounds (July 2026 feedback
        // round). Cycled in order: olive → peach → lemon → teal → butter.
        // Product photos render at original colors ON these — never blended.
        tile: {
          olive:  '#A5AF79',
          peach:  '#FFBDA3',
          lemon:  '#FAFFC4',
          teal:   '#34A99D',
          butter: '#FFF3C8',
        },
        // Category accents (used sparingly for chips, badges, gradients)
        citrus:    { DEFAULT: '#F5A524', 100: '#fff2d6', 600: '#c97f10' },
        violet:    { DEFAULT: '#7C5CCB', 100: '#ece4ff', 600: '#5a3eaa' },
        charcoal:  { DEFAULT: '#1F2937', 100: '#e5e7eb' },
        blush:     { DEFAULT: '#F76C8B', 100: '#ffe3eb', 600: '#cf3f60' },
        sun:       { DEFAULT: '#FFC940', 100: '#fff4d2' },
        // Legacy alias — keep so any code still referencing forest/sand/sage compiles.
        forest: {
          50:  '#eff7fb',
          100: '#daecf2',
          500: '#377d9c',
          700: '#23506c',
          800: '#1F4360',
          900: '#1B3F5E',
        },
        sand:  { DEFAULT: '#f3ecdf', 100: '#fefdfb', 200: '#f3ecdf' },
        sage:  { DEFAULT: '#e3f6cc', 100: '#f3fbe9', 200: '#e3f6cc', 300: '#c8ed9b' },
        clay:  { DEFAULT: '#F5A524', 100: '#fff2d6', 300: '#F5A524', 400: '#c97f10' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)',    'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        inter:   ['var(--font-inter)',   'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['clamp(3rem, 6.5vw, 5.25rem)', { lineHeight: '0.98', letterSpacing: '-0.025em' }],
        'display-xl':  ['clamp(2.5rem, 5.5vw, 4.5rem)', { lineHeight: '1.02', letterSpacing: '-0.022em' }],
        'display-lg':  ['clamp(2rem, 4vw, 3.25rem)',    { lineHeight: '1.08', letterSpacing: '-0.02em' }],
        'display-md':  ['clamp(1.6rem, 3vw, 2.4rem)',   { lineHeight: '1.14', letterSpacing: '-0.015em' }],
      },
      borderRadius: {
        xl2: '1.25rem',
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      boxShadow: {
        soft:  '0 1px 2px rgba(15,23,42,0.04), 0 6px 24px rgba(15,23,42,0.06)',
        lift:  '0 4px 12px rgba(15,23,42,0.06), 0 18px 44px rgba(15,23,42,0.12)',
        glow:  '0 12px 40px rgba(122,193,67,0.25)',
        ring:  '0 0 0 4px rgba(122,193,67,0.22)',
      },
      backgroundImage: {
        // Vibrant hero — green pool top-left, warm cream base
        'hero-gradient':
          'radial-gradient(80% 60% at 0% 0%, rgba(122,193,67,0.28) 0%, transparent 60%), radial-gradient(70% 50% at 100% 10%, rgba(255,201,64,0.22) 0%, transparent 55%), linear-gradient(180deg, #FAF7F2 0%, #FFFDF7 100%)',
        'brand-gradient':
          'linear-gradient(135deg, #7AC143 0%, #5fa430 100%)',
        'navy-gradient':
          'linear-gradient(135deg, #1B3F5E 0%, #23506c 100%)',
        'leaf-pattern':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80' opacity='0.08'><path d='M40 6c14 9 22 22 22 36S52 74 40 74 18 60 18 42 26 15 40 6z M40 6c0 22 0 50 0 68' fill='none' stroke='%237AC143' stroke-width='1.5'/></svg>\")",
      },
      // Allow finer-grained opacity than Tailwind's default 5-step scale.
      // We use /8 and /12 a lot for very subtle backgrounds and borders.
      opacity: {
        '8': '0.08',
        '12': '0.12',
        '18': '0.18',
        '22': '0.22',
        '92': '0.92',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'drawer-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'overlay-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.55s ease-out both',
        marquee: 'marquee 36s linear infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'drawer-in': 'drawer-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both',
        'overlay-in': 'overlay-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
