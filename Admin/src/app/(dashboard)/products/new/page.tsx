'use client';

import { toast } from 'sonner';
import { ProductForm } from '../_form/product-form';

export default function NewProductPage() {
  return (
    <ProductForm
      mode="create"
      onSubmit={(values, { asDraft }) => {
        // GROUPS 1–2 are validation-only. The real POST /admin/products is
        // wired once the remaining sections (pricing / organization / …)
        // supply the other required fields.
        toast.success(
          `Valid ✓ — status “${values.status}”${asDraft ? ' (draft)' : ''}, ${values.images.length} image${values.images.length === 1 ? '' : 's'}. Remaining sections come next.`,
        );
      }}
    />
  );
}
