import { z } from 'zod';
import { GST_RATE_VALUES, rupeesToPaise } from './pricing';
import { parseCount, parseDimension } from './inventory';
import {
  BADGE_LABEL_MAX_LENGTH,
  BADGE_TONE_VALUES,
  PRODUCT_CATEGORY_VALUES,
  SKIN_TYPE_VALUES,
  TAG_MAX_LENGTH,
} from './organization';

/** Mirrors the backend SLUG_RE (create/update DTO). */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Backend money/count columns are 32-bit signed Int (paise or units); anything
 *  above this overflows the column (Postgres raises "integer out of range"). */
const INT4_MAX = 2_147_483_647;
const SHIPPING_CLASS_MAX = 50;

export const PRODUCT_STATUS_VALUES = ['DRAFT', 'PUBLISHED', 'SCHEDULED'] as const;

/**
 * One uploaded product image. The array order is meaningful: `images[0]` is the
 * main/thumbnail image, the rest become the gallery (their sort order follows
 * the array index). `publicId` is the Cloudinary asset id — it lets the form
 * delete an image the moment it is removed, and it is scoped to `woodhouse/…`.
 */
export const productImageSchema = z.object({
  url: z.string().url(),
  publicId: z.string(),
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type ProductImageInput = z.infer<typeof productImageSchema>;

/** Strip HTML so a rich-text field can be checked for *actual* content
 *  (an "empty" Tiptap doc is still `<p></p>`). */
export function richTextToPlain(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The product form's validation schema — the single source of truth shared by
 * the create and (later) edit pages. Grows one section at a time; GROUP 1 is
 * the Core section.
 */
export const productFormSchema = z
  .object({
    // ── GROUP 1 · Core ────────────────────────────────────────────────
    name: z.string().trim().min(1, 'Product name is required').max(200, 'Keep it under 200 characters'),
    slug: z
      .string()
      .trim()
      .min(1, 'Slug is required')
      .max(200, 'Keep it under 200 characters')
      .regex(SLUG_RE, 'Lowercase letters, numbers and single dashes only'),
    sku: z.string().trim().min(1, 'SKU is required').max(64, 'Keep it under 64 characters'),
    shortDescription: z
      .string()
      .trim()
      .min(1, 'Short description is required')
      .max(200, 'Keep it under 200 characters'),
    longDescription: z.string(),
    status: z.enum(PRODUCT_STATUS_VALUES),
    publishAt: z.string(),
    featured: z.boolean(),
    bestSeller: z.boolean(),

    // ── GROUP 2 · Media ───────────────────────────────────────────────
    images: z.array(productImageSchema).max(12, 'Up to 12 images'),

    // ── GROUP 3 · Pricing & Tax ───────────────────────────────────────
    // Amounts are entered in rupees (text) and validated/stored as integer
    // paise; the empty string means "not set" for the optional ones.
    price: z.string(),
    compareAtPrice: z.string(),
    costPrice: z.string(),
    gstRate: z.enum(GST_RATE_VALUES),
    hsnCode: z.string(),
    saleStartsAt: z.string(),
    saleEndsAt: z.string(),

    // ── GROUP 4 · Inventory & Shipping ────────────────────────────────
    trackInventory: z.boolean(),
    stockQty: z.string(),
    lowStockThreshold: z.string(),
    allowBackorder: z.boolean(),
    weightGrams: z.string(),
    lengthCm: z.string(),
    widthCm: z.string(),
    heightCm: z.string(),
    shippingClass: z.string(),
    freeShipping: z.boolean(),

    // ── GROUP 5 · Organization ────────────────────────────────────────
    category: z.string(), // ProductCategory enum, required (checked in superRefine)
    categoryIds: z.array(z.string()),
    concernIds: z.array(z.string()),
    skinTypes: z.array(z.enum(SKIN_TYPE_VALUES)),
    tags: z.array(z.string().trim().min(1).max(TAG_MAX_LENGTH, `Keep tags under ${TAG_MAX_LENGTH} characters`)),
    badges: z.array(
      z.object({
        label: z.string().trim().min(1, 'Badge label is required').max(BADGE_LABEL_MAX_LENGTH),
        tone: z.enum(BADGE_TONE_VALUES),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (richTextToPlain(v.longDescription).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['longDescription'],
        message: 'Full description is required',
      });
    }
    // A main image (images[0]) is required to put a product on the storefront,
    // but a draft can be saved without one. PUBLISHED and SCHEDULED both go
    // live, so both require at least one image.
    if (v.status !== 'DRAFT' && v.images.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['images'],
        message: 'Add a main image before publishing — or save as a draft.',
      });
    }
    if (v.status === 'SCHEDULED') {
      if (!v.publishAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['publishAt'],
          message: 'Pick a publish date & time',
        });
      } else if (new Date(v.publishAt).getTime() <= Date.now()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['publishAt'],
          message: 'Publish date must be in the future',
        });
      }
    }

    // ── Pricing & Tax ──
    const AMOUNT_MSG = 'Enter a valid amount (max 2 decimal places)';
    const MAX_PAISE = INT4_MAX;
    const TOO_LARGE = 'Amount is too large';
    const pricePaise = rupeesToPaise(v.price);
    if (v.price.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Price is required' });
    } else if (pricePaise === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: AMOUNT_MSG });
    } else if (pricePaise <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Price must be greater than 0' });
    } else if (pricePaise > MAX_PAISE) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: TOO_LARGE });
    }

    if (v.compareAtPrice.trim() !== '') {
      const c = rupeesToPaise(v.compareAtPrice);
      if (c === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compareAtPrice'], message: AMOUNT_MSG });
      } else if (c > MAX_PAISE) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['compareAtPrice'], message: TOO_LARGE });
      } else if (pricePaise !== null && c <= pricePaise) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['compareAtPrice'],
          message: 'Compare-at must be higher than the price',
        });
      }
    }

    if (v.costPrice.trim() !== '') {
      const cost = rupeesToPaise(v.costPrice);
      if (cost === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['costPrice'], message: AMOUNT_MSG });
      } else if (cost > MAX_PAISE) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['costPrice'], message: TOO_LARGE });
      }
    }

    if (v.hsnCode.trim() !== '' && !/^\d{4,8}$/.test(v.hsnCode.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hsnCode'], message: 'HSN code must be 4–8 digits' });
    }

    if (v.saleEndsAt && !v.saleStartsAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['saleStartsAt'], message: 'Set a start date for the sale' });
    }
    if (v.saleStartsAt && v.saleEndsAt && new Date(v.saleEndsAt).getTime() <= new Date(v.saleStartsAt).getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['saleEndsAt'], message: 'Sale end must be after the start' });
    }

    // ── Inventory & Shipping ──
    const COUNT_MSG = 'Enter a whole number';
    const DIM_MSG = 'Enter a valid measurement (max 2 decimal places)';
    for (const field of ['stockQty', 'lowStockThreshold', 'weightGrams'] as const) {
      // Stock fields only apply (and are only validated) when tracking is on —
      // otherwise a stale value in a disabled field would block submit.
      if (!v.trackInventory && field !== 'weightGrams') continue;
      const raw = v[field];
      if (raw.trim() === '') continue;
      const n = parseCount(raw);
      if (n === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: COUNT_MSG });
      } else if (n > INT4_MAX) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: 'Number is too large' });
      }
    }
    for (const field of ['lengthCm', 'widthCm', 'heightCm'] as const) {
      if (v[field].trim() !== '' && parseDimension(v[field]) === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: DIM_MSG });
      }
    }
    if (v.shippingClass.trim().length > SHIPPING_CLASS_MAX) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['shippingClass'],
        message: `Keep it under ${SHIPPING_CLASS_MAX} characters`,
      });
    }

    // ── Organization ──
    if (!PRODUCT_CATEGORY_VALUES.includes(v.category)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['category'], message: 'Select a category' });
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const DEFAULT_PRODUCT_FORM_VALUES: ProductFormValues = {
  name: '',
  slug: '',
  sku: '',
  shortDescription: '',
  longDescription: '',
  status: 'DRAFT',
  publishAt: '',
  featured: false,
  bestSeller: false,
  images: [],
  price: '',
  compareAtPrice: '',
  costPrice: '',
  gstRate: 'GST_18',
  hsnCode: '',
  saleStartsAt: '',
  saleEndsAt: '',
  trackInventory: true,
  stockQty: '',
  lowStockThreshold: '',
  allowBackorder: false,
  weightGrams: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  shippingClass: '',
  freeShipping: false,
  category: '',
  categoryIds: [],
  concernIds: [],
  skinTypes: [],
  tags: [],
  badges: [],
};
