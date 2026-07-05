# Phase D3 — Order detail + GST invoice + refund UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the admin order-detail page, a compliant immutable GST tax-invoice PDF (per-line HSN, CGST/SGST-or-IGST, FY number series, stored in R2), and the refund UI over the D1b endpoints.

**Architecture:** A pure, test-dense invoice engine (tax split, amount-in-words, FY number) lands first with zero dependencies. Then the `Invoice`/`InvoiceCounter` schema + a `StoreProfileService` + an R2 `ObjectStorageService`, then `InvoiceService` (idempotent generate: immutable snapshot+number created once; the PDF is a deterministic render of that snapshot, cached in R2 or a dev `pdfBytes` fallback). Then endpoints + a best-effort auto-generate at the SHIPPED transition. **A hard live checkpoint (Task 11) shows three real PDFs before any frontend work.** Finally the Admin detail page → refund dialog → invoice download.

**Tech Stack:** NestJS 10, Prisma/Postgres (Neon), `pdfkit` (PDF), `@aws-sdk/client-s3` (R2), class-validator DTOs, `node --import tsx --test` + `node:assert/strict` for pure unit tests; Admin = Next.js 14 + react-query + shadcn/ui.

## Global Constraints

- **Money is integer paise.** All amounts `*Minor: number`.
- **GST-inclusive prices.** Per line `taxable = round(net × 100 / (100 + rate))`, `tax = net − taxable`. Invariant: `Σ (taxable + tax) == order.totalMinor`.
- **Invoice number = FY series** `INV-YYYY-YY-NNNNN`, gap-free per Indian FY (Apr–Mar).
- **Invoice is immutable:** snapshot + number created once; every later read returns them verbatim; the PDF is a pure render of the snapshot (re-download = identical bytes).
- **Invoiceable gate:** COD ⇒ {PROCESSING, SHIPPED, DELIVERED, REFUNDED}; PREPAID ⇒ {PAID, PROCESSING, SHIPPED, DELIVERED, REFUNDED}. Else 409.
- **Invoice view/download = ADMIN + MANAGER; refunds = ADMIN-only.**
- **Place of supply:** intra iff buyer state non-empty AND `normalize(buyer)===normalize(store)`; else inter-state; `ambiguousPlaceOfSupply` flag when buyer state blank/unknown (never blocks).
- **Commits:** author Shivanshu, no Claude attribution. Gates: Backend `npx tsc --noEmit` + `npm test` green before each commit; Admin `npm run typecheck` + `npm test` green for frontend tasks.
- **No secret logging.** Never log R2 keys/creds.

## File Structure

**Backend — new (`Backend/src/modules/invoices/` unless noted):**
- `gst-rate.ts` (+ `.test.ts`) — `gstRatePercent(GstRate)`, `isInvoiceable(status, method)`. **Pure.**
- `invoice-number.ts` (+ `.test.ts`) — `financialYearOf(Date)`, `formatInvoiceNumber(fy, seq)`. **Pure.**
- `amount-to-words.ts` (+ `.test.ts`) — `amountToWordsINR(minor)`. **Pure.**
- `invoice-tax.ts` (+ `.test.ts`) — `computeInvoiceTax(input)`. **Pure. The legal core.**
- `invoice-snapshot.ts` — `InvoiceSnapshot` type + `buildSnapshot(...)` (pure assembler).
- `invoice-pdf.ts` — `renderInvoicePdf(snapshot): Buffer` (pdfkit).
- `invoice.service.ts`, `dto/`, `invoices.controller.ts`, `invoices.module.ts`.
- `../store-settings/store-profile.service.ts` (+ `store-profile.ts` pure builder + `.test.ts`, `store-settings.module.ts`).
- `../../common/storage/object-storage.service.ts` (+ `storage.module.ts`).

**Backend — modified:** `prisma/schema.prisma` + migration; `modules/orders/orders.service.ts` (checkout snapshot); `modules/shipments/shipments.service.ts` + `shipments.module.ts` (auto-gen at SHIPPED); `modules/admin-orders/admin-orders.service.ts` (item HSN include + surface `invoice`); `app.module.ts`.

**Admin — new:** `app/(dashboard)/orders/[id]/page.tsx` + `_detail/` components; `components/ui/radio-group.tsx`.
**Admin — modified:** `lib/api.ts`, `lib/order-badges.ts` (+ `.test.ts`), `types/order.ts`, `lib/query-keys.ts`, `hooks/use-orders.ts` + `hooks/use-order-mutations.ts`.

---

## PHASE A — Pure invoice engine (zero dependencies, test-dense)

### Task 1: `gst-rate.ts` — rate map + invoiceable gate

**Files:** Create `Backend/src/modules/invoices/gst-rate.ts` + `.test.ts`.

**Interfaces — Produces:** `gstRatePercent(rate: GstRate): number`, `isInvoiceable(status: OrderStatus, method: PaymentMethod): boolean`.

- [ ] **Step 1: Write the failing test**
```ts
// Backend/src/modules/invoices/gst-rate.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { GstRate, OrderStatus, PaymentMethod } from '@prisma/client';
import { gstRatePercent, isInvoiceable } from './gst-rate';

test('gstRatePercent maps every GstRate to its integer percent', () => {
  assert.equal(gstRatePercent(GstRate.EXEMPT), 0);
  assert.equal(gstRatePercent(GstRate.GST_5), 5);
  assert.equal(gstRatePercent(GstRate.GST_12), 12);
  assert.equal(gstRatePercent(GstRate.GST_18), 18);
  assert.equal(gstRatePercent(GstRate.GST_28), 28);
});

test('isInvoiceable: COD from PROCESSING, PREPAID from PAID; never PENDING/CANCELLED', () => {
  for (const s of ['PROCESSING', 'SHIPPED', 'DELIVERED', 'REFUNDED'] as const) {
    assert.equal(isInvoiceable(s, PaymentMethod.COD), true);
    assert.equal(isInvoiceable(s, PaymentMethod.PREPAID), true);
  }
  assert.equal(isInvoiceable(OrderStatus.PAID, PaymentMethod.PREPAID), true);
  assert.equal(isInvoiceable(OrderStatus.PAID, PaymentMethod.COD), false); // COD has no PAID pre-ship
  for (const m of [PaymentMethod.COD, PaymentMethod.PREPAID]) {
    assert.equal(isInvoiceable(OrderStatus.PENDING, m), false);
    assert.equal(isInvoiceable(OrderStatus.CANCELLED, m), false);
  }
});
```

- [ ] **Step 2: Run → RED.** `cd Backend && npx tsx --test src/modules/invoices/gst-rate.test.ts` → cannot find module.

- [ ] **Step 3: Implement**
```ts
// Backend/src/modules/invoices/gst-rate.ts
import { GstRate, OrderStatus, PaymentMethod } from '@prisma/client';

export function gstRatePercent(rate: GstRate): number {
  switch (rate) {
    case GstRate.EXEMPT: return 0;
    case GstRate.GST_5: return 5;
    case GstRate.GST_12: return 12;
    case GstRate.GST_18: return 18;
    case GstRate.GST_28: return 28;
  }
}

const INVOICEABLE_COMMON: readonly OrderStatus[] = [
  OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.REFUNDED,
];

/** COD: goods invoice travels with the package (from PROCESSING, pre-payment).
 *  PREPAID: money captured (from PAID). PENDING/CANCELLED never invoiceable. */
export function isInvoiceable(status: OrderStatus, method: PaymentMethod): boolean {
  if (INVOICEABLE_COMMON.includes(status)) return true;
  return method === PaymentMethod.PREPAID && status === OrderStatus.PAID;
}
```

