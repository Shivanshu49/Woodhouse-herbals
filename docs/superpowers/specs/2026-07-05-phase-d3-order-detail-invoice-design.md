# Phase D3 — Order detail UI + GST invoice (PDF) + refund UI — design

Recorded 2026-07-05. The final piece of Phase D Orders. Builds on D1 (admin-orders
backend + timeline), D2 (orders list UI), and D1b (refunds). Three cohesive pieces
on the order-detail surface: the **admin order detail page**, a **GST tax invoice**
(legal document, PDF, immutable), and the **refund UI** over the D1b endpoints.

## 1. Scope

- **Detail page** `/orders/[id]` (Admin app) — read the rich detail the D1 endpoint
  already returns, plus gated actions (cancel / refund / add note / download invoice).
- **GST invoice** — a compliant Indian tax invoice: per-line HSN + CGST/SGST-or-IGST,
  FY invoice-number series, generated once and immutable, PDF stored in Cloudflare R2.
- **Refund UI** — drives the D1b endpoints (prepaid PhonePe initiate/recheck, COD
  manual), ADMIN-only, restock choice explicit.

Out of scope (fast-follows / backlog): credit notes for refunds; a store-settings
editor UI; a storefront checkout state dropdown; a GST state-code enum. See §9.

## 2. Decisions (locked)

1. **Invoice number = financial-year series** `INV-YYYY-YY-NNNNN` (e.g. `INV-2026-27-00001`),
   reset per Indian FY (Apr 1–Mar 31), gap-free per FY via an atomic counter row.
2. **Store legal config lives in `StoreSetting`** (the table exists + is seeded), read
   through a typed `StoreProfileService`; invoice generation **503s** if GSTIN/state
   are unset (honest, mirrors the PhonePe-creds guard). Edited via a Settings page later.
