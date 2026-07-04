'use client';

import { createContext, useContext } from 'react';

/** Form-wide meta the sections need: create vs edit, and (in edit) the product
 *  id — used for the slug-check excludeId and to make stock read-only. */
export interface ProductFormMeta {
  mode: 'create' | 'edit';
  productId?: string;
}

export const ProductFormMetaContext = createContext<ProductFormMeta>({ mode: 'create' });

export function useProductFormMeta() {
  return useContext(ProductFormMetaContext);
}
