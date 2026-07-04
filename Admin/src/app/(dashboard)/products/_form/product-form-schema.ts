import { z } from 'zod';

/** Mirrors the backend SLUG_RE (create/update DTO). */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
};
