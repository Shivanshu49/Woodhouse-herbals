/** State names for the store-profile dropdown (mirrors the backend list; the
 *  authoritative stateCode is derived server-side). */
export const INDIAN_STATE_NAMES: readonly string[] = [
  'Jammu and Kashmir', 'Himachal Pradesh', 'Punjab', 'Chandigarh', 'Uttarakhand', 'Haryana',
  'Delhi', 'Rajasthan', 'Uttar Pradesh', 'Bihar', 'Sikkim', 'Arunachal Pradesh', 'Nagaland',
  'Manipur', 'Mizoram', 'Tripura', 'Meghalaya', 'Assam', 'West Bengal', 'Jharkhand', 'Odisha',
  'Chhattisgarh', 'Madhya Pradesh', 'Gujarat', 'Dadra and Nagar Haveli and Daman and Diu',
  'Maharashtra', 'Karnataka', 'Goa', 'Lakshadweep', 'Kerala', 'Tamil Nadu', 'Puducherry',
  'Andaman and Nicobar Islands', 'Telangana', 'Andhra Pradesh', 'Ladakh',
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Client-side GSTIN format check (the server re-validates authoritatively). */
export function isValidGstin(gstin: string): boolean {
  return GSTIN_REGEX.test(gstin.trim().toUpperCase());
}
