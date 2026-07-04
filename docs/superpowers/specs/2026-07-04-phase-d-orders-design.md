# Phase D — Orders management (admin) — design

Recorded 2026-07-04. First slice of Phase D (Orders → then Categories →
Inventory page → Content). Same discipline as Phase C: each step is TDD-first,
adversarially reviewed, and live-demoed before commit.

## 1. Context — what exists

Customer + payment flow is built; the **admin surface is not**.

- `orders` module (customer-facing): `POST /orders` (create from cart),
  `GET /orders/:number` (guest/owner), `GET /orders` (own orders).
- `phonepe` module: `POST /phonepe/initiate`, `POST /phonepe/callback` (webhook,
  X-VERIFY signature, idempotent, PENDING-guarded). Drives PENDING → **PAID** on
  success, PENDING → **CANCELLED** on failure. **No refund method exists.**
- `shipments` module (currently `@Roles(ADMIN, STAFF)`): `POST /shipments`,
  `PATCH /shipments/:id`. Drives → **PROCESSING** / **SHIPPED** / **DELIVERED**.
- Models from Phase A: `OrderItem`, `Payment`, `Shipment`, `OrderNote`
  (`body`, `authorId`, `isCustomerVisible`), `OrderEvent` (`type`, `fromStatus`,
  `toStatus`, `actorId`, `note`, `meta`), `Refund` (`amountMinor`,
  `providerRefundId`, `status`, `actorId`).
- **`OrderEvent` is never written today** — the timeline model is empty.

## 2. The order-status state machine (authoritative — the UI must match)

`OrderStatus`: **PENDING → PAID → PROCESSING → SHIPPED → DELIVERED**, plus
**CANCELLED** and **REFUNDED**. `PaymentStatus`: INITIATED / SUCCESS / FAILED /
REFUNDED / PARTIALLY_REFUNDED. The admin invents no new states.

Admin-allowed transitions (validated server-side):
- PENDING/PAID/PROCESSING → **CANCELLED** (admin cancel; a refund is separate).
- PAID → **PROCESSING**, PROCESSING → **SHIPPED**, SHIPPED → **DELIVERED** — via
  the existing `shipments` endpoints (create shipment w/ tracking → SHIPPED; mark
  delivered → DELIVERED).
- Any paid order → **REFUNDED** / PARTIALLY_REFUNDED — **D1b only** (money move).
- PENDING → PAID/CANCELLED stays automatic (PhonePe webhook); the admin never
  sets PAID by hand.

### 2.1 Actions allowed by state (explicit matrix)

| State | Cancel | Fulfil (ship/deliver) | Refund | Note |
|---|---|---|---|---|
| PENDING | ✅ (unpaid → just cancel + release any reserved stock) | — | — | ✅ |
| PAID | ✅ (pre-shipment) → CANCELLED + restock; **refund owed** (D1b) | → PROCESSING | ✅ (D1b) | ✅ |
| PROCESSING | ✅ (pre-shipment) → CANCELLED + restock; **refund owed** | → SHIPPED | ✅ (D1b) | ✅ |
| SHIPPED | ❌ **no cancel** — refund path only | → DELIVERED | ✅ (D1b) | ✅ |
| DELIVERED | ❌ no cancel | — | ✅ (D1b) | ✅ |
| CANCELLED | terminal | — | ✅ if it was paid (D1b) | ✅ |
| REFUNDED / PARTIALLY_REFUNDED | terminal | — | — (partial → FF) | ✅ |

**Cancel is pre-shipment only** (PENDING / PAID / PROCESSING). Once SHIPPED there
is no cancel — money comes back through the refund path. Every action is
status-guarded server-side and rejects (409) an illegal transition.

### 2.2 Restock policy (cancel vs refund)

- **Cancel before shipment** → **auto-restock**, a stock movement with reason
  `ORDER_CANCELLED` (the reason already exists; no new enum value). The goods
  never left, so they safely re-enter sellable inventory.
- **Refund after delivery** → **never silently restock**. The admin gets an
  explicit "restock these items?" choice: yes → movement reason `RETURNED`;
  no → no movement (optionally reason `DAMAGED` on a note). Returned goods may be
  used/damaged and must not re-enter sellable stock by default.

