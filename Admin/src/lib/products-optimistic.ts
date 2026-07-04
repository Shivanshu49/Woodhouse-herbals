import type {
  AdminProductListParams,
  AdminProductRow,
  AdminProductsList,
  BulkProductsBody,
} from '@/types/product';
// Relative (not '@/') so the tsx test runner resolves this runtime import;
// product-meta has no runtime dependencies of its own.
import { stockBucketFor } from './product-meta';

/**
 * Pure optimistic-cache reducers for the products list. Each takes one cached
 * list *view* (the data for a single query key) plus that view's params, and
 * returns the view as it should look immediately after the mutation — before
 * the server confirms. Kept pure and param-aware so a change is reflected only
 * in the views where it is actually visible (e.g. archiving a row removes it
 * from a live view but adds it to an archived view). See the test file.
 */

/** Apply a bulk action to a single cached list view. */
export function applyBulkToView(
  view: AdminProductsList,
  body: BulkProductsBody,
  params: AdminProductListParams,
  now: string,
): AdminProductsList {
  const ids = new Set(body.ids);
  const archivedView = params.deleted === true;
  let removed = 0;
  const items: AdminProductRow[] = [];

  for (const row of view.items) {
    if (!ids.has(row.id)) {
      items.push(row);
      continue;
    }
    switch (body.action) {
      case 'publish':
      case 'draft': {
        const status = body.action === 'publish' ? 'PUBLISHED' : 'DRAFT';
        // Leaves a view that filters to a different status.
        if (params.status && params.status !== status) {
          removed++;
          break;
        }
        items.push({ ...row, status });
        break;
      }
      case 'archive': {
        // Archiving removes the row from every live view; it belongs only in
        // archived views.
        if (!archivedView) {
          removed++;
          break;
        }
        items.push({ ...row, deletedAt: now });
        break;
      }
      case 'restore': {
        // Restoring removes the row from archived views.
        if (archivedView) {
          removed++;
          break;
        }
        items.push(row);
        break;
      }
      default:
        // set-category changes the relational category link, which the summary
        // row does not display — no optimistic change.
        items.push(row);
    }
  }

  return { ...view, items, total: Math.max(0, view.total - removed) };
}

/**
 * Remove a single product id from a view. `appliesWhenArchived` selects which
 * views it targets: false for delete (removes from live views), true for
 * restore (removes from archived views).
 */
export function dropIdFromView(
  view: AdminProductsList,
  id: string,
  appliesWhenArchived: boolean,
  params: AdminProductListParams,
): AdminProductsList {
  const archivedView = params.deleted === true;
  if (archivedView !== appliesWhenArchived) return view;
  if (!view.items.some((row) => row.id === id)) return view;
  return {
    ...view,
    items: view.items.filter((row) => row.id !== id),
    total: Math.max(0, view.total - 1),
  };
}

/**
 * Reflect a new absolute stock quantity for one product in a view. If the view
 * is filtered by stock level and the new quantity leaves that bucket (e.g. an
 * out-of-stock row restocked to 40 while the "Out of stock" filter is active),
 * the row is dropped and the total decremented instead of lingering with a
 * value that contradicts the filter; the follow-up refetch reconciles fully.
 */
export function adjustStockInView(
  view: AdminProductsList,
  productId: string,
  newQty: number,
  params: AdminProductListParams,
): AdminProductsList {
  const stockFilter = params.stock;
  let changed = false;
  let removed = 0;
  const items: AdminProductRow[] = [];

  for (const row of view.items) {
    if (row.id !== productId) {
      items.push(row);
      continue;
    }
    changed = true;
    if (stockFilter && stockBucketFor(newQty) !== stockFilter) {
      removed++;
      continue;
    }
    items.push({ ...row, stockQty: newQty, inStock: newQty > 0 });
  }

  if (!changed) return view;
  return { ...view, items, total: Math.max(0, view.total - removed) };
}
