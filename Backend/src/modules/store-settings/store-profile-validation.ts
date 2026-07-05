import { isKnownState, stateCodeFor } from '../../common/gst/indian-states';

/** Standard 15-char GSTIN: 2 state digits, 5 PAN letters, 4 digits, 1 letter,
 *  1 entity char, 'Z', 1 checksum char. */
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}

const VALID_GST_RATES = [0, 5, 12, 18, 28];

/** The editable store-profile fields (all optional in a PATCH). */
export interface StoreProfilePatch {
  legalName?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  state?: string;
  stateCode?: string;
  shippingGstRate?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  /** The normalized patch to persist (GSTIN upper-cased, stateCode derived). */
  normalized: StoreProfilePatch;
}

/**
 * Validate a store-profile PATCH. GSTIN must match the format; `state` must be a
 * known Indian state (and its `stateCode` is derived from it — the invoice's
 * place-of-supply split depends on a correct code); shippingGstRate must be a
 * legal slab. Returns per-field errors + a normalized patch.
 */
export function validateStoreProfilePatch(patch: StoreProfilePatch): ValidationResult {
  const errors: Record<string, string> = {};
  const normalized: StoreProfilePatch = {};

  if (patch.legalName !== undefined) {
    const v = patch.legalName.trim();
    if (!v) errors.legalName = 'Legal name cannot be empty.';
    else normalized.legalName = v;
  }
  if (patch.gstin !== undefined) {
    const v = patch.gstin.trim().toUpperCase();
    if (!isValidGstin(v)) errors.gstin = 'GSTIN must be a valid 15-character GST number.';
    else normalized.gstin = v;
  }
  if (patch.pan !== undefined) {
    const v = patch.pan.trim().toUpperCase();
    if (v && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v)) errors.pan = 'PAN must be a valid 10-character PAN.';
    else normalized.pan = v;
  }
  if (patch.address !== undefined) {
    const v = patch.address.trim();
    if (!v) errors.address = 'Address cannot be empty.';
    else normalized.address = v;
  }
  if (patch.state !== undefined) {
    const v = patch.state.trim();
    if (!isKnownState(v)) errors.state = 'State must be a recognised Indian state or union territory.';
    else {
      normalized.state = v;
      // stateCode is authoritative from the state — never trust a client-sent code.
      normalized.stateCode = stateCodeFor(v)!;
    }
  }
  if (patch.shippingGstRate !== undefined) {
    if (!VALID_GST_RATES.includes(patch.shippingGstRate)) {
      errors.shippingGstRate = `Shipping GST rate must be one of ${VALID_GST_RATES.join(', ')}.`;
    } else {
      normalized.shippingGstRate = patch.shippingGstRate;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, normalized };
}
