# Phase D1b — Refunds (admin) — design

Recorded 2026-07-05. The money-movement slice of Phase D Orders. Builds on D1
(admin-orders backend) and the D1 concurrency-hardening pattern (atomic
conditional-write CAS gating). ADMIN-only. Extra-heavy adversarial review — this
moves real money and must never leave an order in a dishonest state.

## 1. Recon findings (what exists / what's missing)

**PhonePe API scheme — legacy Standard Checkout / Hermes, X-VERIFY.** Our
`phonepe.service` signs `/pg/v1/pay` with
`X-VERIFY: sha256(base64 + endpoint + saltKey)###saltIndex` and verifies
callbacks with `sha256(rawBody + saltKey)###saltIndex` (`merchantId`/`saltKey`/
`saltIndex` creds). This is NOT PG v2 (OAuth bearer). The refund API is the same
scheme — **do not mix schemes**.

- **The pay is client-driven** (server returns the checksum; the browser POSTs to
  PhonePe). So **no server→PhonePe HTTP call exists today.** Refunds are the first
  server-side S2S call → we add a small signed HTTP client. `PHONEPE_BASE_URL`
  env var already exists (required in prod; no dev fallback). Hosts: sandbox
  `https://api-preprod.phonepe.com/apis/pg-sandbox`, prod
  `https://api.phonepe.com/apis/hermes`; refund path `/pg/v1/refund`.
- **Refund is async.** Immediate response is `PAYMENT_PENDING` / `state: PENDING`,
  settling to `COMPLETED` (success) or `FAILED` (money did NOT move), usually
  within ~90 s. Final status arrives via **both** an S2S callback (same
  `sha256(base64Response + saltKey)###saltIndex` verify we already use) **and** a
  Check-Status poll (`GET /pg/v1/status/{merchantId}/{refundMerchantTxnId}`,
  `X-VERIFY = sha256("/pg/v1/status/{merchantId}/{id}" + saltKey)###saltIndex`).
  PhonePe: rely on the callback, reconcile with polling.
- **Refund request payload** (base64 inside `{request}`): `merchantId`,
  `merchantUserId`, `originalTransactionId` (= the ORIGINAL payment's
  `merchantTransactionId` = our `Payment.providerTxnId`), `merchantTransactionId`
  (= a NEW refund id we mint), `amount` (paise), `callbackUrl`. Response
  `data.transactionId` = PhonePe's refund txn id → our `providerRefundId`.
- **Idempotency (provider):** PhonePe does not publish an explicit re-POST-safe
  guarantee. Safe pattern = persist the refund's `merchantTransactionId` first,
  and on a timeout/uncertain result, **Check-Status by that same id before ever
  re-POSTing** — never mint a fresh id. PhonePe tracks cumulative refunded amount
  against `originalTransactionId` and rejects over-refunds
  (`EXCESS_REFUND_AMOUNT`).

