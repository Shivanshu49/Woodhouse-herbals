# Razorpay Migration Plan (PhonePe → Razorpay, full replacement)

> **Status: APPROVED 2026-07-13 — CP0 decisions locked: (1) guest checkout Option A, (2) auto-capture via nested `payment:{capture:'automatic'}`, (3) `RENAME VALUE 'PHONEPE'→'GATEWAY'` (no live refund history exists), (4) Prisma upgrade deferred (boot assertion + CI test now; ≥7.5 schema-native fast-follow; never 7.4.0–7.4.2). Phase 0 in progress.**
> Recon basis: 2026-07-12 blast-radius inventory (8-agent sweep, ~106 files classified; findings cited inline as `file:line`).
> Provider/platform facts verified against official Razorpay, PostgreSQL, Prisma, Express, Cloudflare and Railway docs (5-agent fact-check; load-bearing facts in **Appendix B** with sources; unconfirmable facts marked **UNCONFIRMED**, never assumed).
> Design hardened by a 3-agent adversarial review (money-path attack, requirements audit, repo-consistency); all 12 findings fixed in this revision — the load-bearing ones are marked ★REVIEW-FIX inline.

> **⚠ CRITICAL PATH (amendment B, 2026-07-13):** Phase 9 (storefront checkout + cart sync) is **not a follow-up — it is the critical path to revenue**. The storefront cart is client-only Zustand and never reaches the backend cart that `POST /api/orders` reads; until cart sync + checkout exist, **no order can be created from the storefront at all and Razorpay settles nothing**. Phases 0–8 make the gateway correct; Phase 9 makes it reachable.
>
> **⚠ INFRA AMENDMENT (A, 2026-07-13, approved):** Deploy target changed from Railway+Neon to a **Hostinger KVM VPS (Ubuntu 24.04, Mumbai, 8 GB) running Coolify, with Postgres local in Docker**. See the amended §4.2 (hop chain is now Cloudflare → Traefik(Coolify) → app; `TRUST_PROXY_HOPS` must be re-derived and verified empirically on that topology; the bypass "side door" is now the VPS raw IP / Hostinger hostname) and the Phase 10 note. Local Postgres makes the 20 s tx window far more generous than pooled Neon, but the **persist-then-ack webhook design stays** — the 5 s ack deadline is provider-side and unconditional.

**Goal:** Replace PhonePe with Razorpay as the only payment gateway — server-side Order create, storefront Standard Checkout, HMAC-verified webhook as settlement trigger, API fetch as ground truth, and a new reconciliation cron as backstop — while preserving the existing exactly-once money architecture (payment CAS, partial unique index, restock-at-initiation, idempotent settle).

**Architecture:** A new `Backend/src/modules/razorpay/` module replaces `phonepe/` 1:1 in the app graph (controller + service + pure signing/state helpers + S2S client provided into RefundsModule). All money-state transitions continue to flow through the existing provider-agnostic seams — `RefundsService.settle`, `WebhookEventsService`, `InventoryService.adjust`, order-events — which the recon confirmed survive unchanged. Two deliberate semantic changes, both provider-driven: (1) a failed payment **attempt** no longer cancels the order (Razorpay documents failed→captured on the same payment as expected behavior); terminal abandonment moves to the cron. (2) The webhook handler acknowledges within Razorpay's **5-second deadline** and settles asynchronously (persist-then-ack), instead of PhonePe's settle-inline-then-ack.

**Tech stack:** NestJS 10.3, Prisma 5.18 / Postgres (Neon), `node:test` + tsx, native `fetch` (same as `phonepe-refund.client.ts`), `@nestjs/schedule` v6 (new dep; supports Nest 10), Razorpay REST v1 (Basic auth) + checkout.js (storefront).

## Decisions locked by the user (build to these)

1. **Auto-capture.** No authorize/capture split; `PaymentStatus` enum is NOT extended. ⚠ One mechanical deviation, flagged for approval: the literal `payment_capture: 1` param has **vanished from current Razorpay docs**; the 2026 mechanism is a nested `payment: { capture: "automatic", capture_options: {...} }` object on order create (API values override the dashboard setting). Intent honored — auto-capture, belt-and-braces (order-level object + dashboard default) — via the documented parameter. (Appendix B-1)
2. **PhonePe removed entirely** — module deleted, env keys removed, no dual-provider mode.
3. **Reconciliation cron: build it** (payments sweep + refunds sweep).
4. Guest checkout: options + recommendation in §1.2 — **user decides at Checkpoint 0**.

## Global constraints

- Money is integer paise everywhere; Razorpay amounts are also smallest-subunit integers (min ₹1 = 100) — no conversion layer.
- The atomic money path is never modified as a rider on unrelated changes; every money task gets extra-heavy adversarial review.
- Commit style: author Shivanshu, no Claude attribution/trailers.
- Never log `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or full signatures (existing rule, `plans/2026-07-05-phase-d1b-refunds.md:21`).
- `prisma db push` is forbidden in this repo (partial-index loss risk — §2c). Baseline resquash of the migration history is likewise forbidden without moving the indexes first.
- Never derive payment state from webhook **event names or arrival order** — Razorpay documents that the sequence is not fixed and `payment.authorized` can arrive already carrying `status: captured`. State reads come from `payload.<entity>.entity.status` only. (Appendix B-3)
- Anomalies that denote **captured customer money in an unexpected state** are never log-only: they are persisted as order-events (existing `OrderEvent` table) so Admin can see and act on them. ★REVIEW-FIX

---

## 1. End-to-end flow

### 1.1 Call chain

```
[1] POST /api/orders                        (unchanged — public, guest wh_sid, Idempotency-Key,
     └─ OrdersService.createFromCart          inventory decrement ORDER_RESERVED, Order → PENDING)

