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
- Build the PhonePe **refund API integration** (signed request, provider refund
  txn id, status polling/callback) — none exists today.
- `POST /admin/orders/:id/refund` — amount-validated (≤ refundable remaining),
  **idempotent** (idempotency key + provider refund id unique), creates a
  `Refund` row, transitions the order to `REFUNDED` / `PARTIALLY_REFUNDED`, sets
  `PaymentStatus`, restocks inventory via the Inventory module, writes a
  `refund_issued` event. `@Roles(ADMIN)`.

### D2 — Orders list UI
TanStack Table (like products): columns (number, date, customer, total, status
badge, payment badge), filters (status/payment/date/search), pagination, row →
detail. Optimistic-free (orders are lower-volume; keep it simple + invalidation).

### D3 — Order detail UI
Items, customer + address, totals breakdown, payment(s), shipments with a
tracking-entry action (reusing `shipments`), cancel action, notes (internal /
customer-visible), the timeline, the refund action (ADMIN-only, D1b), and a
**PDF invoice** download (client-side from the detail data).

## 6. Out of scope / deferred
- Partial-item refunds & returns/RMA (whole-order or amount refunds only in D1b).
- Manual order creation from the admin (phone orders) — later.
- Shiprocket auto-fulfillment (deferred project-wide).
- STAFF-role login path (STAFF unused after the role alignment).

## 7. Verification
Per step: unit tests (state-machine transitions, refund amount/idempotency,
list filters, the payload/timeline mapping), an adversarial review, and a live
demo (create a real PENDING order → pay via the PhonePe sandbox flow or seed a
PAID order → drive it through PROCESSING/SHIPPED/DELIVERED → note → cancel →
[D1b] refund → verify state + events in the DB). Gates: Admin + Backend
`typecheck` + `test` green.