## 3. Roles (decided)

- Order management (list, detail, notes, cancel, fulfillment): **ADMIN + MANAGER**.
- **Refunds: ADMIN only** — the `UserRole` enum comment defines MANAGER as
  "everything except settings, user management, and **refunds**."
- Align the existing `shipments` endpoints from `@Roles(ADMIN, STAFF)` to
  `@Roles(ADMIN, MANAGER)` so the whole admin panel is consistent (STAFF has no
  admin-panel login path; it was a pre-Phase-A leftover). Small, in-scope change.

## 4. Timeline (decided)

**Write `OrderEvent` on every state change**, going forward, from all drivers:
- admin actions (status change, cancel, note, refund),
- the PhonePe webhook (PENDING→PAID/CANCELLED),
- the shipments transitions (→PROCESSING/SHIPPED/DELIVERED).

Add a small `OrderEventsService.record({orderId, type, fromStatus, toStatus,
actorId, note, meta})` and call it from those three drivers. The detail timeline
reads `OrderEvent` ordered by `createdAt`. Existing/legacy orders show only
events created after this ships (acceptable; a one-off backfill from
payment/shipment timestamps can be a fast-follow if the empty history matters).

## 5. Steps

### D1 — `admin-orders` backend (no money movement)
- `GET /admin/orders` — list all orders. Filters: `status`, `paymentStatus`,
  date range, `q` (number / customer name / phone / email), pagination, sort.
  Thin `SUMMARY_SELECT` (number, date, customer, total, status, paymentStatus,
  itemCount). Reuse the shared `PaginationDto`; mirror `admin-products` list.
- `GET /admin/orders/:id` — full detail: items (with product snapshot), customer,
  shipping-address snapshot, totals breakdown, payments, shipments+tracking,
  notes, refunds, and the `OrderEvent` timeline.
- `POST /admin/orders/:id/notes` — add an OrderNote (`isCustomerVisible` flag) +
  write a `note_added` event.
- `POST /admin/orders/:id/cancel` — status-guarded CANCELLED (reason) + event.
  (No auto-refund; refunding a paid+cancelled order is a D1b action.)
- `OrderEventsService` + patch `phonepe.service` and `shipments.service` to
  record events on their transitions.
- Guard: `@Roles(ADMIN, MANAGER)` + `AdminAuditInterceptor`.

### D1b — Refunds (ADMIN-only; heavily reviewed; money movement)
**v1 = FULL-order refund only.** Partial (per-line/partial-amount) refunds are a
recorded fast-follow — partial refund + partial restock + partial invoice credit
is a complexity multiplier not needed at launch.

The refund flow **branches on how the order was paid** (PhonePe refunds only work
for prepaid):
- **Prepaid** (order has a SUCCESS PhonePe `Payment`) → build the PhonePe
  **refund API integration** (signed request, provider refund txn id,
  status via callback/poll) — none exists today. `POST /admin/orders/:id/refund`.
- **COD** (no online payment; paid on delivery) → **"mark refunded manually"**:
  no API call, but a **mandatory reference note** (bank/UPI UTR or transaction
  ref) is required; the money went back out-of-band via transfer/UPI.
  `POST /admin/orders/:id/refund/manual`.

Both branches: amount = the full order total, **idempotent** (idempotency key +
unique provider/manual ref), create a `Refund` row (with the reference), set
`OrderStatus = REFUNDED` and the `PaymentStatus`, apply the **refund restock
choice** (§2.2), and write a `refund_issued` `OrderEvent` (same audit trail for
both). `@Roles(ADMIN)`.

> Prereq: COD isn't modeled yet (no `paymentMethod` field). D1b resolves prepaid
> vs COD by "does the order have a SUCCESS PhonePe payment?"; if COD checkout
> lands first, add an explicit `Order.paymentMethod` and branch on that instead.
> See §8.

### D2 — Orders list UI
TanStack Table (like products): columns (number, date, customer, total, status
badge, payment badge), filters (status/payment/date/search), pagination, row →
detail. Optimistic-free (orders are lower-volume; keep it simple + invalidation).

