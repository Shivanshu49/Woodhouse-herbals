/**
 * Derive audit identifiers from NestJS controller/handler names:
 *   ('AdminProductsController', 'update') → 'admin-products.update'
 * Keeping this pure (and tested) means the interceptor itself stays a thin
 * untested shell, per this codebase's convention.
 */
export function deriveAuditAction(className: string, handlerName: string): string {
  const stem = className.replace(/Controller$/, '');
  const kebab = stem.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return `${kebab}.${handlerName}`;
}

export function deriveEntityType(className: string): string {
  return className.replace(/Controller$/, '');
}