**Schema gaps.** `Refund` exists (`amountMinor`, `providerRefundId @unique`,
`status`, `reason`, `actorId`, `paymentId`, `rawResponse`) but lacks `method`,
`utrReference`, `merchantRefundId`, and a disposition. `PaymentStatus` lacks
`REFUND_PENDING`. `RefundStatus` is `PENDING/PROCESSED/FAILED` (**`PROCESSED` =
settled/success**). No idempotency constraint. `InventoryReason` already has
`RETURNED` + `DAMAGED` (no new value needed; LOST goods don't move stock).

**Appendix — deprecation (not scope).** The legacy Hermes `/pg/v1/*` X-VERIFY API
is superseded by PG v2 (OAuth, `/pg/v2/refund`). A migration may eventually be
forced. Tracked as a future item; refunds are built on the legacy scheme our pay
flow already uses.

## 2. Decisions (locked)

1. **Refundable states = {SHIPPED, DELIVERED, CANCELLED-if-it-was-paid}.**
   PAID/PROCESSING are NOT directly refundable — they must be **cancelled first**
   (D1 cancel, which restocks pre-shipment), then the CANCELLED-paid order is
   refunded. SHIPPED is directly refundable and matters doubly: lost-in-transit
   **and RTO** (return-to-origin — undeliverable orders couriers bring back, very
   common in India). REFUNDED is terminal.
2. **Restock choice applied at INITIATION.** Stock reflects physical reality at
   the moment the admin processes the refund. A later money FAILURE never reverses
   the restock (the goods are physically back); the admin retries only the money.
3. **COD manual refund = one-step `PROCESSED`** with a mandatory UTR. The UTR
   proves the out-of-band transfer already happened — no PENDING theater.
4. **Restock applies to BOTH paths.** A COD RTO with goods in hand needs restock
   exactly like a prepaid return.
5. **Disposition enum `{RETURNED, DAMAGED, LOST}`** (one field, both paths):
   - `RETURNED` → restock, one inventory movement reason `RETURNED`.
   - `DAMAGED` → no restock (goods unsellable). No movement; disposition recorded
     on the `Refund`.
   - `LOST` → no restock (goods gone / lost in transit). No movement; recorded on
     the `Refund`. Semantically distinct from DAMAGED for audit/analytics; needs
     no `LOST` inventory reason because lost goods never re-enter stock.
6. **ADMIN-only** on every refund endpoint (MANAGER excluded per the `UserRole`
   comment), rate-limited, `AdminAuditInterceptor`.
7. **Failure honesty.** Persist before calling; never guess. A `recheck` action
   polls Check-Status and adopts the true state. An order must never show
   `REFUNDED` unless the money actually settled (`state: COMPLETED`).

## 3. Schema changes (one migration)

```prisma
enum RefundMethod { PHONEPE  MANUAL }
enum RefundDisposition { RETURNED  DAMAGED  LOST }

// PaymentStatus: add REFUND_PENDING (SUCCESS → REFUND_PENDING → REFUNDED)
enum PaymentStatus { INITIATED  SUCCESS  FAILED  REFUND_PENDING  REFUNDED  PARTIALLY_REFUNDED }

model Refund {
  // ...existing: id, orderId, paymentId?, amountMinor, currency, reason?,
  //   status (RefundStatus: PENDING/PROCESSED/FAILED), providerRefundId? @unique,
  //   rawResponse?, actorId? (= initiatedBy), createdAt, updatedAt
  method           RefundMethod
  disposition      RefundDisposition
  utrReference     String?           // required iff method = MANUAL
  merchantRefundId String?  @unique  // the refund's own PhonePe merchantTransactionId
}
```

**Idempotency index** (raw SQL — Prisma can't express a partial unique index):
```sql
CREATE UNIQUE INDEX "refund_one_active_per_order"
  ON "Refund"("orderId") WHERE status <> 'FAILED';
```
→ at most one non-FAILED refund per order (double-click / two admins → the second
insert hits the constraint → 409). A FAILED refund does not block a retry.

`RefundStatus` is left as `PENDING/PROCESSED/FAILED`; `PROCESSED` is the
settled/"success" terminal (no breaking rename). `merchantRefundId` is
deterministic from `refund.id` so a network retry reuses the same id.

## 4. Endpoints (all `@Roles(ADMIN)` + throttled + audited)

### `POST /admin/orders/:id/refund` — prepaid (PhonePe)
Body `RefundOrderDto { disposition: RETURNED|DAMAGED|LOST, reason?: string }`.
Guards: order refundable (§2.1) **and** has a SUCCESS PhonePe `Payment`
(else → COD path). Flow in §5.

### `POST /admin/orders/:id/refund/manual` — COD (manual)
Body `ManualRefundDto { utrReference: string (required, non-empty),
disposition, reason? }`. No provider call. Flow in §5.

### `POST /admin/orders/:id/refund/recheck` — reconcile
Polls PhonePe Check-Status for the order's active PhonePe refund and adopts the
true state (settle / fail / still-pending). The failure-honesty escape hatch.
No-op for MANUAL refunds.

### `POST /phonepe/callback` (extended) — S2S refund webhook
The existing callback endpoint gains a refund branch. A refund callback is
distinguished by its `merchantTransactionId` matching a `Refund.merchantRefundId`
(vs a `Payment.providerTxnId`). Same X-VERIFY verify + the same at-most-once
`WebhookEventsService` claim. Settles PENDING→PROCESSED/FAILED.

## 5. State machine + flows

### Prepaid initiation (atomic CAS — the D1 hardening pattern)
One transaction:
1. Load order + its SUCCESS `Payment`. Assert refundable (§2.1) or 409.
2. **CAS** `payment.updateMany({ where:{ id, status: SUCCESS }, data:{ status: REFUND_PENDING }})`
   — `count !== 1` → 409 (a concurrent refund already claimed it). This is the
   exactly-once gate; combined with the partial unique index it is belt-and-braces.
3. Create `Refund { method: PHONEPE, disposition, status: PENDING,
   amountMinor: order.totalMinor, actorId, merchantRefundId: derive(refund.id) }`
   — the unique index rejects a second active refund.
4. Apply disposition: `RETURNED` → `inventory.adjust(+qty, reason RETURNED, tx)`
   per line; `DAMAGED`/`LOST` → no movement.
5. Write `refund_issued` `OrderEvent` (meta: method, disposition, amount).
   (Order status stays SHIPPED/DELIVERED/CANCELLED; `REFUND_PENDING` on the
   payment signals in-flight.)

Then (OUTSIDE the tx, after commit — so a provider call can't roll back the
persisted intent): call `/pg/v1/refund` with `merchantRefundId`. Persist
`providerRefundId` + initial `state`. On a network error, leave the refund
PENDING and surface "initiated — awaiting confirmation; use Re-check status".

### Settlement (callback or recheck) — idempotent, only a PENDING refund transitions
```
COMPLETED ▶ Refund → PROCESSED; Payment REFUND_PENDING → REFUNDED;
            Order → REFUNDED; refund_settled event.
FAILED    ▶ Refund → FAILED; Payment REFUND_PENDING → SUCCESS (money never moved);
            Order unchanged; refund_failed event. Retry allowed (FAILED frees the
            unique index). Restock from initiation is NOT reversed (goods physical).
PENDING   ▶ no-op; keep polling.
```

### COD manual (one transaction, no provider call)
Assert refundable + order is COD (no SUCCESS PhonePe payment) + `utrReference`
non-empty. Create `Refund { method: MANUAL, status: PROCESSED, utrReference,
disposition, amountMinor, actorId }`; apply disposition restock; `Order → REFUNDED`;
write `refund_issued` + `refund_settled` events. Immediately terminal.

## 6. Failure matrix (honesty)

| Situation | Outcome |
|---|---|
| Persisted, PhonePe accepts (PENDING) | await callback / `recheck` |
| Persisted, call times out / uncertain | Refund stays PENDING; `recheck` polls the **same** `merchantRefundId` → adopts real state; never mints a new id |
| Crash after call, before storing `providerRefundId` | `recheck` by `merchantRefundId` backfills + reconciles |
| Immediate or callback FAILED | Refund FAILED, Payment→SUCCESS, order NOT stuck as refunded, retry allowed |
| Callback COMPLETED (idempotent) | settle once; a duplicate callback is a no-op (only PENDING transitions) |
| Double-click / two admins | partial unique index + payment CAS → **409** |
| `EXCESS_REFUND_AMOUNT` / `REFUND_FOR_TXN_OLDER_THAN_LIMIT` | provider FAILED → refund_failed, honest message to the admin |

## 7. PhonePe S2S client (new)

A small `PhonepeRefundClient` in the phonepe module (native `fetch`, timeout, no
secret logging):
- `refund({ merchantRefundId, originalTxnId, merchantUserId, amountMinor })` →
  POST `{base}/pg/v1/refund`, X-VERIFY over `base64 + "/pg/v1/refund" + saltKey`.
- `status(merchantRefundId)` → GET `{base}/pg/v1/status/{merchantId}/{id}`,
  X-VERIFY over the literal path + saltKey.
Both return the parsed `{ code, data:{ state, transactionId, amount } }`. Signing
reuses the existing `credentials()` + checksum helpers (extracted/shared, not
duplicated). Needs `PHONEPE_BASE_URL` set (sandbox host in dev).

## 8. Out of scope / deferred
- **Partial refunds** (amount < total, multiple partials against one payment) —
  v1 is full-order only. PhonePe supports it; deferred fast-follow (partial
  amount + partial restock + partial invoice credit is a complexity multiplier).
- **PG v2 (OAuth) migration** — appendix note (§1); may be forced later.
- Customer-facing refund status UI (storefront) — later.

## 9. Verification / demo
Per step: unit tests (X-VERIFY refund checksum + status checksum; the CAS/
idempotency gates; the settlement transitions incl. FAILED-not-stuck; the DTO
validation incl. mandatory UTR). **Extra-heavy adversarial review** (money +
concurrency + failure honesty). Live demo:
- **COD manual path — fully live** (no provider): refund with UTR → PROCESSED +
  Order REFUNDED + restock (RETURNED) + events; a DAMAGED/LOST disposition → no
  restock; missing UTR → 422.
- **Prepaid path — provider mocked at the HTTP boundary** (sandbox refunds
  against a real past txn may not work): initiate → PENDING (providerRefundId
  stored) → mocked callback COMPLETED → REFUNDED; the FAILED callback →
  refund_failed + Payment back to SUCCESS + order NOT stuck; double-initiate →
  409; `recheck` reconciles a stuck PENDING.

## 10. Pre-launch checklist (must clear before go-live, NOT part of D1b build)
- **Real PhonePe SANDBOX refund verification** — run an actual `/pg/v1/refund`
  against a real sandbox payment, confirm the callback + Check-Status shapes match
  this spec, and confirm `X-VERIFY` is accepted. (Deferred because sandbox refunds
  may need a fresh real payment to refund.)
- Set `PHONEPE_BASE_URL` (+ real merchant creds) in the deploy env.
- Confirm the callback URL is reachable from PhonePe for refund webhooks.
