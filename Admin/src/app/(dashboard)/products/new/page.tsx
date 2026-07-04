'use client';

import { toast } from 'sonner';
import { ProductForm } from '../_form/product-form';

export default function NewProductPage() {
  return (
    <ProductForm
      mode="create"
      onSubmit={(values, { asDraft }) => {
        // GROUPS 1–3 are validation-only. The real POST /admin/products is
        // wired once the remaining sections (organization / SEO / …) supply
        // the other fields.
        toast.success(
          `Valid ✓ — status “${values.status}”${asDraft ? ' (draft)' : ''}, ${values.images.length} image${values.images.length === 1 ? '' : 's'}, ₹${values.price || '—'}. Remaining sections come next.`,
        );
      }}
    />
  );
}