### D3 — Order detail UI + GST-compliant invoice
Items, customer + address, totals breakdown, payment(s), shipments with a
tracking-entry action (reusing `shipments`), cancel action (per §2.1), notes
(internal / customer-visible), the timeline, and the refund action (ADMIN-only,
D1b).

**GST invoice (PDF):** the invoice is a legal tax document, not a receipt. It must:
- carry our **store GSTIN** and registered address (from a StoreSetting);
- show **per-line HSN codes** and per-line taxable value (HSN was captured in the
  product pricing group);
- split GST by place of supply: **buyer state == our state → CGST + SGST** (each
  half the GST); **buyer state != our state → IGST** (full). The buyer's state
  comes from the shipping-address snapshot; back-calc the GST component from the
  GST-inclusive line totals (extend `order-pricing.ts`, which already computes the
  single `taxMinor`);
- use a **sequential invoice number** (`INV-2026-00001`), a continuous series
  independent of the order id/number, allocated atomically at first-invoice time.
Generate the PDF client-side from a `GET /admin/orders/:id/invoice` data payload
that returns the computed split + invoice number.

> Prereqs (see §8): `OrderItem` does not snapshot HSN/gstRate; store GSTIN +
> state settings and the invoice-number sequence do not exist yet.

## 6. Out of scope / deferred
- **Partial refunds** (partial amount / per-line) + partial restock + partial
  invoice credit — **v1 is full-order-refund only**; partial is a recorded
  fast-follow.
- Returns/RMA workflow (beyond the refund restock choice).
- Manual order creation from the admin (phone orders) — later.
- Shiprocket auto-fulfillment (deferred project-wide).
- STAFF-role login path (STAFF unused after the role alignment).

## 8. Prerequisites surfaced by recon (must be resolved as each step needs them)

These are real gaps found while writing this spec; each is scoped to the step
that needs it, not a separate phase.

1. **`OrderItem` HSN/GST snapshot (D3 blocker).** OrderItem snapshots
   name/SKU/price but NOT `hsnCode`/`gstRate`. A compliant per-line invoice needs
   them. Preferred: snapshot `hsnSnapshot` + `gstRateSnapshot` on OrderItem at
   checkout (migration + a small checkout-service change) so the invoice reflects
   the rate at purchase time. Interim fallback: join OrderItem → Product at
   invoice time (drifts if the product's HSN/rate was edited after the sale).
2. **COD / payment method (D1b).** No `Order.paymentMethod`; prepaid vs COD is
   inferred from "has a SUCCESS PhonePe payment." If/when COD checkout ships, add
   an explicit `paymentMethod` enum and branch on it.
3. **Store GSTIN + registered state settings (D3).** Not among the seeded
   StoreSettings — add `store.gstin` + `store.state` (drives the GSTIN on the
   invoice and the CGST/SGST-vs-IGST place-of-supply split).
4. **Invoice-number sequence (D3).** No sequence exists. Add an atomic counter
   (dedicated row/model or a Postgres sequence) producing the continuous
   `INV-YYYY-NNNNN` series, allocated once per order at first invoice.
5. **No new InventoryReason needed** — `ORDER_CANCELLED` (cancel restock),
   `RETURNED` (refund restock), and `DAMAGED` already exist.
6. **`OrderEvent` writer** — add `OrderEventsService.record(...)` and call it from
   the admin actions AND retrofit the two existing drivers (`phonepe.service`
   PENDING→PAID/CANCELLED, `shipments.service` →PROCESSING/SHIPPED/DELIVERED) so
   the timeline is complete going forward.

## 7. Verification
Per step: unit tests (state-machine transitions, refund amount/idempotency,
list filters, the payload/timeline mapping), an adversarial review, and a live
demo (create a real PENDING order → pay via the PhonePe sandbox flow or seed a
PAID order → drive it through PROCESSING/SHIPPED/DELIVERED → note → cancel →
[D1b] refund → verify state + events in the DB). Gates: Admin + Backend
`typecheck` + `test` green.