- [ ] **Step 4: Run → GREEN.** Re-run the test file (2 pass). `npx tsc --noEmit`.
- [ ] **Step 5: Commit**
```bash
git add Backend/src/modules/invoices/gst-rate.ts Backend/src/modules/invoices/gst-rate.test.ts
git commit -m "feat(invoices): pure GstRate→percent map + isInvoiceable gate (COD from PROCESSING, prepaid from PAID)"
```

---

### Task 2: `invoice-number.ts` — financial year + number format

**Files:** Create `Backend/src/modules/invoices/invoice-number.ts` + `.test.ts`.

**Interfaces — Produces:** `financialYearOf(date: Date): string` (IST-based, `"2026-27"`), `formatInvoiceNumber(fy: string, seq: number): string`.

- [ ] **Step 1: Write the failing test** (the Mar↔Apr IST boundary is the whole point)
```ts
// Backend/src/modules/invoices/invoice-number.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { financialYearOf, formatInvoiceNumber } from './invoice-number';

test('financialYearOf uses the Indian FY (Apr 1–Mar 31), computed in IST', () => {
  assert.equal(financialYearOf(new Date('2026-07-05T00:00:00Z')), '2026-27');
  assert.equal(financialYearOf(new Date('2026-04-01T00:00:00Z')), '2026-27'); // Apr 1 05:30 IST
  // Mar 31 15:30 IST (10:00Z) is still FY2025-26...
  assert.equal(financialYearOf(new Date('2026-03-31T10:00:00Z')), '2025-26');
  // ...but Mar 31 20:00Z is Apr 1 01:30 IST → FY2026-27 (the drift the SHIPPED trigger fixes)
  assert.equal(financialYearOf(new Date('2026-03-31T20:00:00Z')), '2026-27');
  assert.equal(financialYearOf(new Date('2027-01-15T00:00:00Z')), '2026-27');
});

test('formatInvoiceNumber zero-pads the sequence to 5 digits', () => {
  assert.equal(formatInvoiceNumber('2026-27', 1), 'INV-2026-27-00001');
  assert.equal(formatInvoiceNumber('2026-27', 4210), 'INV-2026-27-04210');
});
```

- [ ] **Step 2: Run → RED.**

- [ ] **Step 3: Implement**
```ts
// Backend/src/modules/invoices/invoice-number.ts
const IST_OFFSET_MIN = 330; // UTC+5:30

/** Indian financial year "YYYY-YY" (Apr 1–Mar 31), evaluated in IST. */
export function financialYearOf(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MIN * 60_000);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth(); // 0=Jan; April = 3
  const startYear = month >= 3 ? year : year - 1;
  const endYY = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYY}`;
}

export function formatInvoiceNumber(fy: string, seq: number): string {
  return `INV-${fy}-${String(seq).padStart(5, '0')}`;
}
```

- [ ] **Step 4: Run → GREEN** (2 pass). `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(invoices): pure FY computation (IST Apr–Mar) + invoice-number formatting`.

---

### Task 3: `amount-to-words.ts` — Indian-format rupee words

**Files:** Create `Backend/src/modules/invoices/amount-to-words.ts` + `.test.ts`.

**Interfaces — Produces:** `amountToWordsINR(minor: number): string`.

- [ ] **Step 1: Write the failing test**
```ts
// Backend/src/modules/invoices/amount-to-words.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { amountToWordsINR } from './amount-to-words';