3. **Invoice generated once, then immutable.** Auto-generated at the **SHIPPED**
   transition (correct time-of-supply; the invoice exists when the package needs it;
   fixes the FY-drift where a March-shipped order first downloaded in April would get
   the next FY's number). On-demand generate-on-first-hit remains the **backfill** path
   for orders shipped before this feature and for COD orders viewed pre-SHIPPED.
4. **Invoiceable gate differs by payment method.** COD: from **PROCESSING** onward
   (before payment — a GST goods invoice travels with the package). Prepaid: from
   **PAID** onward (money captured). PENDING and CANCELLED are never invoiceable.
5. **Restock choice = the disposition radio.** The D1b backend takes a 3-value
   `disposition` (RETURNED/DAMAGED/LOST) from which restock is derived; the UI presents
   exactly that radio with each option's restock consequence spelled out — one control,
   contradictory states unrepresentable, restock never silently defaulted.
6. **Invoice view/download = ADMIN + MANAGER** (a document, not money movement);
   **refunds remain ADMIN-only** (money movement).

Approved sub-decisions: order-level discount apportioned proportionally across lines
(correct GST treatment of invoice-time discounts); shipping taxed via a
`store.shippingGstRate` setting (default 18%); free-text buyer state matched by
normalized compare with an ambiguity flag on the invoice.

## 3. Backend — the invoice engine

New module `Backend/src/modules/invoices/`; shared `Backend/src/common/storage/`.

### 3.1 Prerequisites (resolve the §8 gaps)

- **Per-line HSN/GST snapshot.** Add `hsnSnapshot String?` + `gstRateSnapshot Int?`
  (integer percent: 0/5/12/18/28) to `OrderItem`. Populate at checkout in
  `orders.service.createFromCart` from `product.hsnCode` + `gstRatePercent(product.gstRate)`
  (a pure `GstRate → percent` map). **Existing orders (null snapshot) fall back to the
  product's CURRENT `hsnCode`/`gstRate`** at invoice time, and the invoice carries a
  visible *"HSN/rate from current catalogue"* flag. New orders are exact-at-sale.
- **Store profile settings.** `StoreProfileService.getInvoiceProfile()` reads
  `store.legalName` (fallback `store.name`), `store.gstin`, `store.address`, `store.pan`,
  and **new** `store.state`, `store.stateCode`, `store.shippingGstRate` (default 18) keys
  (seeded via the migration with placeholder values). Returns a typed
  `{ legalName, gstin, address, pan, state, stateCode, shippingGstRatePercent }`, or
  throws `ServiceUnavailableException` (503) if `gstin`/`state`/`legalName` are unset.
- **Invoice-number counter.** `model InvoiceCounter { fy String @id, next Int @default(1) }`.
  Allocate inside the invoice-creation transaction: `upsert` to ensure the FY row, then
  `update { next: { increment: 1 } }` returning the post-increment value; the allocated
  sequence = `next - 1`, formatted `INV-${fy}-${pad5(seq)}`. The counter-row lock
  serialises concurrent allocations → gap-free per FY.

### 3.2 `Invoice` model + immutability

```prisma
model Invoice {
  id        String   @id @default(cuid())
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  orderId   String   @unique          // one invoice per order
  number    String   @unique          // INV-2026-27-00001
  fy        String
  snapshot  Json                      // the FULL computed invoice (see 3.3)
  r2Key     String?                   // R2 object key (prod)
  pdfBytes  Bytes?                    // dev fallback when R2 is unconfigured
  issuedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
Add `invoice Invoice?` back-relation to `Order`. **Generation is idempotent**: if an
`Invoice` row exists, `generateForOrder` returns it verbatim (never recomputes) — the
`snapshot` + stored PDF are the frozen legal record even if catalogue/profile drift.

### 3.3 Tax math (pure, TDD'd)

`invoice-tax.ts` — GST-inclusive prices. Input: lines `[{ name, hsn, qty,
unitPriceMinor, lineTotalMinor, gstRatePercent }]`, `discountMinor`, `shippingMinor`,
`shippingGstRatePercent`, buyer state, store state.

1. **Apportion the order-level discount** proportionally by line-total share:
   `lineDiscount_i = round(discount × lineTotal_i / Σ lineTotal)`; assign the rounding
   remainder to the largest line so `Σ lineDiscount == discount`.
2. `netLine_i = lineTotal_i − lineDiscount_i` (still GST-inclusive).
3. `taxable_i = round(netLine_i × 100 / (100 + rate_i))`; `tax_i = netLine_i − taxable_i`.
4. **Shipping** (if `shippingMinor > 0`) is its own line at `shippingGstRatePercent`:
   `taxableShip = round(shipping × 100 / (100 + shipRate))`, `taxShip = shipping − taxableShip`.
5. **Place of supply** — normalize both states (trim, lowercase, collapse internal
   whitespace) and compare deterministically:
   - `intra` iff buyer state is non-empty AND `normalize(buyer) === normalize(store)` ⇒
     `cgst_i = sgst_i = round(tax_i / 2)`, remainder to CGST so `cgst + sgst == tax_i`;
     `igst_i = 0`.
   - otherwise `inter` ⇒ `igst_i = tax_i`; `cgst = sgst = 0`.
   - set `ambiguousPlaceOfSupply` (rendered as a caution note) when the buyer state is
     blank or not in the known-Indian-states set — so the admin verifies before relying
     on it. The split still computes (as inter-state) so the invoice is never blocked.
6. **Aggregate** per rate-slab `{ rate, taxable, cgst, sgst, igst }` + grand totals.
   Invariant: `Σ (taxable + tax) == order.totalMinor` (holds by construction, since
   `taxable_i + tax_i = netLine_i` and `Σ netLine + netShipping = subtotal − discount +
   shipping = total`). The invoice's tax total is per-line-exact and may differ from the
   flat `Order.taxMinor` (an approximation from checkout); **the invoice is authoritative**.
7. **`amount-to-words.ts`** — pure `amountToWordsINR(minor)` → Indian numbering
   (lakh/crore), `"Rupees … and Paise … Only"`.
8. **`invoice-number.ts`** — pure `financialYearOf(date)` (Apr–Mar → `"2026-27"`) and
   `formatInvoiceNumber(fy, seq)`; the DB increment is verified by the live demo.

### 3.4 PDF + storage

- **`pdfkit`** — `invoice-pdf.ts`: `snapshot → Buffer`, server-side, no headless
  chromium. Layout: store legal header + GSTIN + PAN; buyer name/address + GSTIN
  (`order.shippingGstin`) if B2B; invoice number + date; order number; per-line table
  (HSN / qty / rate / taxable / CGST / SGST / IGST); rate-slab + grand totals; amount in
  words; COD-vs-prepaid payment note; the catalogue-fallback / place-of-supply flags if
  set; "computer-generated invoice — no signature required" footer.
- **`ObjectStorageService`** (`common/storage/`) — R2 via `@aws-sdk/client-s3` (S3-compatible,
  endpoint from `R2_ACCOUNT_ID`). `isConfigured()`, `put(key, buffer, contentType)`,
  `get(key) → Buffer`. R2 is **private**; the admin never receives a raw R2 URL. **Dev
  fallback**: when R2 is unconfigured, the `Invoice.pdfBytes` column holds the PDF and the
  download route streams from there — the demo runs without R2 creds.

### 3.5 Generation triggers + invoiceable gate

- **Auto at SHIPPED** — `shipments.service`, on the transition to SHIPPED, calls
  `InvoiceService.generateForOrder(orderId)` **after the tx commits, best-effort**
  (try/catch → log a warning; never blocks the shipment). A 503 (profile unset) leaves
  the invoice for on-demand backfill. Wiring: `ShipmentsModule` imports `InvoicesModule`
  (one-directional — `InvoicesModule` does not import `ShipmentsModule`; no cycle).
- **On-demand backfill** — the endpoints below generate on first hit.
- **`isInvoiceable(status, paymentMethod)`** (pure): COD ⇒ `{PROCESSING, SHIPPED,
  DELIVERED, REFUNDED}`; PREPAID ⇒ `{PAID, PROCESSING, SHIPPED, DELIVERED, REFUNDED}`.
  PENDING and CANCELLED are never invoiceable → `409` with an explanatory message.

### 3.6 Endpoints (`@Roles(ADMIN, MANAGER)`, throttled, audited)

- `POST /admin/orders/:id/invoice` → `generateForOrder` (idempotent) → `{ number, issuedAt }`.
- `GET  /admin/orders/:id/invoice` → metadata, or `404` if not yet generated.
- `GET  /admin/orders/:id/invoice/pdf` → streams `application/pdf` (generates on first hit).

## 4. Frontend — detail page + refund UI (Admin app)

### 4.1 Layout `/orders/[id]` (2-column desktop, stacked mobile)

```
Header: ← Orders · number · OrderStatusBadge · PaymentBadge(COD-aware) ·
        placedAt (relative + absolute) · [Cancel] [Refund ▾·ADMIN] [Add note] [⬇ Invoice]
Left (main):  Line items (thumbnail snapshot · name · qty×unit = line total)
              Totals (subtotal / discount / shipping / tax incl. / total)
              Timeline (full OrderEvent list · resolved actor.fullName · relative+absolute)
              Notes (list + inline add-note · isCustomerVisible toggle)
Right (rail): Customer & shipping (state · GSTIN if shippingGstin set)
              Payment (method · PhonePe txn ref · payments[])
              Shipments (carrier · AWB · events)
              Refunds panel (refund rows + the refund action)
```

### 4.2 Gated actions — one source of truth

A single pure `refundGate(order, role) → { allowed, reason? }` combining a new
`canRefundOrderStatus(status)` (mirrors the backend `REFUNDABLE_STATUSES` =
{SHIPPED, DELIVERED, CANCELLED}) **and** `role === 'ADMIN'`. **Both** refund entry
points — the header `[Refund ▾]` and the refunds-panel button — call this gate and open
the **same `<RefundDialog order />`**; the rules live in exactly one place. Other gates:
`canCancelOrderStatus` (PENDING/PAID/PROCESSING); invoice download enabled for
`isInvoiceable`. Blocked buttons are disabled with a tooltip stating the reason
(non-admin refund → *"Refunds are ADMIN-only"*).

### 4.3 Refund dialog (branches on `paymentMethod`)

- **PREPAID → "Refund via PhonePe":** disposition radio — **Returned → restock** /
  **Damaged → no restock** / **Lost → no restock** — + optional reason → `initiate`.
- **COD → "Mark refunded (manual)":** the same disposition radio + a **mandatory UTR**
  field (non-empty, mirrors `ManualRefundDto`) + optional reason → `manual` → PROCESSED.
- **Live status** from the order's `refunds[]`: PENDING (PhonePe) → **[Re-check status]**
  (`recheck`); FAILED → **[Retry]** + the failure reason; PROCESSED → done badge. Each
  refund row shows method · status · amount · disposition · UTR (COD) or
  merchant/providerRefundId (PhonePe) · actor · time.

### 4.4 API client + hooks

- `api.ts`: `orders.refund(id,{disposition,reason})`, `orders.manualRefund(id,
  {utrReference,disposition,reason})`, `orders.recheckRefund(id)`, `orders.getInvoice(id)`,
  `orders.generateInvoice(id)`, and **`orders.invoicePdf(id)` fetched as a Blob via the
  credentialed client** (httpOnly cookies won't ride a cross-origin `<a href>` in prod;
  a blob download does). The download helper does `URL.createObjectURL` → click → and
  **`URL.revokeObjectURL` in a `finally`/`setTimeout`** so repeated downloads don't leak
  blobs in a long-lived admin tab.
- Hooks: `use-order`, `use-order-mutations` (refund / manualRefund / recheck /
  generateInvoice) with react-query invalidation so the refunds panel + timeline update
  live. `order-badges.ts` gains `canRefundOrderStatus`. Types: `OrderDetail`, `Refund`,
  `Invoice`.

## 5. File structure

**Backend (new unless noted):**
- `prisma/schema.prisma` + migration — OrderItem `hsnSnapshot`/`gstRateSnapshot`;
  `Invoice`; `InvoiceCounter`; `Order.invoice`; seed `store.state`/`store.stateCode`/
  `store.shippingGstRate`.
- `modules/invoices/` — `invoice-tax.ts` (+ test), `amount-to-words.ts` (+ test),
  `invoice-number.ts` (+ test), `invoice-pdf.ts`, `invoice.service.ts`, `dto/`,
  `invoices.controller.ts`, `invoices.module.ts`.
- `common/storage/object-storage.service.ts` (+ module) — R2 client.
- `modules/store-settings/store-profile.service.ts` (or reuse an existing settings
  service if present) — typed store profile + 503 guard.
- `modules/invoices/gst-rate.ts` — `gstRatePercent(GstRate)` + `isInvoiceable(...)`.
- Modified: `orders.service.ts` (snapshot HSN/rate at checkout); `shipments.service.ts`
  + `shipments.module.ts` (auto-gen at SHIPPED, best-effort); `admin-orders.service.ts`
  (include product `hsnCode`/`gstRate` on items for the fallback + surface `invoice`);
  `app.module.ts` (register modules); `env.ts` (R2 already declared).

**Admin (new unless noted):**
- `app/(dashboard)/orders/[id]/page.tsx` + `_detail/` components (`order-header`,
  `line-items`, `totals-card`, `customer-card`, `payment-card`, `shipments-card`,
  `refunds-panel`, `timeline`, `notes-section`, `refund-dialog`, `invoice-button`).
- Modified: `lib/api.ts` (+ methods above), `lib/order-badges.ts` (+ `canRefundOrderStatus`,
  `refundGate`), `types/order.ts` (+ `OrderDetail`/`Refund`/`Invoice`), hooks.

## 6. Build order

1. Schema + migration + `gstRatePercent`/`isInvoiceable` + checkout snapshot.
2. Pure TDD: `invoice-tax`, `amount-to-words`, `invoice-number` (financial year + format),
   `canRefundOrderStatus`/`refundGate`.
3. `StoreProfileService` + `ObjectStorageService` (R2 + dev fallback).
4. `InvoiceService` (compute → PDF → store, idempotent) + `invoice-pdf`.
5. Invoice endpoints + auto-gen wiring at SHIPPED; detail-API item include tweak.
6. Admin api + hooks + `refundGate`/badges.
7. Detail page shell + sections (header/items/totals/customer/payment/shipments/timeline/notes).
8. Refund dialog + panel (single action, both entry points) + live status.
9. Invoice button (blob download + revoke).
10. Adversarial review + live demo.

## 7. Verification

- **Pure units (TDD, Red→Green):** tax split (intra CGST/SGST vs inter IGST; inclusive→
  taxable; discount apportionment reconciling to total; shipping line), amount-in-words
  (Indian format edge cases), invoice-number (FY boundary Mar↔Apr; pad), `isInvoiceable`
  per method/status, `canRefundOrderStatus`/`refundGate`.
- **Backend live demo:** generate an invoice → PDF renders with correct per-line tax →
  **immutable re-download returns the SAME number + bytes** (drift a product's rate, regen,
  confirm unchanged) → an **intra-state** order (buyer state == store state) shows CGST+SGST
  and an **inter-state** order shows IGST → auto-gen fires at SHIPPED → a **COD order is
  invoiceable at PROCESSING** (pre-payment) → PENDING/CANCELLED → 409.
- **Admin:** drive the detail page + both refund entry points (same dialog) against the
  running API; MANAGER sees the refund action disabled with the tooltip; invoice downloads
  as a blob and the object URL is revoked.
- **Adversarial review** before merge (money/immutability/gating). Gates: Admin + Backend
  `typecheck` + `test` green.

## 8. §8 prerequisite resolution (from the Phase-D spec)

1. HSN/GST snapshot → §3.1 (snapshot going forward + current-catalogue fallback for old orders).
2. COD/payment method → already shipped in D1b (`Order.paymentMethod`); the invoiceable
   gate branches on it (§3.5).
3. Store GSTIN + state settings → §3.1 (`StoreProfileService`, new `store.state`/`stateCode`).
4. Invoice-number sequence → §3.1 (`InvoiceCounter`, FY series).
5/6. Inventory reasons + OrderEvent writer → already in place from D1/D1b.

## 9a. Pre-launch checklist (must clear before go-live — NOT part of the D3 build)

- **Replace the placeholder store invoice profile with REAL values** — `store.legalName`,
  real `store.gstin`, `store.pan`, registered `store.address`, `store.state` +
  `store.stateCode`. The D3 build seeds *placeholder* values (fake GSTIN
  `29ABCDE1234F1Z5`) so generation doesn't 503 in dev; **the fake GSTIN must never
  survive to production.** `StoreProfileService` 503s until every required field is set.
  (Sits alongside the D1b pre-launch item: real PhonePe SANDBOX refund verification.)
- **Configure R2** (`R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`)
  so invoice PDFs persist to R2 rather than the `pdfBytes` dev fallback.

## 9. Out of scope — fast-follows / backlog

- **FF — Credit notes for refunds.** GST-proper refund documentation references the
  original invoice number; v1 ships without. A REFUNDED order's original invoice stays
  immutable; the credit note (its own numbered document referencing the invoice) lands later.
- **FF — GST state-code enum.** Replaces the normalized free-text state match (removes the
  place-of-supply ambiguity flag).
- **BACKLOG (storefront) — state dropdown at checkout** using GST state codes instead of
  free text — kills the state ambiguity at the source.
- **Composite-supply shipping tax** — `store.shippingGstRate` defaults to 18%; taxing
  shipping at the principal goods' rate is the alternative reading. Confirm with the
  accountant before launch; the setting makes it a one-line change either way.
- **Store-settings editor UI** (Phase F) — for now the profile values are set by seed/one-off.
