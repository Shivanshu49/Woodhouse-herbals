'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

/**
 * Debounced async slug-uniqueness check against GET /admin/products/slug-check.
 * Only runs for a well-formed, non-empty slug. `excludeId` lets the edit page
 * exclude the product's own current slug.
 */
export function useSlugCheck(slug: string, excludeId?: string): { status: SlugStatus } {
  const [debounced, setDebounced] = useState(slug);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(slug), 400);
    return () => clearTimeout(id);
  }, [slug]);

  const valid = debounced.length > 0 && SLUG_RE.test(debounced);
  const query = useQuery({
    queryKey: ['slug-check', debounced, excludeId ?? null],
    queryFn: () => api.products.slugCheck(debounced, excludeId),
    enabled: valid,
    staleTime: 30_000,
    retry: false,
  });

  let status: SlugStatus = 'idle';
  if (slug.length > 0 && SLUG_RE.test(slug)) {
    if (slug !== debounced || query.isFetching) status = 'checking';
    else if (query.data?.available === true) status = 'available';
    else if (query.data?.available === false) status = 'taken';
  }

  return { status };
}
