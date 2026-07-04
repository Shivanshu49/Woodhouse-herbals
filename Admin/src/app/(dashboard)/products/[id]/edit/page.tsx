'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProduct } from '@/hooks/use-products';
import { useUpdateProduct } from '@/hooks/use-product-mutations';
import { ProductForm } from '../../_form/product-form';
import { productToFormValues } from '../../_form/to-form-values';
import { productFormToUpdatePayload } from '../../_form/to-create-payload';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useProduct(id);
  const update = useUpdateProduct(id);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading product…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-5xl py-24 text-center">
        <h1 className="font-display text-xl font-semibold">Product not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'It may have been deleted.'}
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" /> Back to products
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <ProductForm
      mode="edit"
      productId={id}
      defaultValues={productToFormValues(data)}
      submitting={update.isPending}
      onSubmit={(values) => update.mutate(productFormToUpdatePayload(values))}
    />
  );
}
