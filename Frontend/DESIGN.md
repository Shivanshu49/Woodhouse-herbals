# Wood House Herbals — Design Tokens

## Palette

Derived from the new brand reference: a soft Indian-Ayurvedic skincare aesthetic that pairs a calm mint hero with a vibrant coral accent on stars and price.

| Token            | Hex       | Usage                                                |
| ---------------- | --------- | ---------------------------------------------------- |
| `brand-mint`     | `#B8DCD6` | Hero background. Reads as fresh, herbal, calm.       |
| `brand-cream`    | `#E8F2EE` | Light section background.                            |
| `brand-teal`     | `#60B098` | Best Seller section background. Sampled from the client's packaging-style reference photo; white cards pop against it. |
| `brand-forest`   | `#0F2D24` | Primary dark text + the "Best" wordmark.             |
| `brand-leaf`     | `#2E7D32` | Logo green, primary accents, search border.          |
| `brand-coral`    | `#E94B6A` | Star ratings + price emphasis. Only accent that pops.|
| `brand-white`    | `#FFFFFF` | Card surface, primary CTA.                           |
| `brand-ink`      | `#1A1A1A` | Body copy where forest is too cold.                  |

Legacy palette (`brand-50…950`, `navy-*`, `cream`, etc.) remains in `tailwind.config.ts` so existing sections (TrustStrip, ShopByConcern, Footer, …) continue rendering. New work uses the reference-derived tokens above.

## Typography

| Role          | Family        | Weights | Notes                                  |
| ------------- | ------------- | ------- | -------------------------------------- |
| Display serif | Fraunces      | 400 / 500 / 600 / 700, italic | Hero headline, "Best _Seller_". |
| Body sans     | Inter         | 400 / 500 / 600 | Buttons, body, nav.              |

Loaded via `next/font/google` in `src/app/layout.tsx` and exposed as CSS variables `--font-display` and `--font-sans`. The italic axis is enabled for Fraunces so we can italicise the word "Seller" in the carousel heading.

## Layout primitives

- `rounded-3xl` cards.
- `rounded-full` for chips, search input, primary CTAs.
- `shadow-md → hover:shadow-xl` for product cards.
- `aspect-square` image area inside cards so different product photos read consistently.

## Component → token map

- **Hero**: `bg-brand-mint`, headline in `font-display text-white`, sub-headline in `font-display italic`, primary CTA `bg-white text-brand-forest`, secondary CTA `border-white/80 text-white`.
- **Header**: `bg-white` (sticky), nav links `font-display text-brand-forest`, search input `border-brand-leaf`, delivery icon button `bg-brand-leaf text-white`.
- **BestSellerCarousel**: section `bg-brand-teal`, heading `font-display text-brand-forest` with the word "Seller" in italic + weight 400. Cards `bg-white rounded-3xl`. Mobile shows exactly two full cards per view (`flex-[0_0_50%]`); product images render at `scale-[1.15]` inside their square frame.
- **ProductCard**: image area `aspect-square` (the source images already carry their own coloured backdrops), name `font-display uppercase`, type/size `font-sans uppercase`, ingredient line `font-sans italic`, stars `text-brand-coral`, price number `font-display text-brand-forest`.