test('amountToWordsINR renders Indian numbering with paise', () => {
  assert.equal(amountToWordsINR(0), 'Rupees Zero Only');
  assert.equal(amountToWordsINR(39800), 'Rupees Three Hundred Ninety Eight Only');
  assert.equal(amountToWordsINR(6071), 'Rupees Sixty and Paise Seventy One Only');
  assert.equal(amountToWordsINR(100), 'Rupees One Only');
  assert.equal(amountToWordsINR(150025), 'Rupees One Thousand Five Hundred and Paise Twenty Five Only');
  // Indian grouping: lakh + crore
  assert.equal(amountToWordsINR(1_23_45_678_00), 'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only');
});
```

- [ ] **Step 2: Run → RED.**

- [ ] **Step 3: Implement**
```ts
// Backend/src/modules/invoices/amount-to-words.ts
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100), rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/** Indian numbering (crore/lakh/thousand). `whole` is the rupee count. */
function wholeToWords(whole: number): string {
  if (whole === 0) return 'Zero';
  const crore = Math.floor(whole / 1_00_00_000);
  const lakh = Math.floor((whole % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((whole % 1_00_000) / 1000);
  const rest = whole % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export function amountToWordsINR(minor: number): string {
  const whole = Math.floor(minor / 100);
  const paise = minor % 100;
  const rupees = `Rupees ${wholeToWords(whole)}`;
  return paise ? `${rupees} and Paise ${twoDigits(paise)} Only` : `${rupees} Only`;
}
```

- [ ] **Step 4: Run → GREEN** (1 test, 6 assertions). `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(invoices): pure amount-to-words (Indian numbering, Rupees/Paise)`.

---

### Task 4: `invoice-tax.ts` — the tax split (legal core)

**Files:** Create `Backend/src/modules/invoices/invoice-tax.ts` + `.test.ts`.

**Interfaces — Produces:** the types below + `computeInvoiceTax(input: InvoiceTaxInput): InvoiceTaxResult`.

- [ ] **Step 1: Write the failing test**
```ts
// Backend/src/modules/invoices/invoice-tax.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeInvoiceTax, type InvoiceTaxInput } from './invoice-tax';

const base: InvoiceTaxInput = {
  lines: [
    { name: 'A', hsn: '3304', qty: 2, unitPriceMinor: 19900, lineTotalMinor: 39800, gstRatePercent: 18 },
  ],
  discountMinor: 0, shippingMinor: 0, shippingGstRatePercent: 18,
  buyerState: 'Karnataka', storeState: 'Karnataka', orderTotalMinor: 39800,
};

test('intra-state: CGST+SGST each half of the (inclusive-derived) tax; reconciles to total', () => {
  const r = computeInvoiceTax(base);
  assert.equal(r.intraState, true);
  const l = r.lines[0];
  assert.equal(l.taxableMinor + l.cgstMinor + l.sgstMinor, 39800); // net reconciles
  assert.equal(l.igstMinor, 0);
  assert.equal(l.cgstMinor + l.sgstMinor, l.grossMinor - l.taxableMinor); // = tax
  assert.equal(Math.abs(l.cgstMinor - l.sgstMinor) <= 1, true);        // halves ±1 paise
  assert.equal(r.grandTotalMinor, 39800);
});

test('inter-state: IGST = full line tax, no CGST/SGST', () => {
  const r = computeInvoiceTax({ ...base, buyerState: 'Maharashtra' });
  assert.equal(r.intraState, false);
  assert.equal(r.lines[0].cgstMinor, 0);
  assert.equal(r.lines[0].sgstMinor, 0);
  assert.equal(r.lines[0].igstMinor, r.lines[0].grossMinor - r.lines[0].taxableMinor);
});

test('order discount is apportioned; grand total still reconciles', () => {
  const r = computeInvoiceTax({
    ...base,
    lines: [
      { name: 'A', hsn: '3304', qty: 1, unitPriceMinor: 30000, lineTotalMinor: 30000, gstRatePercent: 18 },
      { name: 'B', hsn: '3304', qty: 1, unitPriceMinor: 10000, lineTotalMinor: 10000, gstRatePercent: 12 },
    ],
    discountMinor: 4000, orderTotalMinor: 36000,
  });
  assert.equal(r.grandTotalMinor, 36000);
  assert.equal(r.lines.reduce((s, l) => s + l.taxableMinor + l.cgstMinor + l.sgstMinor + l.igstMinor, 0), 36000);
});

test('shipping becomes its own taxable line', () => {
  const r = computeInvoiceTax({ ...base, shippingMinor: 5000, orderTotalMinor: 44800 });
  assert.equal(r.lines.length, 2);
  assert.equal(r.lines[1].grossMinor, 5000);
  assert.equal(r.grandTotalMinor, 44800);
});

test('blank/unknown buyer state → inter-state + ambiguous flag (never blocks)', () => {
  const r = computeInvoiceTax({ ...base, buyerState: '' });
  assert.equal(r.intraState, false);
  assert.equal(r.ambiguousPlaceOfSupply, true);
  assert.equal(r.grandTotalMinor, 39800);
});
```

- [ ] **Step 2: Run → RED.**

- [ ] **Step 3: Implement**
```ts
// Backend/src/modules/invoices/invoice-tax.ts
export interface InvoiceTaxLineInput {
  name: string; hsn: string | null; qty: number;
  unitPriceMinor: number; lineTotalMinor: number; gstRatePercent: number;
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
  name: string; hsn: string | null; qty: number; gstRatePercent: number;
  grossMinor: number; taxableMinor: number;
  cgstMinor: number; sgstMinor: number; igstMinor: number;
}
export interface InvoiceTaxSlab {
  ratePercent: number; taxableMinor: number; cgstMinor: number; sgstMinor: number; igstMinor: number;
}
export interface InvoiceTaxResult {
  intraState: boolean;
  ambiguousPlaceOfSupply: boolean;
  lines: InvoiceTaxLine[];
  slabs: InvoiceTaxSlab[];
  totalTaxableMinor: number; totalCgstMinor: number; totalSgstMinor: number;
  totalIgstMinor: number; totalTaxMinor: number; grandTotalMinor: number;
}

// 36 Indian states + UTs, normalized. Membership decides the ambiguity flag only.
const KNOWN_STATES = new Set([
  'andhra pradesh','arunachal pradesh','assam','bihar','chhattisgarh','goa','gujarat','haryana',
  'himachal pradesh','jharkhand','karnataka','kerala','madhya pradesh','maharashtra','manipur',
  'meghalaya','mizoram','nagaland','odisha','punjab','rajasthan','sikkim','tamil nadu','telangana',
  'tripura','uttar pradesh','uttarakhand','west bengal','andaman and nicobar islands','chandigarh',
  'dadra and nagar haveli and daman and diu','delhi','jammu and kashmir','ladakh','lakshadweep','puducherry',
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
    grossSum > 0 ? (input.discountMinor * l.lineTotalMinor) / grossSum : 0);
  const lineDiscounts = rawShares.map((x) => Math.floor(x));
  let remainder = input.discountMinor - lineDiscounts.reduce((s, x) => s + x, 0);
  // hand the leftover paise to the largest lines, one each
  const order = input.lines
    .map((_, i) => i)
    .sort((a, b) => input.lines[b].lineTotalMinor - input.lines[a].lineTotalMinor);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) lineDiscounts[order[k]]++;

  const lines: InvoiceTaxLine[] = input.lines.map((l, i) => {
    const grossMinor = l.lineTotalMinor - lineDiscounts[i];
    const { taxable, tax } = inclusiveSplit(grossMinor, l.gstRatePercent);
    const cgst = intraState ? Math.round(tax / 2) : 0;
    const sgst = intraState ? tax - cgst : 0; // remainder to CGST so cgst+sgst == tax
    const igst = intraState ? 0 : tax;
    return { name: l.name, hsn: l.hsn, qty: l.qty, gstRatePercent: l.gstRatePercent,
      grossMinor, taxableMinor: taxable, cgstMinor: cgst, sgstMinor: sgst, igstMinor: igst };
  });

  if (input.shippingMinor > 0) {
    const { taxable, tax } = inclusiveSplit(input.shippingMinor, input.shippingGstRatePercent);
    const cgst = intraState ? Math.round(tax / 2) : 0;
    const sgst = intraState ? tax - cgst : 0;
    const igst = intraState ? 0 : tax;
    lines.push({ name: 'Shipping & handling', hsn: '9968', qty: 1, gstRatePercent: input.shippingGstRatePercent,
      grossMinor: input.shippingMinor, taxableMinor: taxable, cgstMinor: cgst, sgstMinor: sgst, igstMinor: igst });
  }

  // Slabs
  const slabMap = new Map<number, InvoiceTaxSlab>();
  for (const l of lines) {
    const s = slabMap.get(l.gstRatePercent) ??
      { ratePercent: l.gstRatePercent, taxableMinor: 0, cgstMinor: 0, sgstMinor: 0, igstMinor: 0 };
    s.taxableMinor += l.taxableMinor; s.cgstMinor += l.cgstMinor; s.sgstMinor += l.sgstMinor; s.igstMinor += l.igstMinor;
    slabMap.set(l.gstRatePercent, s);
  }
  const slabs = [...slabMap.values()].sort((a, b) => a.ratePercent - b.ratePercent);

  const totalTaxableMinor = lines.reduce((s, l) => s + l.taxableMinor, 0);
  const totalCgstMinor = lines.reduce((s, l) => s + l.cgstMinor, 0);
  const totalSgstMinor = lines.reduce((s, l) => s + l.sgstMinor, 0);
  const totalIgstMinor = lines.reduce((s, l) => s + l.igstMinor, 0);
  const totalTaxMinor = totalCgstMinor + totalSgstMinor + totalIgstMinor;
  const grandTotalMinor = totalTaxableMinor + totalTaxMinor;

  return { intraState, ambiguousPlaceOfSupply, lines, slabs,
    totalTaxableMinor, totalCgstMinor, totalSgstMinor, totalIgstMinor, totalTaxMinor, grandTotalMinor };
}
```
> Reconciliation holds by construction: `taxable+tax == gross` per line, and `Σ gross == Σ lineTotal − discount + shipping == order.totalMinor` (GST-inclusive pricing). The tests assert `grandTotalMinor === orderTotalMinor`; if a future rounding path breaks it, that's a real failure to fix, not to paper over.

- [ ] **Step 4: Run → GREEN** (5 tests). `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(invoices): pure GST tax split — inclusive→taxable, CGST/SGST vs IGST, discount apportionment, shipping line, ambiguity flag`.

---

## PHASE B — Schema, prereqs, config

### Task 5: Schema migration + checkout HSN/GST snapshot

**Files:** Modify `Backend/prisma/schema.prisma`; create migration; modify `Backend/src/modules/orders/orders.service.ts`.

- [ ] **Step 1: Edit schema.** Add to `model OrderItem`: `hsnSnapshot String?` and `gstRateSnapshot Int?`. Add `invoice Invoice?` to `model Order`. Add:
```prisma
model Invoice {
  id        String   @id @default(cuid())
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   String   @unique
  number    String   @unique
  fy        String
  snapshot  Json
  r2Key     String?
  pdfBytes  Bytes?
  issuedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model InvoiceCounter {
  fy   String @id
  next Int    @default(1)
}
```

- [ ] **Step 2: Create + apply the migration.** `cd Backend && npx prisma migrate dev --name d3_invoices`. Then append three StoreSetting seeds to the generated `migration.sql` (placeholder values — real ones set at deploy):
```sql
INSERT INTO "StoreSetting" ("id","key","value","createdAt","updatedAt") VALUES
  (gen_random_uuid()::text, 'store.state',          '"Karnataka"', now(), now()),
  (gen_random_uuid()::text, 'store.stateCode',      '"29"',        now(), now()),
  (gen_random_uuid()::text, 'store.shippingGstRate','18',          now(), now())
ON CONFLICT ("key") DO NOTHING;
```
Re-apply: `npx prisma migrate dev` (regenerates the client).

- [ ] **Step 3: Snapshot HSN/rate at checkout.** In `orders.service.ts::createFromCart`, the product `p` is already loaded (used for `productNameSnapshot: p.name`). Ensure the product select includes `hsnCode: true, gstRate: true`, and add to the OrderItem `create` (next to `skuSnapshot`):
```ts
hsnSnapshot: p.hsnCode ?? null,
gstRateSnapshot: gstRatePercent(p.gstRate),
```
Import `gstRatePercent` from `../invoices/gst-rate`.

- [ ] **Step 4: Verify + commit.** `npx tsc --noEmit && npm test` (green). Commit:
```bash
git add Backend/prisma/ Backend/src/modules/orders/orders.service.ts
git commit -m "feat(invoices): schema — OrderItem HSN/gstRate snapshot, Invoice + InvoiceCounter, store.state/stateCode/shippingGstRate seeds; snapshot HSN/rate at checkout"
```

---

### Task 6: `StoreProfileService` (typed store profile + 503 guard)

**Files:** Create `Backend/src/modules/store-settings/store-profile.ts` (+ `.test.ts`), `store-profile.service.ts`, `store-settings.module.ts`.

**Interfaces — Produces:** `buildInvoiceProfile(raw: Record<string, unknown>): InvoiceProfile` (pure; throws on missing required); `StoreProfileService.getInvoiceProfile(): Promise<InvoiceProfile>`.

- [ ] **Step 1: Write the failing test (pure builder)**
```ts
// store-profile.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoiceProfile } from './store-profile';

const full = {
  'store.name': 'Wood House Herbals', 'store.gstin': '29ABCDE1234F1Z5',
  'store.address': '12 Herbal Rd, Bengaluru 560001', 'store.pan': 'ABCDE1234F',
  'store.state': 'Karnataka', 'store.stateCode': '29', 'store.shippingGstRate': 18,
};

test('buildInvoiceProfile assembles a typed profile', () => {
  const p = buildInvoiceProfile(full);
  assert.equal(p.legalName, 'Wood House Herbals');
  assert.equal(p.gstin, '29ABCDE1234F1Z5');
  assert.equal(p.state, 'Karnataka');
  assert.equal(p.shippingGstRatePercent, 18);
});

test('buildInvoiceProfile throws when a required key is unset', () => {
  assert.throws(() => buildInvoiceProfile({ ...full, 'store.gstin': null }), /gstin/i);
  assert.throws(() => buildInvoiceProfile({ ...full, 'store.state': null }), /state/i);
});
```

- [ ] **Step 2: Run → RED**, then implement:
```ts
// store-profile.ts
export interface InvoiceProfile {
  legalName: string; gstin: string; address: string; pan: string | null;
  state: string; stateCode: string; shippingGstRatePercent: number;
}
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function buildInvoiceProfile(raw: Record<string, unknown>): InvoiceProfile {
  const legalName = str(raw['store.legalName']) ?? str(raw['store.name']);
  const gstin = str(raw['store.gstin']);
  const state = str(raw['store.state']);
  const stateCode = str(raw['store.stateCode']);
  const address = str(raw['store.address']);
  const missing = [
    !legalName && 'legalName', !gstin && 'gstin', !state && 'state',
    !stateCode && 'stateCode', !address && 'address',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Store invoice profile incomplete — set: ${missing.join(', ')}`);
  }
  const rate = raw['store.shippingGstRate'];
  return {
    legalName: legalName!, gstin: gstin!, address: address!, state: state!, stateCode: stateCode!,
    pan: str(raw['store.pan']),
    shippingGstRatePercent: typeof rate === 'number' ? rate : 18,
  };
}
```
```ts
// store-profile.service.ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buildInvoiceProfile, InvoiceProfile } from './store-profile';

@Injectable()
export class StoreProfileService {
  constructor(private readonly prisma: PrismaService) {}
  async getInvoiceProfile(): Promise<InvoiceProfile> {
    const rows = await this.prisma.storeSetting.findMany({ where: { key: { startsWith: 'store.' } } });
    const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    try {
      return buildInvoiceProfile(raw as Record<string, unknown>);
    } catch (e) {
      throw new ServiceUnavailableException((e as Error).message);
    }
  }
}
```
```ts
// store-settings.module.ts
import { Global, Module } from '@nestjs/common';
import { StoreProfileService } from './store-profile.service';
@Global()
@Module({ providers: [StoreProfileService], exports: [StoreProfileService] })
export class StoreSettingsModule {}
```

- [ ] **Step 3: Verify + commit.** `npx tsc --noEmit && npm test`. Register `StoreSettingsModule` in `app.module.ts`. Commit `feat(store-settings): StoreProfileService — typed invoice profile from StoreSetting, 503 when unconfigured`.

---

### Task 7: `ObjectStorageService` (R2)

**Files:** Create `Backend/src/common/storage/object-storage.service.ts` + `storage.module.ts`. Install `@aws-sdk/client-s3`.

**Interfaces — Produces:** `ObjectStorageService.isConfigured(): boolean`, `.put(key, body: Buffer, contentType): Promise<void>`, `.get(key): Promise<Buffer>`.

- [ ] **Step 1: Install.** `cd Backend && npm i @aws-sdk/client-s3`.

- [ ] **Step 2: Implement** (verified by typecheck + the Task 11 demo — it does IO):
```ts
// object-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';

@Injectable()
export class ObjectStorageService {
  private readonly logger = new Logger(ObjectStorageService.name);
  private client: S3Client | null = null;

  isConfigured(): boolean {
    return Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);
  }
  private s3(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
      });
    }
    return this.client;
  }
  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3().send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string): Promise<Buffer> {
    const res = await this.s3().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
}
```
```ts
// storage.module.ts
import { Global, Module } from '@nestjs/common';
import { ObjectStorageService } from './object-storage.service';
@Global()
@Module({ providers: [ObjectStorageService], exports: [ObjectStorageService] })
export class StorageModule {}
```

- [ ] **Step 3: Verify + commit.** `npx tsc --noEmit`. Register `StorageModule` in `app.module.ts`. Commit `feat(storage): R2 object storage service (S3-compatible) with isConfigured guard`.

---

## PHASE C — Snapshot, PDF, generation

### Task 8: `invoice-snapshot.ts` (pure assembler) + `invoice-pdf.ts` (pdfkit)

**Files:** Create `Backend/src/modules/invoices/invoice-snapshot.ts` (+ `.test.ts`), `invoice-pdf.ts`. Install `pdfkit` + `@types/pdfkit`.

**Interfaces — Produces:** `InvoiceSnapshot` type; `buildSnapshot(args): InvoiceSnapshot` (pure); `renderInvoicePdf(snapshot: InvoiceSnapshot): Buffer`.

- [ ] **Step 1: Install.** `cd Backend && npm i pdfkit && npm i -D @types/pdfkit`.

- [ ] **Step 2: Write the failing test for `buildSnapshot`** (pure — no PDF):
```ts
// invoice-snapshot.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from './invoice-snapshot';

const profile = { legalName: 'WHH', gstin: '29ABCDE1234F1Z5', address: 'BLR', pan: 'ABCDE1234F',
  state: 'Karnataka', stateCode: '29', shippingGstRatePercent: 18 };
const order = {
  number: 'WH-1', paymentMethod: 'COD' as const, discountMinor: 0, shippingMinor: 0, totalMinor: 39800,
  shippingFullName: 'Buyer', shippingGstin: null, shippingState: 'Karnataka',
  shippingLine1: '1 St', shippingLine2: null, shippingCity: 'BLR', shippingPincode: '560001',
  items: [{ productNameSnapshot: 'A', hsnSnapshot: '3304', gstRateSnapshot: 18, quantity: 2,
    unitPriceMinor: 19900, lineTotalMinor: 39800, product: { hsnCode: '3304', gstRate: 'GST_18' as const } }],
};

test('buildSnapshot fills number/date/tax and flags catalogue fallback per line', () => {
  const s = buildSnapshot({ order, profile, number: 'INV-2026-27-00001', issuedAt: new Date('2026-07-05T00:00:00Z') });
  assert.equal(s.number, 'INV-2026-27-00001');
  assert.equal(s.tax.grandTotalMinor, 39800);
  assert.equal(s.tax.intraState, true);
  assert.equal(s.catalogueFallback, false); // snapshot present → exact-at-sale
  assert.equal(s.amountInWords.startsWith('Rupees'), true);
  assert.equal(s.paymentNote.includes('COD'), true);
});

test('buildSnapshot falls back to current product HSN/rate when the snapshot is null', () => {
  const legacy = { ...order, items: [{ ...order.items[0], hsnSnapshot: null, gstRateSnapshot: null }] };
  const s = buildSnapshot({ order: legacy, profile, number: 'INV-2026-27-00002', issuedAt: new Date() });
  assert.equal(s.catalogueFallback, true);
  assert.equal(s.tax.lines[0].hsn, '3304'); // from product.hsnCode
});
```

- [ ] **Step 3: Run → RED**, then implement `invoice-snapshot.ts`:
```ts
// invoice-snapshot.ts
import { gstRatePercent } from './gst-rate';
import { computeInvoiceTax, InvoiceTaxResult } from './invoice-tax';
import { amountToWordsINR } from './amount-to-words';
import type { GstRate, PaymentMethod } from '@prisma/client';
import type { InvoiceProfile } from '../store-settings/store-profile';

export interface SnapshotOrderItem {
  productNameSnapshot: string; hsnSnapshot: string | null; gstRateSnapshot: number | null;
  quantity: number; unitPriceMinor: number; lineTotalMinor: number;
  product: { hsnCode: string | null; gstRate: GstRate };
}
export interface SnapshotOrder {
  number: string; paymentMethod: PaymentMethod; discountMinor: number; shippingMinor: number; totalMinor: number;
  shippingFullName: string; shippingGstin: string | null; shippingState: string;
  shippingLine1: string; shippingLine2: string | null; shippingCity: string; shippingPincode: string;
  items: SnapshotOrderItem[];
}
export interface InvoiceSnapshot {
  number: string; issuedAtISO: string; orderNumber: string;
  seller: InvoiceProfile;
  buyer: { name: string; gstin: string | null; address: string; state: string };
  tax: InvoiceTaxResult;
  amountInWords: string;
  paymentNote: string;
  catalogueFallback: boolean;
}

export function buildSnapshot(args: {
  order: SnapshotOrder; profile: InvoiceProfile; number: string; issuedAt: Date;
}): InvoiceSnapshot {
  const { order, profile, number, issuedAt } = args;
  let catalogueFallback = false;
  const taxLines = order.items.map((it) => {
    const hsn = it.hsnSnapshot ?? it.product.hsnCode;
    const rate = it.gstRateSnapshot ?? gstRatePercent(it.product.gstRate);
    if (it.hsnSnapshot === null || it.gstRateSnapshot === null) catalogueFallback = true;
    return { name: it.productNameSnapshot, hsn, qty: it.quantity,
      unitPriceMinor: it.unitPriceMinor, lineTotalMinor: it.lineTotalMinor, gstRatePercent: rate };
  });
  const tax = computeInvoiceTax({
    lines: taxLines, discountMinor: order.discountMinor, shippingMinor: order.shippingMinor,
    shippingGstRatePercent: profile.shippingGstRatePercent,
    buyerState: order.shippingState, storeState: profile.state, orderTotalMinor: order.totalMinor,
  });
  const addr = [order.shippingLine1, order.shippingLine2, order.shippingCity, order.shippingPincode]
    .filter(Boolean).join(', ');
  return {
    number, issuedAtISO: issuedAt.toISOString(), orderNumber: order.number,
    seller: profile,
    buyer: { name: order.shippingFullName, gstin: order.shippingGstin, address: addr, state: order.shippingState },
    tax,
    amountInWords: amountToWordsINR(tax.grandTotalMinor),
    paymentNote: order.paymentMethod === 'COD'
      ? 'Cash on Delivery — payable on receipt.'
      : 'Paid online (prepaid).',
    catalogueFallback,
  };
}
```

- [ ] **Step 4: Run → GREEN** (2 tests). Then implement `invoice-pdf.ts` (no unit test — verified by the Task 11 demo; the PDF is byte-inspected visually):
```ts
// invoice-pdf.ts
import PDFDocument from 'pdfkit';
import type { InvoiceSnapshot } from './invoice-snapshot';

const inr = (m: number) => `₹${(m / 100).toFixed(2)}`;

/** Deterministic render of the immutable snapshot → PDF Buffer. */
export function renderInvoicePdf(s: InvoiceSnapshot): Buffer {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  doc.fontSize(16).text('TAX INVOICE', { align: 'center' }).moveDown(0.5);
  doc.fontSize(10).text(s.seller.legalName).text(s.seller.address)
    .text(`GSTIN: ${s.seller.gstin}${s.seller.pan ? `   PAN: ${s.seller.pan}` : ''}`)
    .text(`State: ${s.seller.state} (${s.seller.stateCode})`).moveDown(0.5);

  doc.text(`Invoice No: ${s.number}`).text(`Date: ${s.issuedAtISO.slice(0, 10)}`)
    .text(`Order No: ${s.orderNumber}`).moveDown(0.5);

  doc.font('Helvetica-Bold').text('Bill To:').font('Helvetica')
    .text(s.buyer.name).text(s.buyer.address).text(`State: ${s.buyer.state}`)
    .text(s.buyer.gstin ? `GSTIN: ${s.buyer.gstin}` : 'GSTIN: —').moveDown(0.5);

  // Line table (simple columnar text; keep deterministic).
  doc.font('Helvetica-Bold').text('Item / HSN / Qty / Rate% / Taxable / CGST / SGST / IGST').font('Helvetica');
  for (const l of s.tax.lines) {
    doc.text(`${l.name} | ${l.hsn ?? '—'} | ${l.qty} | ${l.gstRatePercent}% | ${inr(l.taxableMinor)} | ${inr(l.cgstMinor)} | ${inr(l.sgstMinor)} | ${inr(l.igstMinor)}`);
  }
  doc.moveDown(0.5);
  doc.text(`Taxable: ${inr(s.tax.totalTaxableMinor)}`);
  if (s.tax.intraState) doc.text(`CGST: ${inr(s.tax.totalCgstMinor)}   SGST: ${inr(s.tax.totalSgstMinor)}`);
  else doc.text(`IGST: ${inr(s.tax.totalIgstMinor)}`);
  doc.font('Helvetica-Bold').text(`Grand Total: ${inr(s.tax.grandTotalMinor)}`).font('Helvetica');
  doc.text(`(${s.amountInWords})`).moveDown(0.5);
  doc.text(s.paymentNote);
  if (s.catalogueFallback) doc.fillColor('#a00').text('* HSN/rate from current catalogue (order pre-dates line snapshots).').fillColor('#000');
  if (s.tax.ambiguousPlaceOfSupply) doc.fillColor('#a00').text('* Place of supply from a free-text state — verify CGST/SGST vs IGST.').fillColor('#000');
  doc.moveDown(1).fontSize(8).text('Computer-generated invoice — no signature required.', { align: 'center' });

  doc.end();
  return Buffer.concat(chunks as unknown as Uint8Array[]); // NOTE: doc.end() is sync-drained via chunks; see Task 9 for the async-safe wrapper
}
```
> **Correction for the implementer:** pdfkit streams asynchronously — `Buffer.concat` right after `doc.end()` may miss chunks. Wrap rendering in a Promise that resolves on the `end` event. Change the signature to `renderInvoicePdf(s): Promise<Buffer>` and collect via `await new Promise<Buffer>((res) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.end(); })`. Update `InvoiceService.getPdf` (Task 9) to `await` it.

- [ ] **Step 5: Verify + commit.** `npx tsc --noEmit && npm test`. Commit `feat(invoices): snapshot assembler (catalogue fallback) + pdfkit renderer`.

---

### Task 9: `InvoiceService` — idempotent generate + getPdf

**Files:** Create `Backend/src/modules/invoices/invoice.service.ts`, `invoices.module.ts`.

**Interfaces — Produces:** `InvoiceService.generateForOrder(orderId): Promise<{ number; issuedAt }>`, `.getForOrder(orderId): Promise<Invoice | null>`, `.getPdf(orderId): Promise<{ buffer: Buffer; filename: string }>`.

- [ ] **Step 1: Implement** (verified by typecheck + Task 11 demo):
```ts
// invoice.service.ts
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StoreProfileService } from '../store-settings/store-profile.service';
import { ObjectStorageService } from '../../common/storage/object-storage.service';
import { env } from '../../common/config/env';
import { isInvoiceable } from './gst-rate';
import { financialYearOf, formatInvoiceNumber } from './invoice-number';
import { buildSnapshot, InvoiceSnapshot } from './invoice-snapshot';
import { renderInvoicePdf } from './invoice-pdf';

const ORDER_INCLUDE = {
  items: { include: { product: { select: { hsnCode: true, gstRate: true } } } },
} as const;

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: StoreProfileService,
    private readonly storage: ObjectStorageService,
  ) {}

  /** Idempotent: creates the immutable Invoice row (number + snapshot) once. */
  async generateForOrder(orderId: string) {
    const existing = await this.prisma.invoice.findUnique({ where: { orderId }, select: { number: true, issuedAt: true } });
    if (existing) return existing;

    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    if (!isInvoiceable(order.status, order.paymentMethod)) {
      throw new ConflictException(`An order in ${order.status} status is not invoiceable yet.`);
    }
    const profile = await this.profiles.getInvoiceProfile(); // 503 if unconfigured
    const issuedAt = new Date();
    const fy = financialYearOf(issuedAt);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.invoiceCounter.upsert({ where: { fy }, create: { fy, next: 1 }, update: {} });
        const { next } = await tx.invoiceCounter.update({ where: { fy }, data: { next: { increment: 1 } }, select: { next: true } });
        const number = formatInvoiceNumber(fy, next - 1);
        const snapshot = buildSnapshot({ order: order as any, profile, number, issuedAt });
        const created = await tx.invoice.create({
          data: { orderId, number, fy, snapshot: snapshot as any, issuedAt },
          select: { number: true, issuedAt: true },
        });
        return created;
      }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });
    } catch (e: any) {
      if (e?.code === 'P2002') { // raced — return the winner
        return (await this.prisma.invoice.findUnique({ where: { orderId }, select: { number: true, issuedAt: true } }))!;
      }
      throw e;
    }
  }

  getForOrder(orderId: string) {
    return this.prisma.invoice.findUnique({ where: { orderId } });
  }

  /** Renders + caches the PDF from the immutable snapshot (R2, or pdfBytes in dev). */
  async getPdf(orderId: string): Promise<{ buffer: Buffer; filename: string }> {
    await this.generateForOrder(orderId); // ensure it exists
    const inv = await this.prisma.invoice.findUnique({ where: { orderId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const filename = `${inv.number}.pdf`;

    if (inv.r2Key && this.storage.isConfigured()) return { buffer: await this.storage.get(inv.r2Key), filename };
    if (inv.pdfBytes) return { buffer: Buffer.from(inv.pdfBytes), filename };

    const buffer = await renderInvoicePdf(inv.snapshot as unknown as InvoiceSnapshot); // async per Task 8 correction
    if (this.storage.isConfigured()) {
      const key = `invoices/${inv.fy}/${inv.number}.pdf`;
      await this.storage.put(key, buffer, 'application/pdf');
      await this.prisma.invoice.update({ where: { orderId }, data: { r2Key: key } });
    } else {
      await this.prisma.invoice.update({ where: { orderId }, data: { pdfBytes: buffer } });
    }
    return { buffer, filename };
  }
}
```
```ts
// invoices.module.ts
import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoicesController } from './invoices.controller'; // Task 10
@Module({ controllers: [InvoicesController], providers: [InvoiceService], exports: [InvoiceService] })
export class InvoicesModule {}
```

- [ ] **Step 2: Verify + commit.** `npx tsc --noEmit`. (Controller lands in Task 10; if compiling in isolation, temporarily omit `controllers`/the import until Task 10, then restore.) Commit `feat(invoices): idempotent InvoiceService — immutable snapshot+FY number in a tx, PDF rendered from the snapshot and cached (R2 or dev pdfBytes)`.

---

## PHASE D — Endpoints + SHIPPED hook

### Task 10: Invoice endpoints + auto-generate at SHIPPED + detail-API tweak

**Files:** Create `Backend/src/modules/invoices/invoices.controller.ts`; modify `shipments.service.ts`, `shipments.module.ts`, `admin-orders.service.ts`, `app.module.ts`.

- [ ] **Step 1: Controller** (`@Roles(ADMIN, MANAGER)`, throttled, audited; PDF streamed):
```ts
// invoices.controller.ts
import { Controller, Get, Param, Post, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { InvoiceService } from './invoice.service';

const INVOICE_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class InvoicesController {
  constructor(private readonly invoices: InvoiceService) {}

  @Roles(...INVOICE_ROLES)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post(':id/invoice')
  generate(@Param('id') id: string) { return this.invoices.generateForOrder(id); }

  @Roles(...INVOICE_ROLES)
  @Get(':id/invoice')
  async get(@Param('id') id: string) {
    const inv = await this.invoices.getForOrder(id);
    return inv ? { number: inv.number, fy: inv.fy, issuedAt: inv.issuedAt } : null;
  }

  @Roles(...INVOICE_ROLES)
  @Get(':id/invoice/pdf')
  async pdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.invoices.getPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  }
}
```

- [ ] **Step 2: Auto-generate at SHIPPED (best-effort, post-commit).** In `shipments.service.ts::updateStatus`, after the transaction that flips the order to SHIPPED commits AND this call was the transition (the `updateMany` count was 1 — reuse the existing branch that records the SHIPPED event), add a fire-and-forget generate:
```ts
// after the tx that emitted the toStatus: SHIPPED event, still inside updateStatus:
this.invoices.generateForOrder(shipment.orderId).catch((e) =>
  this.logger.warn(`invoice auto-gen at SHIPPED failed order=${shipment.orderId}: ${(e as Error).message}`),
);
```
Inject `InvoiceService` into `ShipmentsService`; add a `Logger` if absent. In `shipments.module.ts` add `imports: [InvoicesModule]` (one-directional; InvoicesModule does NOT import ShipmentsModule — no cycle).

- [ ] **Step 3: Detail-API tweak.** In `admin-orders.service.ts`, extend `DETAIL_INCLUDE`: `items: { include: { product: { select: { hsnCode: true, gstRate: true } } } }` (for the invoice fallback surfaced client-side is optional; primarily this keeps the include consistent) and add `invoice: { select: { number: true, fy: true, issuedAt: true } }` so the detail page knows whether an invoice exists.

- [ ] **Step 4: Register + verify.** Add `InvoicesModule` to `app.module.ts`. `npx tsc --noEmit && npm test` (full suite green; the app must boot — no circular dep). Commit `feat(invoices): admin invoice endpoints (generate/get/pdf, ADMIN+MANAGER) + best-effort auto-gen at SHIPPED + surface invoice on order detail`.

---

### Task 11: 🔴 LIVE CHECKPOINT — eyeball three real invoice PDFs (STOP)

**Files:** a temporary `Backend/scripts/invoice-demo.ts` (not committed).

Goal: produce three real PDFs on live Neon data and hand them to the human before any frontend work. **Do not proceed to Phase E until approved.**

- [ ] **Step 1: Seed + generate.** Write a tsx script that: sets placeholder `store.*` settings if unset (via `storeSetting.upsert` for `store.gstin='29ABCDE1234F1Z5'`, `store.address`, `store.legalName`); seeds three COD/prepaid orders with real products + HSN/rate snapshots:
  - **(a) intra-state prepaid, DELIVERED** — `shippingState='Karnataka'` (== store.state) → expect CGST+SGST.
  - **(b) inter-state prepaid, DELIVERED** — `shippingState='Maharashtra'` → expect IGST.
  - **(c) COD, PROCESSING** (pre-payment) — invoiceable, → CGST/SGST or IGST per its state.
  Then call the running backend `POST /admin/orders/:id/invoice` + `GET /admin/orders/:id/invoice/pdf` (admin cookie, same mint pattern as the D1b demos) and write each PDF to `scratchpad/invoice-{a,b,c}.pdf`.
- [ ] **Step 2: Immutability check.** Re-`GET .../invoice/pdf` for (a); assert the number is unchanged and the bytes are byte-identical to the first download. Drift a product's `gstRate`, re-download, assert **still identical** (snapshot frozen).
- [ ] **Step 3: Hand off.** `SendUserFile` the three PDFs with a note: which is intra vs inter vs COD-pre-payment, the invoice numbers (FY series), and the immutability result. **PAUSE for human approval.** Clean up the demo orders after approval (reuse the D1b cleanup pattern; delete `DEMO-INV-*` orders + their invoices).

---

## PHASE E — Frontend (Admin) — after checkpoint approval

### Task 12: Types, api methods, gating, hooks, radio-group

**Files:** Modify `Admin/src/types/order.ts`, `lib/api.ts`, `lib/query-keys.ts`, `lib/order-badges.ts` (+ `.test.ts`), `hooks/use-orders.ts`, `hooks/use-order-mutations.ts`; create `Admin/src/components/ui/radio-group.tsx`.

- [ ] **Step 1: Types.** In `types/order.ts` add:
```ts
export type RefundMethod = 'PHONEPE' | 'MANUAL';
export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';
export type RefundDisposition = 'RETURNED' | 'DAMAGED' | 'LOST';
export interface Refund {
  id: string; method: RefundMethod; status: RefundStatus; disposition: RefundDisposition;
  amountMinor: number; utrReference: string | null; merchantRefundId: string | null;
  providerRefundId: string | null; reason: string | null; createdAt: string;
}
export interface InvoiceMeta { number: string; fy: string; issuedAt: string; }
export interface RefundBody { disposition: RefundDisposition; reason?: string; }
export interface ManualRefundBody { utrReference: string; disposition: RefundDisposition; reason?: string; }
```
Replace `refunds: unknown[]` with `refunds: Refund[]` on `OrderDetail`, and add `invoice: InvoiceMeta | null;` and `shipments: Array<{ id: string; carrier: string | null; trackingNumber: string | null; status: string; events: Array<{ status: string; description: string | null; occurredAt: string }> }>;`.

- [ ] **Step 2: api methods.** In `lib/api.ts` `orders` block add:
```ts
refund: (id: string, body: RefundBody) => request<{ id: string; status: string }>('POST', `/admin/orders/${id}/refund`, body),
manualRefund: (id: string, body: ManualRefundBody) => request<{ id: string; status: string }>('POST', `/admin/orders/${id}/refund/manual`, body),
recheckRefund: (id: string) => request<{ id: string; state: string }>('POST', `/admin/orders/${id}/refund/recheck`, {}),
getInvoice: (id: string) => request<InvoiceMeta | null>('GET', `/admin/orders/${id}/invoice`),
generateInvoice: (id: string) => request<InvoiceMeta>('POST', `/admin/orders/${id}/invoice`),
invoicePdf: async (id: string): Promise<Blob> => {
  const res = await fetch(`${API_BASE}/admin/orders/${id}/invoice/pdf`, { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, 'Failed to download invoice');
  return res.blob();
},
```
(Reuse the module's `API_BASE`/`ApiError`; if `API_BASE` isn't exported at that scope, read it the same way `request` builds its URL.)

- [ ] **Step 3: Gating (pure, TDD).** Write the failing test then implement in `lib/order-badges.ts`:
```ts
// order-badges.test.ts (append)
test('canRefundOrderStatus mirrors the backend REFUNDABLE_STATUSES', () => {
  for (const s of ['SHIPPED', 'DELIVERED', 'CANCELLED'] as const) assert.equal(canRefundOrderStatus(s), true);
  for (const s of ['PENDING', 'PAID', 'PROCESSING', 'REFUNDED'] as const) assert.equal(canRefundOrderStatus(s), false);
});
test('refundGate requires a refundable status AND the ADMIN role', () => {
  assert.equal(refundGate({ status: 'DELIVERED' }, 'ADMIN').allowed, true);
  assert.equal(refundGate({ status: 'DELIVERED' }, 'MANAGER').allowed, false);
  assert.match(refundGate({ status: 'DELIVERED' }, 'MANAGER').reason!, /ADMIN-only/i);
  assert.match(refundGate({ status: 'PENDING' }, 'ADMIN').reason!, /cannot be refunded/i);
});
```
```ts
// order-badges.ts (append)
export const REFUNDABLE_STATUSES: readonly OrderStatus[] = ['SHIPPED', 'DELIVERED', 'CANCELLED'];
export function canRefundOrderStatus(status: OrderStatus): boolean {
  return REFUNDABLE_STATUSES.includes(status);
}
export function refundGate(order: { status: OrderStatus }, role: string): { allowed: boolean; reason?: string } {
  if (!canRefundOrderStatus(order.status)) {
    return { allowed: false, reason: `An order in ${order.status} cannot be refunded.` };
  }
  if (role !== 'ADMIN') return { allowed: false, reason: 'Refunds are ADMIN-only.' };
  return { allowed: true };
}
```

- [ ] **Step 4: Query key + hooks.** Ensure `qk.orders.detail(id)` exists (it does). Add `useOrder` to `hooks/use-orders.ts`:
```ts
export function useOrder(id: string) {
  return useQuery({ queryKey: qk.orders.detail(id), queryFn: () => api.orders.get(id), staleTime: 10_000 });
}
```
Add to `hooks/use-order-mutations.ts` (mirroring `useCancelOrder`'s invalidation): `useRefundOrder(id)`, `useManualRefund(id)`, `useRecheckRefund(id)`, `useGenerateInvoice(id)` — each `mutationFn` calls the matching api method and `onSettled` invalidates `qk.orders.detail(id)`; success/error toasts via the existing `toMessage`.

- [ ] **Step 5: radio-group component.** `cd Admin && npm i @radix-ui/react-radio-group` and add `components/ui/radio-group.tsx` (the standard shadcn RadioGroup/RadioGroupItem wrapper — copy the canonical shadcn source).

- [ ] **Step 6: Verify + commit.** `npm run typecheck && npm test` (Admin). Commit `feat(admin-orders): D3 types, api methods, refundGate (single-source gating), detail+mutation hooks, radio-group`.

### Task 13: Detail page shell + read-only sections
**Files:** Create `Admin/src/app/(dashboard)/orders/[id]/page.tsx` + `_detail/{order-header,line-items,totals-card,customer-card,payment-card,shipments-card,timeline,notes-section}.tsx`.
- [ ] **Step 1:** `page.tsx` — client component, `const { data: order, isLoading } = useOrder(params.id)`; skeleton while loading; not-found → a friendly empty state; on data, render the 2-column layout (§4.1 of the spec) composing the section components. Two-column via `grid lg:grid-cols-[1fr,360px] gap-6`.
- [ ] **Step 2:** Each section is a presentational component taking `order` (or a slice). `order-header` uses `OrderStatusBadge`/`PaymentBadge` (from D2 `_components/badges.tsx`) + the `RelativeDate` component (D2 `_components/relative-date.tsx`) + the gated action buttons (Cancel via `canCancelOrderStatus`, Refund via `refundGate` — see Task 14, Add note, Download invoice via `isInvoiceable`), each wrapped in a shadcn `Tooltip` showing the disabled reason. `line-items` renders the thumbnail (`productImageSnapshot`), name, `qty × unit = lineTotal`. `totals-card` renders subtotal/discount/shipping/tax/total. `timeline` maps `order.events` (actor `fullName` or "system", `RelativeDate` + absolute title). `notes-section` lists notes + an inline add-note form (reuse `useAddOrderNote`, a checkbox for `isCustomerVisible`).
- [ ] **Step 3:** Wire the D2 list row-click / row-actions "View" to `/orders/${id}` (it may already navigate — confirm `row-actions.tsx`).
- [ ] **Step 4: Verify + commit.** `npm run typecheck` + a component smoke test if practical. Commit `feat(admin-orders): order detail page — header + items + totals + customer + payment + shipments + timeline + notes`.

### Task 14: Refund dialog + panel (single action, both entry points)
**Files:** Create `Admin/src/app/(dashboard)/orders/[id]/_detail/{refunds-panel,refund-dialog}.tsx`.
- [ ] **Step 1:** `refund-dialog.tsx` — a controlled shadcn `Dialog` taking `order`. Branches on `order.paymentMethod`: PREPAID shows the disposition `RadioGroup` (Returned→restock / Damaged→no restock / Lost→no restock, each label states the effect) + optional reason → `useRefundOrder`; COD shows the same radio + a **required** `utrReference` input (client-validate non-empty) + reason → `useManualRefund`. Submit disables while pending; success closes + toasts; the panel reflects the new refund via detail invalidation.
- [ ] **Step 2:** `refunds-panel.tsx` — lists `order.refunds` (method/status/amount/disposition/UTR-or-ids/time badges). Renders the single `[Refund order]` trigger gated by `refundGate(order, role)` (role from `useAdminUser()`); disabled → tooltip with the reason. For a PENDING PhonePe refund show `[Re-check status]` (`useRecheckRefund`); for FAILED show the reason + `[Retry]` (re-opens the dialog).
- [ ] **Step 3:** In `order-header.tsx`, the header `[Refund ▾]` button opens **the same `RefundDialog`** via shared state and uses the **same `refundGate`** — one dialog instance controlled by page-level state, both triggers set it open. (Lift the dialog to `page.tsx` so header + panel share it.)
- [ ] **Step 4: Verify + commit.** `npm run typecheck`. Commit `feat(admin-orders): refund UI — one RefundDialog + refundGate behind both entry points, branch on payment method, live PENDING/FAILED status`.

### Task 15: Invoice download button (blob + revoke)
**Files:** Create `Admin/src/app/(dashboard)/orders/[id]/_detail/invoice-button.tsx`.
- [ ] **Step 1:** A button enabled when `isInvoiceable(order.status, order.paymentMethod)` (add the pure helper to `order-badges.ts` mirroring the backend, TDD it like Task 12 Step 3) else disabled + tooltip. On click: `const blob = await api.orders.invoicePdf(order.id); const url = URL.createObjectURL(blob); try { const a = document.createElement('a'); a.href = url; a.download = order.invoice ? \`${order.invoice.number}.pdf\` : \`invoice-${order.number}.pdf\`; a.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }`. Show a spinner while fetching; toast on error.
- [ ] **Step 2: Verify + commit.** `npm run typecheck`. Commit `feat(admin-orders): invoice download button — credentialed blob fetch + object-URL revoke`.

---

## PHASE F — Review + demo + finish

### Task 16: Adversarial review + full live demo + finish

- [ ] **Step 1:** Run `superpowers:requesting-code-review` (or the /code-review flow) over the whole D3 diff — focus: invoice immutability (re-gen returns identical snapshot+bytes), the counter's gap-freeness under a concurrent race, tax reconciliation, gating parity (MANAGER truly blocked front + back), no secret logging. Verify each finding; apply confirmed fixes.
- [ ] **Step 2: Live demo.** Start Backend + Admin. Drive a real order: open the detail page; add a note; (ADMIN) run a refund (COD manual UTR + a prepaid via the PhonePe-mock harness); confirm MANAGER sees the refund action disabled with the tooltip; download the invoice (blob) and confirm the object URL is revoked; re-download → identical; open an intra-state and an inter-state order → CGST/SGST vs IGST; a COD order at PROCESSING is invoiceable; a PENDING order's invoice button is disabled and `POST invoice` → 409.
- [ ] **Step 3:** `superpowers:finishing-a-development-branch` — verify Backend + Admin `typecheck`/`test` green, present merge/PR options, execute the choice. Update `fast-follows/admin-panel.md` if the review deferred anything.

---

## Self-Review

**Spec coverage:** detail page §4.1 → T13; gated actions §4.2 → T12 (refundGate) + T13/T15; refund UI §4.3 → T14; api/hooks/blob §4.4 → T12/T15; invoice engine §3.1–3.4 → T1–T9; triggers/gate §3.5 → T1 (isInvoiceable) + T10 (SHIPPED hook); endpoints §3.6 → T10; prereqs §3.1 → T5/T6; immutability §2.3 → T9 + T11 check; FY series §2.1 → T2 + T9; StoreSetting §2.2 → T5/T6; PDF checkpoint → T11. ✅

**Placeholder scan:** none — every code step has real code; the two "follow the canonical shadcn source" (radio-group) and "reuse the D1b cleanup pattern" (demo) reference concrete existing artifacts, not gaps. The pdfkit async correction is called out explicitly in Task 8 with the exact fix.

**Type consistency:** `computeInvoiceTax`→`InvoiceTaxResult` used by `buildSnapshot`→`InvoiceSnapshot` used by `renderInvoicePdf` + `InvoiceService`. `gstRatePercent`/`isInvoiceable` (T1) used in T5/T8/T9/T10. `financialYearOf`/`formatInvoiceNumber` (T2) used in T9. `InvoiceProfile` (T6) used in T8/T9. `refundGate`/`canRefundOrderStatus` (T12) used in T13/T14. `Refund`/`InvoiceMeta` types (T12) used across T13–T15. ✅

**Known follow-through:** the SHIPPED-hook module wiring (T10) must stay one-directional (ShipmentsModule→InvoicesModule) — verified at boot in T10 Step 4. The pdfkit render is async (T8 correction) — T9's `getPdf` awaits it.
