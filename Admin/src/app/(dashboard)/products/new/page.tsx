'use client';

import { useCreateProduct } from '@/hooks/use-product-mutations';
import { ProductForm } from '../_form/product-form';
import { productFormToCreatePayload } from '../_form/to-create-payload';

export default function NewProductPage() {
  const create = useCreateProduct();

  return (
    <ProductForm
      mode="create"
      submitting={create.isPending}
      onSubmit={(values) => {
        // asDraft has already forced status=DRAFT in the form; the payload
        // mapper reads the (validated) values and assembles the create body.
        create.mutate(productFormToCreatePayload(values));
      }}
    />
  );
}