[2] POST /api/razorpay/initiate             (auth: see §1.2; throttled 10/10min as today)
     ├─ order must be PENDING + owned; amount from Order.totalMinor — never client-supplied
     │    (totals are immutable post-creation — verified: nothing mutates totalMinor after PENDING)
     ├─ REUSE-IF-FRESH ★REVIEW-FIX (both bounds matter):
     │    · an INITIATED Payment row younger than PAYMENT_ABANDON_TTL − 2h → return its rzp
     │      order id again (Razorpay supports multiple attempts per order; failed attempts
     │      never block retry)
     │    · an INITIATED row OLDER than that margin → CAS it INITIATED→FAILED (superseded)
     │      and mint a fresh rzp order + Payment row — never hand out an rzp order id that
     │      the cron may abandon while the customer is mid-checkout
     │    · concurrency guard: new partial unique index `payment_one_initiated_per_order`
     │      (ON "Payment"("orderId") WHERE status='INITIATED', §2d) — two concurrent
     │      initiates cannot mint two payable rzp orders; the P2002 loser re-reads and
     │      returns the winner's rzp order id. (Today PhonePe initiate mints a new row per
     │      click with no guard at all — phonepe.service.ts:114.)
     ├─ S2S: POST /v1/orders {
     │       amount: order.totalMinor, currency: 'INR',
     │       receipt: <unique per mint: order.number + '-' + payment-row suffix, ≤40 chars —
     │                 Orders receipt is documented max-40 AND unique>,
     │       notes: { orderNumber },
     │       payment: { capture: 'automatic',
     │                  capture_options: { automatic_expiry_period: 12, refund_speed: 'normal' } } }
     │    Basic auth key_id:key_secret; no request signing. (Crash windows here are benign:
     │    S2S-create-then-row ordering means a crash between the two leaves an orphan rzp
     │    order nobody holds an id for — unpayable; a crash after row insert is recovered by
     │    reuse-if-fresh on the customer's retry.)
     ├─ Payment row: provider:'razorpay', providerTxnId: <rzp order_id> (unique col reused),
     │    status INITIATED, amountMinor
     └─ returns { keyId, razorpayOrderId, amountMinor, currency, orderNumber }
          (keyId in the response ⇒ NO NEXT_PUBLIC_RAZORPAY_KEY_ID needed on the storefront)

[3] Storefront checkout (greenfield — Phase 9): checkout.js opens with order_id
     (mandatory options: key, amount, currency, name, order_id; retry.enabled defaults true);
     success handler receives { razorpay_payment_id, razorpay_order_id, razorpay_signature }

[4] POST /api/razorpay/verify               (fast path — same auth as initiate)
     ├─ verify razorpay_signature = HMAC_SHA256(key_secret, order_id + '|' + payment_id)
     │    (order_id FIRST, pipe separator, hex digest — Appendix B-2)
     ├─ signature valid ⇒ STILL not trusted for money: fetch GET /v1/payments/:id —
     │    require status='captured' AND amount === Payment.amountMinor AND order_id === providerTxnId
     └─ then settle via the SAME idempotent path as the webhook (below); respond with order status

[5] POST /api/razorpay/webhook              (public; authenticated by X-Razorpay-Signature;
     │                                        express.raw mount — §4)
     ├─ verify HMAC_SHA256(webhook_secret, rawBody) — hex digest, timingSafeEqual, length-guarded
     │    ("Do not parse or cast the webhook request body" — byte-exact, Appendix B-3)
     ├─ idempotency claim: WebhookEventsService.record
     │    key = `razorpay:<x-razorpay-event-id>` (retries redeliver the same id — Appendix B-3);
     │    fallback key = sha256(provider:rawBody) (existing behavior) if header absent
     ├─ ★ ACK 200 IMMEDIATELY after claim, THEN settle asynchronously ★
     │    Razorpay marks a delivery failed if not answered in FIVE seconds; our settle tx
     │    window is up to ADMIN_WRITE_TX_TIMEOUT_MS = 20s on pooled Neon — inline settlement
     │    (the PhonePe pattern) can time out and trigger spurious retries. New shape:
     │    verify → claim → respond 200 → process (error-captured) → markProcessed/markFailed.
     │    Crash-after-ack coverage (the claim row stays processed=false but Razorpay never
     │    redelivers a 200-acked event) is per event family: payment events → payments sweep
     │    re-fetches INITIATED rows; refund events → refunds sweep re-reads provider refund
     │    state (§1.4). Both sweeps funnel into the same idempotent settles. ★REVIEW-FIX
     ├─ route by payload entity STATUS (not event name — sequence is not fixed):
     │    payment entity, status 'captured'  → settlePaymentSuccess (guard: amount ===
     │        Payment.amountMinor AND order_id === providerTxnId): payment CAS
     │        INITIATED→SUCCESS, order CAS PENDING→PAID, order-event, backend-cart clear
     │        (ports markSuccess incl. paid_on_non_pending — upgraded to a persisted
     │        anomaly, §1.3). If the payment CAS finds the row NOT in INITIATED, run the
     │        captured-after-abandonment recovery (§1.3) — never silently no-op. ★REVIEW-FIX
     │        Trigger events: payment.captured canonical; payment.authorized-carrying-captured
     │        and order.paid settle identically (idempotent no-ops when already settled).
     │        providerPaymentId (pay_…) is written by THIS path only, from the capturing entity.
     │    payment entity, status 'failed'    → annotate the attempt — gated `where status:
     │        'INITIATED'` so a late failed-attempt webhook can never clobber a SUCCESS row's
     │        capture evidence; never writes providerPaymentId ★REVIEW-FIX. Payment stays
     │        INITIATED; ⚠ NO cancel/restock (failed→captured on the same payment is
     │        documented expected behavior — §1.3); order cancellation is cron-owned
     │    refund entity, status 'processed'  → RefundsService.settle(…, 'PROCESSED')
     │    refund entity, status 'failed'     → RefundsService.settle(…, 'FAILED') — releases payment
     │    refund entity, other/unknown (e.g. undocumented 'reversed') → park PENDING, log
     │    anything else → record + markProcessed, log
     └─ markProcessed per event id (each event is its own claim — PhonePe's
          "leave PENDING webhooks unprocessed" trick is retired; §3)

[6] Reconciliation cron (NEW — §1.4): payments sweep + refunds sweep, both funnelling into
     the same idempotent settle paths. Terminal abandonment (cancel + restock) lives HERE.
```

### 1.2 Guest checkout — the public-order-create / JWT-only-initiate mismatch

Today `POST /api/orders` is `@Public()` and guest-capable, but initiate requires `JwtAuthGuard` + `order.userId === user.sub` (`phonepe.controller.ts:28`, `phonepe.service.ts:86-89`) — a guest order can never be paid.

| Option | What it is | Cost | Verdict |
|---|---|---|---|
| **A — session-ownership initiate (RECOMMENDED)** | `/razorpay/initiate` (and `/verify`) become `@Public()` + owner check: valid JWT owner **or** guest `wh_sid` cookie matching `order.cartSessionId` — the exact pattern `GET /api/orders/:number` already uses for guest reads (`orders.controller.ts:62-72`, `orders.service.ts:223-229`) | ~1 small guard-logic unit, reuses a reviewed pattern; IP throttle (10/10min) unchanged; amount is server-side so risk is bounded | Keeps guest checkout working; consistent with the rest of the order surface |
| B — require login to pay | Storefront gates checkout behind auth; backend unchanged | Zero backend | Kills guest checkout (conversion cost); leaves the API mismatch in place as a trap |
| C — signed guest payment token minted at order create | New token type, new validation path | Most code, new auth surface | No benefit over A; rejected |

**Recommendation: A.** No Razorpay analogue of `merchantUserId` is required; refunds already fall back to `order.userId ?? order.id` (`refunds.service.ts:298`) and under Razorpay a customer reference is optional entirely.

### 1.3 Authority hierarchy — who wins when they disagree

Ordered, most→least authoritative:

1. **Razorpay API fetch** (`GET /v1/payments/:id`, `GET /v1/orders/:id/payments`, `GET /v1/refunds/:id`) — ground truth. Used by `verify` before settling and by the cron. Any disagreement is resolved by re-fetching. (Caveat: live order fetches fail past 180 days — irrelevant at our 24 h abandonment TTL, but recorded so nobody builds long-tail reconciliation on it.)
2. **Webhook** — a verified, trustworthy *trigger*, but async, unordered, and re-deliverable. It settles directly (payload carries the full entity) because the CAS makes over-settling impossible.
3. **Client callback** — a *hint only*. The checkout signature proves Razorpay generated the tuple, not that money is captured; `verify` always re-fetches before settling.

Disagreement rules (explicit):
- Client says success, API fetch shows no captured payment → do **not** settle; leave INITIATED; respond "processing"; cron resolves.
- Payment `captured` but `amount !== Payment.amountMinor` → **anomaly hold**, not auto-fail: keep payment INITIATED, no order transition, persist a `payment_amount_mismatch` order-event on first observation. The hold has a **terminal**: the cron re-fetches at most `RECONCILE_ANOMALY_MAX_OBSERVATIONS` (3) times, then stops re-fetching and leaves the persisted anomaly for manual resolution (dashboard refund or forced settle) — never an infinite fetch loop, and the abandonment branch explicitly treats a held row as *not abandonable*. ★REVIEW-FIX (Deliberate change from PhonePe, which cancelled + restocked on mismatch — dangerous when money actually moved. Near-impossible anyway: the amount is fixed on the server-created rzp Order.)
- `captured` for an order that already left PENDING (payment CAS succeeded, order CAS failed) → port `paid_on_non_pending`, **upgraded from log-only to a persisted `paid_on_non_pending` order-event** — with two payable-rzp-order histories now conceivable, it denotes captured customer money, not a curiosity ★REVIEW-FIX; payment → SUCCESS, order untouched, ack 200 (never make the provider retry forever). (`phonepe.service.ts:318-330`)
- **Captured after abandonment** ★REVIEW-FIX(critical): if the captured-settle's `INITIATED`-CAS returns count 0, do **not** silently return (the PhonePe `// raced — leave alone` at `phonepe.service.ts:313` is correct for races between success paths but WRONG for capture-after-abandon: the cron burned INITIATED→FAILED at TTL, so the money would become invisible — no log, no refundable SUCCESS payment, sweep never revisits FAILED rows). Instead: re-read the row; if FAILED → dedicated CAS FAILED→SUCCESS + persist a `captured_after_abandon` order-event; the order stays CANCELLED (already restocked); the now-SUCCESS payment makes the standard admin refund path available, and `restockApplies` already skips restock for CANCELLED orders (`refunds.service.ts:50-59`) so stock stays exactly-once. If the re-read shows SUCCESS/REFUNDED → genuine duplicate delivery, no-op as today. The §1.1 reuse-if-fresh freshness margin makes this window rare; this rule makes it safe.
- `payment.failed` then `payment.captured` — **on the same payment id** — is documented expected behavior (UPI in-app retries / late authorization). Failed only annotates (gated on INITIATED); captured settles; arrival order is irrelevant because settle is CAS-gated.
- Order status is **never** used to detect refunds — a fully refunded Razorpay order remains `paid` forever; refund state lives on refund/payment entities only.

### 1.4 Reconciliation cron (new)

`@nestjs/schedule` v6 (peer-compatible with Nest 10 — verified; recon confirmed **no scheduler exists anywhere** today and `bullmq` stays a dead dep, removed in Phase 7). Two jobs in a new `Backend/src/modules/reconciliation/` module, both thin wrappers over TDD'd pure decision functions:

- **Payments sweep** (every 5 min): for each Payment `INITIATED` older than `RECONCILE_PAYMENT_MIN_AGE_MIN` (default 15) — age measured from the row's **creation** (initiate supersedes stale rows with fresh ones, §1.1, so creation age ≈ last initiate activity ★REVIEW-FIX):
  - `GET /v1/orders/:id/payments` (returns every attempt incl. failed ones, with error codes);
  - a `captured` payment passing the **identical settle guard as the webhook/verify paths** (`status='captured' AND amount === amountMinor AND order_id === providerTxnId`) → settlePaymentSuccess ★REVIEW-FIX; a captured payment failing the amount guard → the §1.3 anomaly-hold flow (persist once, cap observations, block abandonment);
  - a payment stuck in `authorised` → persist `authorized_stuck` anomaly once (it also **blocks new attempts on that rzp order** — documented) and take no money action; with `capture: automatic` + dashboard auto-capture this should never persist past the capture window;
  - no captured payment AND age > `PAYMENT_ABANDON_TTL_HOURS` (default 24) AND no anomaly hold → **terminal abandonment**: payment → FAILED, order CAS PENDING→CANCELLED, audited restock via `InventoryService.adjust` (this is where PhonePe's `markFailed` semantics move — including the **FF-22 fix: movement `reference` = order number, not order id**, `fast-follows/admin-panel.md:269-276`);
  - otherwise: wait.
- **Unprocessed-claims re-drive** ★CP3-REVIEW-FIX (added after the Phase 4 adversarial review): every sweep run also selects `WebhookEvent` rows with `provider='razorpay' AND processed=false AND createdAt < now()−15min` and replays them through `parseWebhookEnvelope(payload)` → the settlement door (idempotent by construction), then `markProcessed`. This is the backstop the INITIATED-only payments sweep cannot provide: a crash/tx-timeout inside the **captured_after_abandon recovery** (a FAILED row the payments sweep never revisits) or a failed refund-event settle would otherwise strand provider-verified money as a markFailed log line. Covers every event family uniformly.
- **Refunds sweep** (every 10 min): for each Refund `PENDING` older than `REFUND_CONCLUDE_MIN_AGE_MIN` → the §3 recovery routine — **a fresh provider state read is the primary probe** (`GET /v1/refunds/:id` when `providerRefundId` is persisted, else `GET /v1/payments/:id/refunds` + client-side receipt match), feeding `entity.status` into the existing idempotent `settleFromProvider`. The idempotent re-send is used ONLY to resolve was-it-ever-created ambiguity — never as a state probe, because an `X-Refund-Idempotency` replay returns the **saved original response** (stale by definition), which would loop a lost-terminal-webhook refund PENDING forever. ★REVIEW-FIX Manual Admin recheck runs this same routine on demand.
- Ops ★REVIEW-FIX: batch cap (50/sweep), structured log per decision, counter line per run, and a **dead-man signal** — each sweep stamps a `last_sweep_completed_at` (StoreSetting row or gauge log); PRE-LAUNCH gains the alert rule "oldest INITIATED payment age > 2× `RECONCILE_PAYMENT_MIN_AGE_MIN`, or last sweep > 30 min ago" — because the cron is the *sole* owner of abandonment and the *sole* lost-webhook backstop, its silent death must page someone.
- **Single-instance assumption documented in the module header** — `@nestjs/schedule` has no distributed locking (feature request closed unimplemented), so N replicas = N firings; the settle paths are idempotent regardless, but if Railway ever scales past 1 replica, wrap each sweep in `pg_try_advisory_lock`. Not built now (YAGNI, staging runs 1 replica).

---

## 2. The DB-level landmines (and one new guard)

### 2a. `Payment.provider` Postgres default is `"phonepe"` (`schema.prisma:739`)

**Fix — drop the default rather than replace it.** Migration:

```sql
ALTER TABLE "Payment" ALTER COLUMN "provider" DROP DEFAULT;
```

plus removing `@default("phonepe")` in `schema.prisma`; `RazorpayService` always writes `provider: 'razorpay'` explicitly. Rationale: a column default is exactly how a stale provider stamp survives a code swap unnoticed — making the write explicit turns a future omission into an immediate insert error instead of silently wrong data. `DROP DEFAULT` is metadata-only; existing rows keep `'phonepe'`, which is historical truth. Deploy-order-safe in both directions: existing code already writes `provider` explicitly (`phonepe.service.ts:117`), never relying on the default.

### 2b. `RefundMethod` enum carries `PHONEPE` as persisted data (`schema.prisma:796-799`)

**Fix — rename the value to a provider-neutral token:**

```sql
ALTER TYPE "RefundMethod" RENAME VALUE 'PHONEPE' TO 'GATEWAY';
```

- `RENAME VALUE` (PG 10+) is metadata-only — stored enum cells are 4-byte OIDs into `pg_enum`, so **existing rows are re-labelled instantly with no table rewrite**, and unlike `ADD VALUE` it has **no transaction-block restriction**, so it is safe inside the single transaction Prisma Migrate wraps around the migration. (Appendix B-5)
- History is not broken, it is *re-labelled*: a 2026-07 refund row reads `GATEWAY`, and full provider fidelity is preserved through `Payment.provider = 'phonepe'` on the linked payment plus the stored `rawResponse`. **Explicit approval point: old refunds will display "Gateway" instead of "PhonePe" in Admin** (Phase 8 can render `payment.provider` alongside if per-provider labels are wanted back).
- Why not `ADD VALUE 'RAZORPAY'`: (i) two live gateway tokens forever, dual Admin rendering, and the recheck gate becomes `method !== 'MANUAL'` anyway; (ii) the provider axis already lives on `Payment.provider`; (iii) mechanically worse — an added enum value **cannot be used in the same transaction that adds it**, so ADD VALUE plus any backfill needs two separate migration files under Prisma Migrate.
- **Atomicity, precisely** ★REVIEW-FIX: the rename regenerates the Prisma client (`RefundMethod = 'GATEWAY' | 'MANUAL'`), which makes the old literals **TS compile errors** — so the migration and the code swap cannot be in different phases. One Phase-1 commit carries: the migration, `refunds.service.ts:241` (create), **`:272` (event-meta method string — untyped JSON, would otherwise silently keep stamping 'PHONEPE')**, `:423` (recheck filter), plus the two Admin literals whose desync would silently kill the recheck button (`Admin/src/types/order.ts:73`, `refunds-panel.tsx:42`). Admin cosmetic copy stays in Phase 8. And the migration is **never applied to an environment running pre-Phase-1 code** — old code writes `method:'PHONEPE'`, which a renamed enum rejects at runtime (every gateway refund 500s). CP1 states this: migrations are committed on the branch and applied to dev/CI DBs; the Neon staging branch receives them only as part of this branch's own deploy (Railway runs `migrate:deploy` in the release phase, so code+migration land together).

### 2c. The double-payout guard lives only in raw migration SQL — make it undroppable

`refund_one_active_per_order` (`CREATE UNIQUE INDEX … ON "Refund"("orderId") WHERE status <> 'FAILED'`) exists only in `migrations/20260705014511_refunds_d1b/migration.sql:20`; `schema.prisma:832` has a plain `@@index([orderId])`.

**Fact update that reshapes this section:** "move it into the Prisma schema" is no longer impossible — **Prisma 7.4 (Feb 2026) added partial indexes behind the `partialIndexes` preview flag**, with full Postgres migration + introspection support; issue #6974 is closed. But the repo is on **Prisma 5.18**, two majors behind; 7.4.0–7.4.2 shipped a regression where `migrate dev` emitted `DROP INDEX` for exactly this kind of manually-created partial index on every run (fixed in 7.5.0: undeclared manual partial indexes are now explicitly preserved), and the preview feature still has open predicate-normalization bugs as of July 2026. On our current Prisma 5.18 the engine does not model partial indexes at all, so routine `migrate dev` leaves the raw-SQL index untouched; the loss scenarios are `db push` and a baseline resquash. (Appendix B-6)

**Decision (named CP0 approval item ★REVIEW-FIX): do NOT ride a two-major ORM upgrade on a payment migration** — boot assertion + CI test now, schema-native declaration deferred to a scheduled Prisma ≥7.5 upgrade fast-follow. If you'd rather take the upgrade first, say so at CP0 and it becomes Phase −1.

1. **Boot-time invariant assertion (the "undroppable" part) — build now.** A startup check in the same fail-fast family as `loadEnv()`, driven by a declared list of **required partial indexes** (both `refund_one_active_per_order` and the new `payment_one_initiated_per_order`, §2d):
   ```sql
   SELECT indexname, indexdef FROM pg_indexes
   WHERE schemaname = 'public' AND indexname = ANY($1);
   ```
   assert each is present AND its `indexdef` contains both `UNIQUE` and a `WHERE` clause (`pg_constraint` is the wrong catalog — a partial unique **index** has no constraint row). Missing/malformed ⇒ `process.exit(1)` when `NODE_ENV=production` with a loud error naming the migration file; `console.warn` in dev/test. The app **will not boot in prod without the guards**.
2. **CI behavioral test — build now, by EXTENDING the existing job** ★REVIEW-FIX: `.github/workflows/ci.yml`'s `backend-check` job **already** runs a `postgres:16-alpine` service container and `npx prisma migrate deploy` from empty — do not add a duplicate job; append an assertion script that (a) checks `pg_indexes` as above and (b) proves the *behavior*: two non-FAILED refunds for one order ⇒ second insert must raise unique-violation (SQLSTATE 23505); FAILED + non-FAILED ⇒ allowed; same 23505 check for two INITIATED payments on one order. Catches an edited/squashed migration history at PR time. (§2a/§2b/§2d assertions are appended in **Phase 1**, the same commit as their migrations — Phase 0 asserts only `refund_one_active_per_order`, the sole guard index that exists before Phase 1, so CP0 stays green; the list-driven design makes each later addition one line. ★REVIEW-FIX)
3. **Schema documentation tripwire — build now.** A prominent comment block on the `Refund` and `Payment` models in `schema.prisma` naming each index, its migration file, and "delete this comment only if you also moved the index"; `prisma db push` prohibition recorded in Global Constraints and `Backend/CLAUDE.md`.
4. **Follow-up (out of this migration's scope, tracked as a fast-follow):** upgrade Prisma 5.18 → ≥7.5 (never 7.4.0–7.4.2) and declare both indexes with the `partialIndexes` preview feature using the type-safe object `where:` syntax (avoid `raw()` predicates with casts/`IN` — open normalization bugs); acceptance: `migrate dev` is a no-op twice consecutively. Items 1–2 stay in place afterwards regardless — they guard the live DB, not the schema text.

### 2d. NEW: one-INITIATED-payment-per-order guard ★REVIEW-FIX

The reuse-if-fresh read-then-create in §1.1 is racy without DB backing (double-click / two tabs ⇒ two payable rzp orders ⇒ possible double charge surfacing only as a `paid_on_non_pending` log line). Fix with the same proven technique as the refund guard:

```sql
CREATE UNIQUE INDEX "payment_one_initiated_per_order"
  ON "Payment"("orderId") WHERE status = 'INITIATED';
```

The initiate transaction that loses the race maps P2002 → re-read → return the winner's rzp order id. **Data precondition:** historical PhonePe rows can hold multiple INITIATED payments per order (unguarded initiate); the same migration first marks all but the newest INITIATED row per order as FAILED (superseded) — safe: none of them is money, all are dev/staging artifacts, and the storefront has never been live. Protected by the §2c boot assertion + CI test from day one.

---

## 3. Idempotency — mapping onto Razorpay

Precision first: today's idempotency is **not** a single receipt field; it is four mechanisms. Each maps as follows.

| Mechanism today | Under Razorpay | Exactly-once verdict |
|---|---|---|
| `Order.idempotencyKey` (client `Idempotency-Key` header on order create, `orders.service.ts:56-62`) | **Unchanged** — provider-independent | Holds |
| `Payment.providerTxnId` unique = merchant-minted `merchantTransactionId`; webhook looks payments up by it | Column reused, now stores the **rzp `order_id`** — provider-minted but returned *synchronously* at initiate, so it is persisted before any webhook can arrive; webhook payment entities carry `order_id` → same lookup path. New nullable `Payment.providerPaymentId` stores `pay_…` (written only by the captured-settle path — §1.1) for refund creation + audit. The rzp Order `receipt` (≤40 chars, documented **unique**) is minted per Payment row (`order.number` + row suffix) as a human/recon cross-reference — never used as a lookup key. Initiate-side duplication is closed by `payment_one_initiated_per_order` (§2d) | Holds — `order_id` uniqueness is Razorpay-guaranteed; row-minting uniqueness is now DB-guaranteed |
| Webhook claims: shared key `phonepe:<txnId>` for ALL states of one txn + the "leave non-terminal webhooks unprocessed" trick (`phonepe.service.ts:286-292`) | Key = `razorpay:<x-razorpay-event-id>`; the header is documented "unique per event… to determine the duplicity of a webhook event" — retries carry the same id, distinct events carry distinct ids. Every event is claimed and `markProcessed` individually; the leave-unprocessed trick is **retired**. Same-id-on-retry is strongly implied but not verbatim in docs — the fallback `sha256(provider:rawBody)` key and the CAS below make us safe either way | Holds — and the true transition guard was never the claim table: it is the CAS `updateMany where status: INITIATED` (kept verbatim) |
| Refund create: deterministic `merchantRefundId` re-sent on retry ⇒ PhonePe dedupes server-side (`refund-transitions.ts:29-35`) | **Better than feared — Razorpay has first-class refund idempotency.** `POST /v1/payments/:id/refund` accepts an **`X-Refund-Idempotency` header** (≥10 chars; alphanumerics, hyphens, underscores): a retry with the same key and identical body returns the saved original response — no double refund; same key + different body ⇒ rejected; retry racing the in-flight original ⇒ **409 Conflict** (wait and retry same key — the client needs this branch). Keep the deterministic derivation from the Refund row id (`refund-transitions.ts:33-35` already satisfies charset/length) and send it as BOTH the idempotency header AND the refund `receipt` (receipt = second, payment-scoped dedupe with **reject-not-replay** semantics: "Duplicate receipt found for this refund request" maps to *already created — go fetch*, not *rejected*). Recovery rules below. | Holds: partial index (≤1 non-FAILED row per order) × idempotency header (≤1 provider refund per row, even under retry) × receipt backstop |

Two guards keep doing the heavy lifting unchanged: payment CAS `SUCCESS→REFUND_PENDING` (`refunds.service.ts:229-235`) and the settle PENDING-claim (`:338-346`).

**Refund recovery — the recheck/sweep routine, precisely** ★REVIEW-FIX (this subsection was redesigned after the adversarial review found two holes in the earlier ordering):

1. **Primary probe = fresh state read, never the idempotent re-send.** An `X-Refund-Idempotency` replay returns the *saved original response* — a state snapshot from creation time. Using it as a poll would park a refund PENDING forever once a terminal webhook is lost (today's recheck polls a dedicated status endpoint, `refunds.service.ts:429` — that freshness property must be preserved). So: `GET /v1/refunds/:id` when `providerRefundId` is persisted; else `GET /v1/payments/:id/refunds` with client-side `receipt` match (no server-side receipt filter exists; we create at most one refund per payment, and the per-payment list defaults to last 10). Feed `entity.status` into the existing idempotent `settleFromProvider`.
2. **The re-send resolves creation ambiguity only.** If the state read finds no matching refund AND the original create outcome was ambiguous (timeout/5xx), re-send the identical create with the same header: replay ⇒ adopt its refund id and go to 1; 409 ⇒ original in flight, wait; definitive 4xx (`BAD_REQUEST_ERROR`) ⇒ the create never landed.
3. **Conclude FAILED only on positive evidence of absence.** Both of: (a) a *successful, authenticated* list/fetch response demonstrably containing no refund matching our receipt, AND (b) a *definitive* non-created outcome from the re-send (4xx — never a timeout/5xx/network error). Timeouts and 5xx always stay PENDING — the ported `mapRefundState` policy (5xx → PENDING, `refund-transitions.ts:63-64`) applies to the recovery probes too. Two consecutive timeouts must never release the payment CAS: the earlier draft allowed exactly that, which could produce "customer refunded, books say FAILED, admin retries" — Razorpay's refundable-amount arithmetic would block the second *full* refund, but the books would still be wrong.
4. **Money-moved-after-conclude tripwire.** `settle`'s PENDING-claim no-op path gains one addition: when a **terminal provider success** arrives for a refund already concluded FAILED, persist a `refund_settled_after_conclude` order-event (anomaly — books contradiction requiring manual reconciliation). Cheap, and turns the worst residual race from silent to visible.

Refund state mapping (replaces `mapRefundState`'s PhonePe vocabulary, keeps its policy): `processed` → PROCESSED (terminal; Razorpay may set it before the bank ARN lands — we already never un-settle); `failed` → FAILED (can occur async even after acceptance — the 6-month-old-payment rule surfaces either as a synchronous 400 or as a later `failed`); `pending` and **any unknown status** (webhook docs mention a 'Reversed' outcome absent from the entity enum) → park PENDING, log, never guess. Definitive create-time rejection (HTTP 4xx / `error.code BAD_REQUEST_ERROR`) → FAILED releases the payment — branch on status+code, never string-match descriptions.

---

## 4. Raw body & the proxy question

### 4.1 Raw-body handling (mechanism survives, path moves)

Razorpay verifies `X-Razorpay-Signature` = HMAC-SHA256 hex over the **raw** webhook body with the webhook secret; docs say verbatim "Do not parse or cast the webhook request body" — the same byte-exactness requirement as PhonePe. Keep the proven `main.ts` pattern (route-scoped `express.raw` before `express.json`, `bodyParser:false`), re-pointed:

- mount `'/api/razorpay/webhook'` (64kb, `type: 'application/json'`); delete the PhonePe mount in the same change;
- the path-literal + `setGlobalPrefix('api')` duplication trap (recon: renaming either side silently detaches the parser → controller 400s) is called out in the task and covered by an integration test (§6);
- Nest's `rawBody: true` alternative considered and rejected: it buffers raw bytes for every JSON route to serve one webhook; the scoped mount is reviewed, and its one hazard is now tested;
- **ack deadline:** handler must return 2xx within **5 seconds** or the delivery is marked failed and retried → §1.1's persist-then-ack shape. Retries: exponential backoff for 24 h; **after 24 h of continuous failures Razorpay auto-disables the webhook** (manual re-enable from dashboard) — configure the per-webhook failure alert email; goes in PRE-LAUNCH.
- webhook throttle: PhonePe's 60/min IP throttle can 429 legitimate retry bursts (recon flag). Set a generous `@Throttle` (300/min) — the signature is the real auth; the throttle is DoS hygiene only.
- **secret rotation:** retried deliveries created before a rotation are still signed with the OLD secret. Verification accepts `RAZORPAY_WEBHOOK_SECRET` and, when set, `RAZORPAY_WEBHOOK_SECRET_OLD` (cleared after the 24 h retry window). Cheap to build; prevents a real failure mode.

### 4.2 Trust-proxy / Cloudflare — the infra answer

**Raw-body HMAC never forbade a proxy, under PhonePe or Razorpay.** The recon found no "no proxy in front of the API" rule anywhere in the repo — `trust proxy = 1` (`main.ts:39`) exists for **rate-limit keying and audit IPs** (SECURITY.md:92 explicitly anticipates "LB / Cloudflare"). A proxy endangers HMAC only if it *modifies the body*. Fact-check verdict: **no default Cloudflare feature modifies request bodies** — Transform Rules cannot touch bodies at all (URL/query/headers only); the mechanisms that can are user-deployed Workers/Snippets on the route. Body-size (100 MB free-plan) and origin-timeout (120 s) limits are orders of magnitude away from a 64 kb payload and a <5 s ack. (Appendix B-7)

> **INFRA AMENDMENT (2026-07-13):** the topology below was written for Railway. The deploy target is now a **Hostinger KVM VPS running Coolify (Traefik ingress) with Postgres local in Docker**. What changes: (i) there is now **always at least one proxy hop even without Cloudflare** — Traefik fronts the app, so the no-CF baseline is `TRUST_PROXY_HOPS=1` *meaning Traefik*, and the CF chain is Cloudflare → Traefik → app (expected `2`, but **re-derive and verify empirically on this topology** — Traefik must also be configured to trust forwarded headers only from Cloudflare's published ranges, or it will pass through client-forged XFF); (ii) the "side door" is no longer `*.up.railway.app` but the **VPS raw IP and any Hostinger/Coolify-generated hostname** — same lockdown obligation: firewall the VPS to accept 443 only from Cloudflare ranges if CF is adopted, and bind no default Traefik router to the raw IP; (iii) local Postgres removes Neon's pooled-connection latency, making the 20 s `ADMIN_WRITE_TX_TIMEOUT_MS` window far more generous — but the persist-then-ack design **stays** (the 5 s ack deadline is Razorpay-side and unconditional). Obligations 2 and 3 below should be read with these substitutions; everything else in this section is topology-independent.

So, for the infra decision:

- **Cloudflare in front of the API does NOT break Razorpay webhook HMAC.** It is safe to adopt, with four obligations:
  1. **Bot management is the real hazard, and the mitigation is plan-dependent:** server-to-server POSTs have no browser fingerprint. On the **Free plan, Bot Fight Mode cannot be exempted** — WAF Skip/Bypass rules explicitly "have no effect" on it. So: either keep Bot Fight Mode OFF on the API zone, or **grey-cloud (DNS-only) the API/webhook hostname**, or be on a plan with Super Bot Fight Mode / Bot Management where a Skip rule scoped to `/api/razorpay/webhook` works. Razorpay publishes webhook egress IPs (9 IPs + 2 CIDR ranges) usable as an additional allow signal — defense-in-depth only; signature verification remains the primary control.
  2. **Fix the hop count:** with Cloudflare → Railway edge → app there are 2 hops; `trust proxy: 1` would make `req.ip` the **Cloudflare edge IP**, mis-keying the global 120/min throttle and the webhook throttle. Correct setting on the CF path is `trust proxy: 2` — made env-driven (`TRUST_PROXY_HOPS`, default 1) so staging (Railway direct) and a CF-fronted prod differ by config, not code. Railway's own guidance here is informal and internally contradictory (Help-Station staff answers only), so this number must be **verified empirically at cutover** (log `req.ip` + XFF chain on a test request).
  3. **Lock the side door:** the app's direct `*.up.railway.app` hostname bypasses Cloudflare entirely — on that path `trust proxy: 2` trusts one attacker-controllable XFF entry (spoofable `req.ip`) and no CF protections apply. If CF is adopted, disable/randomize the direct Railway domain or restrict it; throttle keying must not be security-critical on any path where hop count is uncertain.
  4. No Workers/Snippets matched to the webhook path (or pass-through only); no body-touching features on the API zone.
- **Without Cloudflare** (Railway direct — current staging design): nothing changes; `trust proxy: 1` remains correct.

---

## 5. Environment variables

### New (Backend)

| Key | Required | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID` | prod-boot **required**; optional in dev | Basic-auth username; test-mode `rzp_test_…` in staging |
| `RAZORPAY_KEY_SECRET` | prod-boot **required**; optional in dev | Basic-auth password; also keys the checkout-signature verify; never logged |
| `RAZORPAY_WEBHOOK_SECRET` | prod-boot **required**; optional in dev | Chosen by us when registering the webhook URL in the dashboard; distinct from key secret by design |
| `RAZORPAY_WEBHOOK_SECRET_OLD` | optional | Rotation window only (§4.1) |
| `RECONCILE_PAYMENT_MIN_AGE_MIN` | default 15 | payments-sweep minimum age |
| `REFUND_CONCLUDE_MIN_AGE_MIN` | default 15 | refunds-sweep minimum age before the §3 recovery routine runs ★REVIEW-FIX |
| `PAYMENT_ABANDON_TTL_HOURS` | default 24 | when abandonment cancels + restocks; reuse-if-fresh margin is TTL − 2h (§1.1) |
| `RECONCILE_ANOMALY_MAX_OBSERVATIONS` | default 3 | §1.3 anomaly-hold terminal |
| `TRUST_PROXY_HOPS` | default 1 | §4.2; changes only if CF is adopted |

**No dev fallbacks.** PhonePe had committed sandbox constants (`DEV_FALLBACKS`, env.ts:149-156); Razorpay test-mode keys are real credentials with no safe committed equivalent. Dev behavior without keys: initiate/verify/refund endpoints return 503 (the existing MSG91/Cloudinary pattern); signing unit tests use fixture secrets. `DEV_FALLBACKS`' PhonePe entries are deleted.

### Removed

`PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX`, `PHONEPE_BASE_URL` — from the `env.ts` schema (:121-124), the prod refine block (:185-187), `DEV_FALLBACKS`, and `Backend/.env.example:56-60`. Recon: no other env file in the repo carries them; real values live only in deploy dashboards.

### Where validation/gating changes

- `env.ts` schema + prod refine block: swap the three hard-required keys. **Cutover ordering constraint (bricks deploys if done wrong, in both directions):** set `RAZORPAY_*` in the deploy environment (Coolify — infra amendment) *before* deploying code that requires them; remove `PHONEPE_*` only *after* the old code is gone.
- `integrations-status.ts:32` + test: `phonepe` flag → `razorpay` (presence of all three keys). This key is a **wire contract** — the same task must update `Admin/src/types/settings.ts:18` and `integrations-tab.tsx:10`, or the payments integration silently renders "Not configured".
- `audit-redact.ts:2`: extend `SECRET_KEY` regex to cover `x-razorpay-signature` (add a generic `signature` term), **plus the test that was never written** — recon confirmed the current `x-verify` entry is untested.
- Storefront: **no new env var** — `keyId` rides the initiate response (§1.1).
- No `PHONEPE_BASE_URL` equivalent: `https://api.razorpay.com` is a module constant, not config. No callback-URL var either — webhooks are dashboard-registered against the **API origin** (`api.staging.woodhouseherbals.com`; test-mode and live-mode webhooks are configured separately, each with its own secret), which retires the recon's dead-webhook-URL trap (`WEB_ORIGIN`-derived `callbackUrl`, `phonepe.service.ts:106`) outright; the construction is deleted, not ported.

---

## 6. Test plan

Harness reality (recon): `node:test` + tsx pure units only — no integration/e2e capability exists in the test suites (CI *does* already provision a live Postgres + `migrate deploy`, which §2c reuses ★REVIEW-FIX). This plan adds a **minimal integration harness** because the raw-body webhook path is the single most fragile piece of a gateway swap and is currently untested.

### Pure TDD (write test → fail → implement → pass; repo's existing style)

| Unit | What is pinned |
|---|---|
| `razorpay-signing.ts` | `verifyWebhookSignature(rawBody, signature, secret)` (+ old-secret fallback) and `verifyCheckoutSignature(orderId, paymentId, signature, keySecret)` (order_id first, pipe separator) — port the five properties from `phonepe.service.test.ts:55-90` 1:1: byte-exact raw body; tamper reject; **re-serialised-JSON reject**; empty-signature reject; length-mismatch returns false instead of `timingSafeEqual` throwing |
| `razorpay-states.ts` | entity-status → internal action (`captured`+guards→settle-success; `captured`+amount-mismatch→anomaly-hold; `failed`→annotate-only-if-INITIATED; `authorized`→no-op/log; unknown→ignore+log; **decisions keyed on `entity.status`, with event-name/arrival-order permutation tests** — captured-before-authorized, authorized-carrying-captured, failed-then-captured same id, late-failed-after-SUCCESS must not clobber ★REVIEW-FIX) and refund status → `PROCESSED/FAILED/PENDING` porting the **policy** tests from `refund-transitions.test.ts:37-59`: definitive 4xx → FAILED (releases payment); 5xx/network → PENDING; unknown status (incl. 'reversed') → PENDING, never guessed |
| receipt/idempotency-key derivation | determinism (same refund id ⇒ same key), charset/length vs the `X-Refund-Idempotency` rule (≥10, alnum/hyphen/underscore) and the 40-char order-receipt cap; order-receipt uniqueness per mint |
| webhook event router | `contains[]`-driven payload parsing; unknown-event ack path (pure function) |
| cron decision logic | pure function: (payment age, fetched attempts, TTLs, anomaly-observation count) → `settle-success / anomaly-hold / anomaly-terminal / authorized-stuck / abandon / wait` — including: **captured-after-abandon recovery**, mismatched-captured blocks abandonment, hold reaches its observation terminal ★REVIEW-FIX; refunds sweep: **fresh-state-read primary**, re-send only on creation ambiguity, conclude-FAILED requires positive evidence (successful empty list + definitive 4xx re-send — timeouts stay PENDING) ★REVIEW-FIX |
| guest ownership guard | JWT-owner / guest-session / neither ⇒ allow/allow/404 matrix (option A) |
| refund client response mapping | 409-in-flight branch; "Duplicate receipt" → already-created-go-fetch; error-shape parse (`error.code`/`reason`, no description string-matching) |
| initiate reuse/supersede logic | fresh row reused; stale row superseded (FAILED) + new mint; P2002 race loser returns winner's rzp order id ★REVIEW-FIX |

### Pre-migration pinning tests (Phase 0 — written BEFORE any provider code changes)

Pin the provider-agnostic machinery the swap touches, so regressions surface as test failures rather than money bugs:
- `WebhookEventsService`: claim/duplicate-P2002/`shouldProcess: !processed` re-claim/markProcessed/markFailed (mocked Prisma) — the at-most-once backbone, currently untested.
- `RefundsService` with a stubbed provider client (constructor injection already permits): CAS claim → 409; P2002 → 409; provider-throw → row stays PENDING; settle race (second caller no-ops); FAILED releases payment; `restockApplies` one-physical-return matrix.

### Integration (new, minimal)

- `supertest` + `@nestjs/testing` devDeps; one suite booting the real bootstrap: webhook route receives **exact raw bytes** (proving the `express.raw` mount + prefix wiring); 400 on missing signature/body; **2xx ack returned before settlement work completes** (the 5-second-deadline shape); replay short-circuit on duplicate event id; a mounted-path regression test that fails if the raw mount and controller route ever diverge (the §4.1 trap).
- CI (extends the existing `backend-check` Postgres job — §2c): partial-index existence (both indexes) + behavioral 23505 tests + §2a/§2b assertions (added in Phase 1).

### Sandbox verification checklist (manual, test-mode keys — gates go-live, Checkpoint 6)

initiate → checkout.js test card → `payment.captured` webhook → order PAID + cart cleared; failed attempt then successful retry on the same rzp order (order must NOT cancel in between); out-of-order delivery tolerated (settle from `verify` first, late webhook no-ops); double-initiate race (two tabs) yields ONE rzp order ★REVIEW-FIX; **captured-after-abandon drill: pay a test order, suppress the webhook, force-run abandonment, then let the capture land — expect payment FAILED→SUCCESS + `captured_after_abandon` order-event + order stays CANCELLED + admin refund path works** ★REVIEW-FIX; full refund cycle initiate → `refund.processed` → order REFUNDED; refund-create timeout drill (block egress; verify PENDING → recovery resolves via fresh state read, no double refund); **lost-refund-webhook drill: ack a refund.processed then kill the worker before settle — the refunds sweep must settle it from the state read** ★REVIEW-FIX; tampered-signature webhook rejected; webhook handler answers <5 s under a deliberately slow DB; cron drills: strand an INITIATED payment → sweep settles it; TTL-expired payment cancels + restocks exactly once; dead-man timestamp visibly updates per sweep.

---

## 7. Ordered work breakdown

Every phase lands as its own reviewed commit(s) on a feature branch. **⛔ = stop-and-show-me checkpoint** — no further work until you approve. Money-touching phases (4, 5, 6) each get an extra-heavy adversarial multi-agent review (the D1b treatment) *before* their checkpoint.

| # | Phase | Contents | Gate |
|---|---|---|---|
| 0 | **Pin & harden** (no behavior change) | Pre-migration pinning tests (§6); boot-time partial-index assertion (list-driven, §2c) + extension of the existing CI Postgres job with the §2c/§2d index assertions + schema tripwire comments; demonstrate the boot assertion firing against a doctored DB | ⛔ **CP0** — four named approvals: (1) guest option A/B/C, (2) `GATEWAY` rename incl. relabelled history display, (3) §1.1 auto-capture param deviation, (4) §2c Prisma-upgrade deferral ★REVIEW-FIX |
| 1 | **DB migrations + enum-coupled literals** ★REVIEW-FIX | Drop `Payment.provider` default (§2a); `RENAME VALUE 'PHONEPE'→'GATEWAY'` **in the same commit as** `refunds.service.ts:241/:272/:423` and the two Admin literals (`types/order.ts:73`, `refunds-panel.tsx:42`) — the regenerated Prisma client makes them compile errors otherwise; add nullable `Payment.providerPaymentId`; add `payment_one_initiated_per_order` + its data-cleanup precondition (§2d); append §2a/§2b/§2d assertions to the CI job | ⛔ **CP1**: review raw SQL. Migrations apply to dev/CI DBs only — the Neon staging branch receives them exclusively via this branch's own deploy (code+migration together); never against a live old-code environment |
| 2 | **Razorpay pure core** (TDD) | `razorpay-signing.ts`, `razorpay-states.ts`, receipt/idempotency-key derivation, `contains[]` event router, cron decision functions (incl. captured-after-abandon, anomaly-hold terminal, conclude-FAILED evidence rules), initiate reuse/supersede logic | ⛔ **CP2**: review formulas + decision tables against the Appendix B sources side-by-side |
| 3 | **Client + initiate** | `RazorpayClient` (orders create/fetch/fetch-payments, payments fetch, refund create **with `X-Refund-Idempotency` + 409 branch**/fetch/list; Basic auth; 15 s timeout; secret-free logging); `/api/razorpay/initiate` incl. reuse-if-fresh/supersede + P2002 race handling + guest guard; `main.ts` raw-mount swap + env-driven `TRUST_PROXY_HOPS`; webhook controller (verify + claim + ack only — no settlement yet) | integration harness lands here |
| 4 | **Webhook settlement + verify fast-path** — MONEY | Persist-then-ack async processing; entity-status-driven settle with full guard set (`captured` → ports markSuccess; `paid_on_non_pending` + `captured_after_abandon` + `payment_amount_mismatch` as persisted order-events; `failed` → annotate gated on INITIATED, never touches providerPaymentId); refund events → `RefundsService.settle` (+ `refund_settled_after_conclude` tripwire); `/api/razorpay/verify` (signature + API fetch + settle) | heavy review → ⛔ **CP3** |
| 5 | **Refund path re-target** — MONEY | Swap client in `refunds.service.ts`; idempotency-header create; recovery routine per §3 (fresh-state-read primary → creation-ambiguity re-send → positive-evidence conclude); delete `RF`-prefix routing | heavy review → ⛔ **CP4** |
| 6 | **Reconciliation cron** — MONEY | `reconciliation/` module + `@nestjs/schedule` v6; payments sweep (identical settle guards, abandonment cancel+restock with the FF-22 reference fix, anomaly holds + terminals); refunds sweep (§3 routine — Phase 5 shipped it as RefundsService.recoverPendingRefund; the sweep calls it per PENDING row); **unprocessed-claims re-drive** (★CP3/CP4 carry-over: replay processed=false razorpay claims >15min old through the settlement door — the INITIATED-only payments sweep cannot cover FAILED-row recoveries); dead-man timestamp + ops logging; single-instance note; **mark FF-22 resolved in `fast-follows/admin-panel.md`** ★REVIEW-FIX | heavy review → ⛔ **CP5** |
| 7 | **PhonePe removal** | Delete `modules/phonepe/` (8 files); purge env.ts/`.env.example`; drop dead `bullmq` dep, add `@nestjs/schedule`; integrations key `phonepe`→`razorpay` (backend + Admin types + tab, one commit); audit-redact regex + new test; docs refresh: SECURITY.md (webhook model rewrite + fix the false redirect-validation claim at :30), architecture.md (fix the false BullMQ claim at :70 — the cron is now real), README, PRE-LAUNCH §2 rewrite (dashboard webhook registration on the API origin + failure-alert email + auto-disable warning + dead-man alert rule; §4.2 CF checklist if adopted; sandbox checklist) | gate ★REVIEW-FIX: `grep -ri phonepe` clean across **Backend/ + docs/** (excluding migration SQL + dated plan/spec records); Admin/Frontend strings are Phase 8/9 scope — the full repo-wide grep is the Phase 10 gate |
| 8 | **Admin UI** | Dialog title/toast provider-neutral ("Gateway refund initiated"); PaymentCard renders `payments[].provider` instead of the hardcoded "PhonePe txn" label (`sections.tsx:101`); recheck toast maps raw provider states to friendly copy (today it leaks provider vocabulary, `use-order-mutations.ts:63`); surface the new anomaly order-events in the timeline (they're ordinary OrderEvents — mostly free) | |
| 9 | **Storefront checkout** (greenfield — **separate plan doc at execution time**) | This plan defines only the contract: cart→`POST /api/orders` (requires cart sync — the storefront cart is client-only Zustand today, never synced to the backend cart the order path reads: recon), →`/api/razorpay/initiate`→checkout.js (mandatory options incl. `name`; `retry` enabled)→`/api/razorpay/verify`→result page polling `GET /api/orders/:number` (existing endpoint, includes payments). Also: replace the cart page's PhonePe trust copy (`cart/page.tsx:122`) and dead `/checkout` links | ⛔ **CP-9a**: approve its plan before build |
| 10 | **Cutover + final review** — *infra amendment: deploy target is the Coolify VPS, not Railway* | Staging env swap in the §5 order (env vars live in Coolify; confirm Coolify's release flow runs `migrate:deploy` before app start, mirroring the Railway assumption in §2b); DNS `api.staging` → VPS (Hostinger hPanel); dashboard webhook (test mode) → `https://api.staging.woodhouseherbals.com/api/razorpay/webhook` + failure-alert email; empirical `TRUST_PROXY_HOPS` verification **on the Cloudflare → Traefik → app chain** + Traefik forwarded-headers trust config + VPS raw-IP/hostname lockdown (§4.2 amendment); full sandbox checklist (§6); **repo-wide `grep -ri phonepe` gate** (only migration SQL + dated historical docs may remain); whole-branch adversarial review; memory/PRE-LAUNCH updates | ⛔ **CP6**: go/no-go |

**Explicitly out of scope:** partial refunds (`PARTIALLY_REFUNDED` stays unused — unchanged from today); multi-instance cron locking; the Prisma 7 upgrade + declarative partial indexes (fast-follow, §2c item 4); FF-19 credit notes.

---

## Appendix A — PhonePe removal inventory (delete/edit checklist for Phase 7)

- **Delete:** `Backend/src/modules/phonepe/` — controller, service, module, dto, `phonepe-signing.ts`, `phonepe-refund.client.ts`, both test files.
- **Edit:** `app.module.ts` (module swap), `main.ts` (raw mount path + env-driven trust-proxy hops), `env.ts` (schema/refine/DEV_FALLBACKS), `Backend/.env.example`, `audit-redact.ts` (+new test), `integrations-status.ts` (+test), `store-settings-admin.service.ts`, `refunds.service.ts`/`refund-transitions.ts`/`refunds.module.ts` (client + recovery routine; the `'GATEWAY'` literals moved to Phase 1), `order-events` meta strings (`via: 'phonepe_callback'` → `'razorpay_webhook'`; cosmetic, but grep-clean), `schema.prisma` (+ migrations §2), `Backend/package.json` (drop `bullmq`, add `@nestjs/schedule`), Admin: `types/settings.ts`, `refund-dialog.tsx`, `sections.tsx`, `use-order-mutations.ts`, `integrations-tab.tsx` (enum literals in `types/order.ts` + `refunds-panel.tsx` moved to Phase 1); Frontend: `cart/page.tsx:122` copy (Phase 9).
- **Docs:** README.md, docs/architecture.md, docs/SECURITY.md, docs/PRE-LAUNCH.md. Historical specs/plans under `docs/superpowers/` stay as-is (dated records, not live docs); `fast-follows/admin-panel.md` FF-22 gets its resolution note in Phase 6.
- **Survives untouched (do not "clean up"):** orders/inventory/order-events/webhook-events/admin-orders/invoices modules; refunds controller + DTOs; the partial unique indexes; all Keep-classified tests from the recon.

## Appendix B — load-bearing provider/platform facts (verified 2026-07-12/13)

1. **Orders API / auto-capture:** `POST /v1/orders` — `amount` (paise int, min 100), `currency`, `receipt` (optional, **max 40 chars, documented unique**), `notes`; legacy top-level `payment_capture` is no longer documented — auto-capture via nested `payment: {capture:'automatic', capture_options:{automatic_expiry_period:≥12,…}}`; API values override dashboard. Basic auth, no request signing. Order lifecycle `created → attempted → paid` (paid = on **capture**); multiple attempts per order supported; failed attempts never block retry, but a stuck `authorised` payment **does** block new attempts; order stays `paid` after refund; no order expiry documented (UNCONFIRMED as guarantee); live order fetch fails >180 days. `GET /v1/orders/:id/payments` returns all attempts incl. failures. *(razorpay.com/docs/api/orders/*, /payments/capture-settings/*)*
2. **Checkout:** `https://checkout.razorpay.com/v1/checkout.js`; mandatory options `key, amount, currency, name, order_id`; success handler gets `razorpay_payment_id/order_id/signature`; verify `HMAC_SHA256(key_secret, order_id + '|' + payment_id)` hex — order_id first. *(…/payments/payment-gateway/web-integration/standard/*)*
3. **Webhooks:** header `X-Razorpay-Signature` = HMAC-SHA256 hex of the **raw body** with the per-webhook secret ("Do not parse or cast the webhook request body"); `x-razorpay-event-id` documented unique-per-event for duplicate detection (same-id-on-retry implied, not verbatim); **ack within 5 s** or delivery fails; retries exponential-backoff 24 h then the **webhook is auto-disabled**; rotated secrets: old deliveries stay signed with the old secret; ≤30 URLs, test/live configured separately, per-URL secret; egress IPs published (9 + 2 CIDRs). Envelope `{entity:'event', event, contains:[…], payload:{<entity>:{entity:{…}}}}`; refund events carry both refund & payment entities. **Sequence not fixed**; `payment.authorized` may already carry `status:'captured'`; `payment.failed→payment.captured` on the same payment is documented expected behavior. *(…/docs/webhooks/*)*
4. **Refunds:** `POST /v1/payments/:id/refund` (`amount` omitted ⇒ full refund; `speed` normal/optimum with silent optimum→normal fallback, read `speed_processed`); **`X-Refund-Idempotency` header** (≥10 chars, alnum/hyphen/underscore; same key + same body ⇒ **replay of the saved original response** — a stale snapshot, which is why it must never be used as a state probe (§3); different body ⇒ rejected; in-flight race ⇒ 409); `receipt` = per-payment idempotency with **reject-not-replay** ("Duplicate receipt found…" ⇒ already exists, go fetch); no server-side receipt filter on list endpoints (client-side match over `GET /v1/payments/:id/refunds`); statuses `pending/processed/failed` (`processed` terminal but may precede bank ARN; webhook docs mention a 'Reversed' outcome absent from the enum — tolerate unknown strings); refunds only on `captured` payments, ≤6-month window (violation = sync 400 or async `failed`); errors `{error:{code, description, reason, …}}`, 400 = BAD_REQUEST_ERROR. *(…/docs/api/refunds/*, incl. normal-refunds-idempotent)*
5. **Postgres:** `ALTER TYPE … RENAME VALUE` — PG 10+, metadata-only (enum cells are OIDs), **no transaction-block restriction** (safe under Prisma Migrate's per-migration tx); `ADD VALUE` may run in a tx (PG 12+) but the new value is unusable until commit ⇒ add-and-use requires two migration files; `ALTER COLUMN … DROP/SET DEFAULT` metadata-only, existing rows untouched. Partial unique **indexes** have no `pg_constraint` row — assert via `pg_indexes` (with `schemaname='public'`). *(postgresql.org/docs/current/sql-altertype.html, sql-altertable.html, view-pg-indexes.html)*
6. **Prisma:** current stable 7.8; **7.4 added `partialIndexes` preview** (`@@unique([...], where: …)`, Postgres migration+introspection support; #6974 closed) — repo is on 5.18. Hazards: 7.4.0–7.4.2 regression dropped manual partial indexes on every `migrate dev` (#29220; fixed 7.5.0 — undeclared manual partial indexes now explicitly preserved); open predicate-normalization bugs remain (#29386). On Prisma 5.x the engine doesn't model partial indexes ⇒ `migrate dev` leaves ours untouched; loss vectors are `db push` (unconfirmed-unsafe) and baseline resquash. *(prisma.io/docs + release notes + GitHub issues)*
7. **Cloudflare/Express/Railway:** no default CF feature modifies request bodies (Transform Rules are URL/query/header-only; Workers/Snippets are the only body-capable mechanisms); CF appends to `X-Forwarded-For` and supplies `CF-Connecting-IP`; Express numeric `trust proxy` counts hops right-to-left from the socket peer ⇒ CF→Railway→app needs 2, not 1; **Free-plan Bot Fight Mode cannot be skip-ruled** (Skip/Bypass "have no effect") — keep it off, grey-cloud the hostname, or upgrade; direct `*.up.railway.app` bypasses CF and makes hop-count assumptions spoofable there; Railway's XFF/trust-proxy guidance is informal (staff answers, mutually contradictory) ⇒ verify hops empirically at cutover; CF body limit 100 MB / origin timeout 120 s — non-issues. *(developers.cloudflare.com, expressjs.com/en/guide/behind-proxies.html, Railway Help Station)*
