export interface InvoiceTaxLineInput {
  name: string;
  hsn: string | null;
  qty: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  gstRatePercent: number;
}
export interface InvoiceTaxInput {
  lines: InvoiceTaxLineInput[];
  discountMinor: number;
  shippingMinor: number;
  shippingGstRatePercent: number;
  buyerState: string;
  storeState: string;
  orderTotalMinor: number;
}
export interface InvoiceTaxLine {
  name: string;
  hsn: string | null;
  qty: number;
  gstRatePercent: number;
  grossMinor: number;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
}
export interface InvoiceTaxSlab {
  ratePercent: number;
  taxableMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
}
export interface InvoiceTaxResult {
  intraState: boolean;
  ambiguousPlaceOfSupply: boolean;
  lines: InvoiceTaxLine[];
  slabs: InvoiceTaxSlab[];
  totalTaxableMinor: number;
  totalCgstMinor: number;
  totalSgstMinor: number;
  totalIgstMinor: number;
  totalTaxMinor: number;
  grandTotalMinor: number;
}

// 36 Indian states + UTs, normalized. Membership decides the ambiguity flag only.
const KNOWN_STATES = new Set([
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana',
  'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'manipur',
  'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana',
  'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'andaman and nicobar islands', 'chandigarh',
  'dadra and nagar haveli and daman and diu', 'delhi', 'jammu and kashmir', 'ladakh', 'lakshadweep', 'puducherry',
]);
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function inclusiveSplit(grossMinor: number, ratePercent: number): { taxable: number; tax: number } {
  const taxable = Math.round((grossMinor * 100) / (100 + ratePercent));
  return { taxable, tax: grossMinor - taxable };
}

export function computeInvoiceTax(input: InvoiceTaxInput): InvoiceTaxResult {
  const buyer = normalize(input.buyerState);
  const store = normalize(input.storeState);
  const intraState = buyer.length > 0 && buyer === store;
  const ambiguousPlaceOfSupply = buyer.length === 0 || !KNOWN_STATES.has(buyer);

  // Apportion the order-level discount across product lines by gross share (largest-remainder).
  const grossSum = input.lines.reduce((s, l) => s + l.lineTotalMinor, 0);
  const rawShares = input.lines.map((l) =>
    grossSum > 0 ? (input.discountMinor * l.lineTotalMinor) / grossSum : 0,
  );
  const lineDiscounts = rawShares.map((x) => Math.floor(x));
  let remainder = input.discountMinor - lineDiscounts.reduce((s, x) => s + x, 0);
  // hand the leftover paise to the largest lines, one each
  const order = input.lines
    .map((_, i) => i)
    .sort((a, b) => input.lines[b].lineTotalMinor - input.lines[a].lineTotalMinor);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) lineDiscounts[order[k]]++;

  const splitFor = (grossMinor: number, ratePercent: number) => {
    const { taxable, tax } = inclusiveSplit(grossMinor, ratePercent);
    const cgst = intraState ? Math.round(tax / 2) : 0;
    const sgst = intraState ? tax - cgst : 0; // remainder to CGST so cgst+sgst == tax
    const igst = intraState ? 0 : tax;
    return { taxable, cgst, sgst, igst };
  };

  const lines: InvoiceTaxLine[] = input.lines.map((l, i) => {
    const grossMinor = l.lineTotalMinor - lineDiscounts[i];
    const { taxable, cgst, sgst, igst } = splitFor(grossMinor, l.gstRatePercent);
    return {
      name: l.name, hsn: l.hsn, qty: l.qty, gstRatePercent: l.gstRatePercent,
      grossMinor, taxableMinor: taxable, cgstMinor: cgst, sgstMinor: sgst, igstMinor: igst,
    };
  });

  if (input.shippingMinor > 0) {
    const { taxable, cgst, sgst, igst } = splitFor(input.shippingMinor, input.shippingGstRatePercent);
    lines.push({
      name: 'Shipping & handling', hsn: '9968', qty: 1, gstRatePercent: input.shippingGstRatePercent,
      grossMinor: input.shippingMinor, taxableMinor: taxable, cgstMinor: cgst, sgstMinor: sgst, igstMinor: igst,
    });
  }

  const slabMap = new Map<number, InvoiceTaxSlab>();
  for (const l of lines) {
    const s = slabMap.get(l.gstRatePercent) ?? {
      ratePercent: l.gstRatePercent, taxableMinor: 0, cgstMinor: 0, sgstMinor: 0, igstMinor: 0,
    };
    s.taxableMinor += l.taxableMinor;
    s.cgstMinor += l.cgstMinor;
    s.sgstMinor += l.sgstMinor;
    s.igstMinor += l.igstMinor;
    slabMap.set(l.gstRatePercent, s);
  }
  const slabs = [...slabMap.values()].sort((a, b) => a.ratePercent - b.ratePercent);

  const totalTaxableMinor = lines.reduce((s, l) => s + l.taxableMinor, 0);
  const totalCgstMinor = lines.reduce((s, l) => s + l.cgstMinor, 0);
  const totalSgstMinor = lines.reduce((s, l) => s + l.sgstMinor, 0);
  const totalIgstMinor = lines.reduce((s, l) => s + l.igstMinor, 0);
  const totalTaxMinor = totalCgstMinor + totalSgstMinor + totalIgstMinor;
  const grandTotalMinor = totalTaxableMinor + totalTaxMinor;

  return {
    intraState, ambiguousPlaceOfSupply, lines, slabs,
    totalTaxableMinor, totalCgstMinor, totalSgstMinor, totalIgstMinor, totalTaxMinor, grandTotalMinor,
  };
}
