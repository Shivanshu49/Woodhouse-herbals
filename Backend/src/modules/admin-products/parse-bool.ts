/**
 * Parse a query-param boolean without the `Boolean("false") === true` trap
 * that `@Type(() => Boolean)` falls into. Pure — no class-transformer/
 * class-validator dependency — so it's directly unit-testable and reusable
 * from a `@Transform(({ value }) => parseBool(value))` decorator.
 */
export function parseBool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0' || value === '') return false;
  return Boolean(value);
}
