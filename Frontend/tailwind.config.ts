import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Herbal palette — warm, earthy, premium
        forest: {
          50: '#f1f5f2',
          100: '#dde6df',
          200: '#bccfc0',
          300: '#94b09a',
          400: '#6e9077',
          500: '#52755b',
          600: '#3e5c46',
          700: '#324a39',
          800: '#293c2f',
          900: '#1F3A2E',
          950: '#0f1d17',
        },
        cream: {
          DEFAULT: '#FAF6EE',
          50: '#fdfbf6',
          100: '#FAF6EE',
          200: '#f3ebd9',
          300: '#e9dec9',
        },
        sand: {
          DEFAULT: '#E9DEC9',
          100: '#f5efe0',
          200: '#E9DEC9',
          300: '#d8c8a8',
          400: '#bfae8a',
        },
        sage: {
          DEFAULT: '#C9D5C0',
          100: '#e6ecdf',
          200: '#C9D5C0',
          300: '#a8bb9c',
        },
        clay: {
          DEFAULT: '#C97A55',
          100: '#f3d8c9',
          200: '#e5b29a',
          300: '#C97A55',
          400: '#a5613f',
        },
        ink: {
          DEFAULT: '#1E1B17',
          muted: '#5b554d',
          subtle: '#8a8479',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Fraunces', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(2.5rem, 5vw, 4.25rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(2rem, 4vw, 3.25rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(1.5rem, 3vw, 2.25rem)', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        xl2: '1.25rem',
        '4xl': '2rem',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(31,58,46,0.04), 0 8px 24px rgba(31,58,46,0.06)',
        lift: '0 2px 6px rgba(31,58,46,0.06), 0 16px 40px rgba(31,58,46,0.10)',
        ring: '0 0 0 4px rgba(82,117,91,0.18)',
      },
      backgroundImage: {
        'hero-gradient':
          'radial-gradient(120% 80% at 90% 10%, #E9DEC9 0%, transparent 55%), linear-gradient(135deg, #FAF6EE 0%, #f1ead6 100%)',
        'leaf-pattern':
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80' opacity='0.06'><path d='M40 8c14 8 22 22 22 36S52 72 40 72 18 58 18 44 26 16 40 8z' fill='%231F3A2E'/></svg>\")",
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        marquee: 'marquee 32s linear infinite',
        shimmer: 'shimmer 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
