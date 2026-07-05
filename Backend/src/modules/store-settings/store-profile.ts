export interface InvoiceProfile {
  legalName: string;
  gstin: string;
  address: string;
  pan: string | null;
  state: string;
  stateCode: string;
  shippingGstRatePercent: number;
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/**
 * Assemble + validate the store invoice profile from raw StoreSetting `key→value`
 * pairs. Throws (→ 503 at the service layer) when a required legal field is unset,
 * so an invoice is never issued with a missing GSTIN / seller identity.
 */
export function buildInvoiceProfile(raw: Record<string, unknown>): InvoiceProfile {
  const legalName = str(raw['store.legalName']) ?? str(raw['store.name']);
  const gstin = str(raw['store.gstin']);
  const state = str(raw['store.state']);
  const stateCode = str(raw['store.stateCode']);
  const address = str(raw['store.address']);
  const missing = [
    !legalName && 'legalName',
    !gstin && 'gstin',
    !state && 'state',
    !stateCode && 'stateCode',
    !address && 'address',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Store invoice profile incomplete — set: ${missing.join(', ')}`);
  }
  const rate = raw['store.shippingGstRate'];
  return {
    legalName: legalName!,
    gstin: gstin!,
    address: address!,
    state: state!,
    stateCode: stateCode!,
    pan: str(raw['store.pan']),
    shippingGstRatePercent: typeof rate === 'number' ? rate : 18,
  };
}
