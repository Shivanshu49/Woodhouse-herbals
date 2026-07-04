# Phase D1b — Refunds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-order refunds for admin orders — prepaid via the legacy PhonePe X-VERIFY refund API (async, callback + recheck), and COD via a one-step manual mark-refunded with a mandatory UTR — with exactly-once idempotency, restock-at-initiation, and failure honesty.

**Architecture:** A new `refunds` module (or a `RefundsService` inside `admin-orders`) mirroring the D1 hardening pattern (atomic conditional-write CAS). A new `PhonepeRefundClient` makes the first server→PhonePe S2S calls (refund + Check-Status), signed by a shared, extracted `phonepe-signing` module. Settlement arrives via the existing `/phonepe/callback` (a refund branch) and an admin `recheck` action. Money never moves without a persisted, audited `Refund` row; an order never shows REFUNDED unless the money settled.

**Tech Stack:** NestJS 10, Prisma/Postgres, class-validator DTOs, native `fetch` for S2S, `node --import tsx --test` + `node:assert/strict` for pure unit tests.

## Global Constraints

- **Money is integer paise.** Refund `amountMinor` = the order's `totalMinor` (full-order only; partial deferred).
- **ADMIN-only** on every refund endpoint (MANAGER excluded). Throttled. `AdminAuditInterceptor`.
- **Legacy PhonePe Standard Checkout / Hermes X-VERIFY** only — `sha256(base64 + path + saltKey)###saltIndex` for requests, `sha256(base64Response + saltKey)###saltIndex` for callbacks. NO PG v2 / OAuth.
- **Refundable states = {SHIPPED, DELIVERED, CANCELLED}** and, additionally, the order must have money in it (a SUCCESS PhonePe `Payment` for the prepaid endpoint; COD for the manual endpoint). REFUNDED is terminal.
- **Restock at initiation**, disposition `{RETURNED→restock (reason RETURNED), DAMAGED→none, LOST→none}`, applied once in the initiation transaction; a later money FAILURE never reverses it.
- **Idempotency:** partial unique index (one non-FAILED refund per order) + payment CAS (SUCCESS→REFUND_PENDING) + deterministic `merchantRefundId` (retry reuses the same id; recheck-before-repost).
- **Order → REFUNDED only on settled COMPLETED.** On FAILED: Payment REFUND_PENDING→SUCCESS, order unchanged, retry allowed.
- **Commits:** author Shivanshu, no Claude attribution. Gates: Backend `npm run typecheck` + `npm test` green before each commit.
- **No secret logging.** Never log saltKey / full X-VERIFY.

## File Structure

New (`Backend/src/modules/refunds/` unless noted):
- `refund-transitions.ts` — pure: `REFUNDABLE_STATUSES`, `canRefundStatus()`, `assertRefundable()`, `deriveMerchantRefundId()`, `mapRefundState()`, `shouldRestock()`. **Unit-tested.**
- `refund-transitions.test.ts`.
- `../phonepe/phonepe-signing.ts` — pure: `requestChecksum(base64, path, saltKey, saltIndex)`, `statusChecksum(path, saltKey, saltIndex)`, `callbackChecksum(base64Response, saltKey, saltIndex)`, `buildRefundPayload(...)`, `parsePhonepeState(json)`. **Unit-tested.** (Existing `phonepe.service` refactors to use `requestChecksum`/`callbackChecksum` — DRY, no behaviour change.)
- `../phonepe/phonepe-signing.test.ts`.
- `../phonepe/phonepe-refund.client.ts` — `PhonepeRefundClient.refund(...)` + `.status(...)` (native fetch, injectable/mockable).
- `refunds.service.ts` — `initiate` (prepaid), `manual` (COD), `settle` (shared by callback + recheck), `recheck`.
- `dto/refund-order.dto.ts`, `dto/manual-refund.dto.ts`.
- `refunds.controller.ts`, `refunds.module.ts`.

Modified:
- `Backend/prisma/schema.prisma` + a migration (enums, Refund fields, partial unique index).
- `Backend/src/common/config/env.ts` — dev fallback for `PHONEPE_BASE_URL` (sandbox host).
- `Backend/src/modules/phonepe/phonepe.service.ts` — use `phonepe-signing`; add the refund branch in `handleCallback` (route a callback whose `merchantTransactionId` matches a `Refund.merchantRefundId` to `RefundsService.settle`).
- `Backend/src/app.module.ts` — register `RefundsModule`.

**Convention:** pure logic → TDD Red→Green unit tests; DB/HTTP-touching service code → typecheck + the live/mocked demo (no mock-Prisma harness exists). Tasks 1–3 are pure TDD; 4–8 are wiring verified by typecheck + demo.

---

### Task 1: Schema + migration

**Files:** Modify `Backend/prisma/schema.prisma`; create the migration; `Backend/src/common/config/env.ts` (dev fallback).

- [ ] **Step 1: Edit schema** — add `enum RefundMethod { PHONEPE MANUAL }`, `enum RefundDisposition { RETURNED DAMAGED LOST }`; add `REFUND_PENDING` to `PaymentStatus` (between SUCCESS and REFUNDED); add to `model Refund`: `method RefundMethod`, `disposition RefundDisposition`, `utrReference String?`, `merchantRefundId String? @unique`.

- [ ] **Step 2: Create the migration + partial unique index.** Run `npx prisma migrate dev --name refunds_d1b --create-only`, then append to the generated `migration.sql`:

```sql
CREATE UNIQUE INDEX "refund_one_active_per_order"
  ON "Refund"("orderId") WHERE status <> 'FAILED';
```
Then apply: `npx prisma migrate dev` (regenerates the client).

- [ ] **Step 3: Dev fallback for the PhonePe host.** In `env.ts` `DEV_FALLBACKS`, add `PHONEPE_BASE_URL: 'https://api-preprod.phonepe.com/apis/pg-sandbox'` so dev has a host. (Prod still requires the real value.)

- [ ] **Step 4: Verify.** `cd Backend && npx tsc --noEmit && npm test` — typecheck clean, suite still green (130). Commit:

```bash
git add Backend/prisma/ Backend/src/common/config/env.ts
git commit -m "feat(refunds): schema — RefundMethod/Disposition, PaymentStatus REFUND_PENDING, Refund fields + one-active-refund partial unique index"
```

---

### Task 2: Refund state logic (pure)

**Files:** Create `refunds/refund-transitions.ts` + `.test.ts`.

**Interfaces — Produces:** `REFUNDABLE_STATUSES: readonly OrderStatus[]`, `canRefundStatus(status): boolean`, `assertRefundable(status): void` (throws `ConflictException`), `deriveMerchantRefundId(refundId): string`, `mapRefundState(phonepeState): 'PROCESSED'|'FAILED'|'PENDING'`, `shouldRestock(disposition): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// Backend/src/modules/refunds/refund-transitions.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, RefundDisposition } from '@prisma/client';
import {
  canRefundStatus, assertRefundable, deriveMerchantRefundId, mapRefundState, shouldRestock,
} from './refund-transitions';

test('refundable states are SHIPPED/DELIVERED/CANCELLED', () => {
  for (const s of ['SHIPPED', 'DELIVERED', 'CANCELLED'] as const) assert.equal(canRefundStatus(s), true);
  for (const s of ['PENDING', 'PAID', 'PROCESSING', 'REFUNDED'] as const) assert.equal(canRefundStatus(s), false);
});

test('assertRefundable throws for a non-refundable status', () => {
  assert.throws(() => assertRefundable(OrderStatus.PROCESSING), /cannot be refunded|Cancel it first/i);
  assert.doesNotThrow(() => assertRefundable(OrderStatus.DELIVERED));
});

test('deriveMerchantRefundId is deterministic + PhonePe-id-safe (alnum, <=38 chars)', () => {
  const id = deriveMerchantRefundId('cmr6xyz0001abcd');
  assert.equal(id, deriveMerchantRefundId('cmr6xyz0001abcd'));
  assert.match(id, /^RF[A-Za-z0-9]+$/);
  assert.ok(id.length <= 38);
});

test('mapRefundState maps PhonePe states to RefundStatus', () => {
  assert.equal(mapRefundState('COMPLETED'), 'PROCESSED');
  assert.equal(mapRefundState('FAILED'), 'FAILED');
  assert.equal(mapRefundState('PENDING'), 'PENDING');
  assert.equal(mapRefundState('SOMETHING_ELSE'), 'PENDING'); // unknown → not terminal
});

test('shouldRestock only for RETURNED', () => {
  assert.equal(shouldRestock(RefundDisposition.RETURNED), true);
  assert.equal(shouldRestock(RefundDisposition.DAMAGED), false);
  assert.equal(shouldRestock(RefundDisposition.LOST), false);
});
```

- [ ] **Step 2: Run → RED.** `cd Backend && npx tsx --test src/modules/refunds/refund-transitions.test.ts` → cannot resolve module.

- [ ] **Step 3: Implement**

```ts
// Backend/src/modules/refunds/refund-transitions.ts
import { ConflictException } from '@nestjs/common';
import { OrderStatus, RefundDisposition } from '@prisma/client';

/** Post-money states an admin may refund from (spec §2.1). PAID/PROCESSING must
 *  be cancelled first (which restocks pre-shipment), then refunded. */
export const REFUNDABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

export function canRefundStatus(status: OrderStatus): boolean {
  return REFUNDABLE_STATUSES.includes(status);
}

export function assertRefundable(status: OrderStatus): void {
  if (!canRefundStatus(status)) {
    throw new ConflictException(
      `An order in ${status} status cannot be refunded. Cancel it first (which restocks pre-shipment), then refund the cancelled order.`,
    );
  }
}

/** Deterministic, alphanumeric, PhonePe-safe refund id (retry reuses the same id). */
export function deriveMerchantRefundId(refundId: string): string {
  return `RF${refundId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 38);
}

/** PhonePe refund `data.state` → our RefundStatus token. Unknown → PENDING (not terminal). */
export function mapRefundState(state: string): 'PROCESSED' | 'FAILED' | 'PENDING' {
  if (state === 'COMPLETED') return 'PROCESSED';
  if (state === 'FAILED') return 'FAILED';
  return 'PENDING';
}

export function shouldRestock(disposition: RefundDisposition): boolean {
  return disposition === RefundDisposition.RETURNED;
}
```

- [ ] **Step 4: Run → GREEN.** Re-run the test file (5 pass). `npx tsc --noEmit`.

- [ ] **Step 5: Commit**
```bash
git add Backend/src/modules/refunds/refund-transitions.ts Backend/src/modules/refunds/refund-transitions.test.ts
git commit -m "feat(refunds): pure refund state logic — refundable guard, deterministic merchantRefundId, state map, restock rule"
```

---

### Task 3: PhonePe signing (pure, shared)

**Files:** Create `phonepe/phonepe-signing.ts` + `.test.ts`. Refactor `phonepe.service.ts` to use it.

**Interfaces — Produces:** `requestChecksum(base64, path, saltKey, saltIndex): string`, `statusChecksum(path, saltKey, saltIndex): string`, `callbackChecksum(base64Response, saltKey, saltIndex): string`, `buildRefundPayload({merchantId, merchantUserId, originalTxnId, merchantRefundId, amountMinor, callbackUrl}): { base64, checksum }`.

- [ ] **Step 1: Write the failing test** (checksums are deterministic sha256, so assert exact hex):

```ts
// Backend/src/modules/phonepe/phonepe-signing.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { requestChecksum, statusChecksum, callbackChecksum } from './phonepe-signing';

const salt = 'test-salt', idx = '1';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

test('requestChecksum = sha256(base64 + path + salt)###idx', () => {
  assert.equal(requestChecksum('YmFzZTY0', '/pg/v1/refund', salt, idx), `${sha('YmFzZTY0/pg/v1/refund' + salt)}###1`);
});

test('statusChecksum = sha256(path + salt)###idx (no base64)', () => {
  const path = '/pg/v1/status/M1/RFabc';
  assert.equal(statusChecksum(path, salt, idx), `${sha(path + salt)}###1`);
});

test('callbackChecksum = sha256(base64Response + salt)###idx (no path)', () => {
  assert.equal(callbackChecksum('cmVzcA==', salt, idx), `${sha('cmVzcA==' + salt)}###1`);
});
```

- [ ] **Step 2: Run → RED**, then implement:

```ts
// Backend/src/modules/phonepe/phonepe-signing.ts
import { createHash } from 'node:crypto';

const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');

/** X-VERIFY for a POST request: base64 body + endpoint path + salt. */
export function requestChecksum(base64: string, path: string, saltKey: string, saltIndex: string): string {
  return `${sha256Hex(base64 + path + saltKey)}###${saltIndex}`;
}

/** X-VERIFY for a GET Check-Status: the literal path + salt (no body). */
export function statusChecksum(path: string, saltKey: string, saltIndex: string): string {
  return `${sha256Hex(path + saltKey)}###${saltIndex}`;
}

/** X-VERIFY for an inbound webhook: base64 response + salt (no path). */
export function callbackChecksum(base64Response: string, saltKey: string, saltIndex: string): string {
  return `${sha256Hex(base64Response + saltKey)}###${saltIndex}`;
}

export interface RefundPayloadInput {
  merchantId: string;
  merchantUserId: string;
  originalTxnId: string; // original payment merchantTransactionId
  merchantRefundId: string; // the refund's own new id
  amountMinor: number;
  callbackUrl: string;
}

export function buildRefundPayload(
  input: RefundPayloadInput,
  saltKey: string,
  saltIndex: string,
): { base64: string; checksum: string } {
  const body = {
    merchantId: input.merchantId,
    merchantUserId: input.merchantUserId,
    originalTransactionId: input.originalTxnId,
    merchantTransactionId: input.merchantRefundId,
    amount: input.amountMinor,
    callbackUrl: input.callbackUrl,
  };
  const base64 = Buffer.from(JSON.stringify(body)).toString('base64');
  return { base64, checksum: requestChecksum(base64, '/pg/v1/refund', saltKey, saltIndex) };
}
```

- [ ] **Step 3: Run → GREEN** (3 pass).

- [ ] **Step 4: Refactor `phonepe.service.ts` to use the shared helpers** (no behaviour change): replace the inline pay checksum with `requestChecksum(base64, PAY_ENDPOINT, saltKey, saltIndex)` and `verifySignature` to compare against `callbackChecksum(rawBody, saltKey, saltIndex)`. Run `npm test` — the existing phonepe signature tests must stay green (this proves the refactor is faithful).

- [ ] **Step 5: Commit**
```bash
git add Backend/src/modules/phonepe/phonepe-signing.ts Backend/src/modules/phonepe/phonepe-signing.test.ts Backend/src/modules/phonepe/phonepe.service.ts
git commit -m "feat(phonepe): extract shared X-VERIFY signing (request/status/callback) + refund payload builder; refactor pay signing to use it"
```

---

### Task 4: PhonepeRefundClient (S2S HTTP)

**Files:** Create `phonepe/phonepe-refund.client.ts`.

**Interfaces — Produces:** `PhonepeRefundClient.refund({merchantRefundId, originalTxnId, merchantUserId, amountMinor}): Promise<{ code: string; state: string; providerRefundId?: string; raw: unknown }>` and `.status(merchantRefundId): Promise<{ code: string; state: string; providerRefundId?: string; raw: unknown }>`.

- [ ] **Step 1: Implement the client** (injectable; native fetch; timeout; uses `credentials()` + `phonepe-signing`). Verified by typecheck + the mocked demo (Task 8), not a unit test (it does IO).

```ts
// Backend/src/modules/phonepe/phonepe-refund.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { DEV_FALLBACKS, env } from '../../common/config/env';
import { buildRefundPayload, statusChecksum } from './phonepe-signing';

@Injectable()
export class PhonepeRefundClient {
  private readonly logger = new Logger(PhonepeRefundClient.name);
  private creds() {
    return {
      merchantId: env.PHONEPE_MERCHANT_ID ?? DEV_FALLBACKS.PHONEPE_MERCHANT_ID,
      saltKey: env.PHONEPE_SALT_KEY ?? DEV_FALLBACKS.PHONEPE_SALT_KEY,
      saltIndex: env.PHONEPE_SALT_INDEX,
      base: env.PHONEPE_BASE_URL ?? DEV_FALLBACKS.PHONEPE_BASE_URL,
    };
  }

  async refund(input: { merchantRefundId: string; originalTxnId: string; merchantUserId: string; amountMinor: number }) {
    const { merchantId, saltKey, saltIndex, base } = this.creds();
    const callbackUrl = `${env.WEB_ORIGIN.split(',')[0]}/api/phonepe/callback`;
    const { base64, checksum } = buildRefundPayload(
      { merchantId, merchantUserId: input.merchantUserId, originalTxnId: input.originalTxnId, merchantRefundId: input.merchantRefundId, amountMinor: input.amountMinor, callbackUrl },
      saltKey, saltIndex,
    );
    const res = await this.post(`${base}/pg/v1/refund`, { request: base64 }, checksum);
    return this.parse(res);
  }

  async status(merchantRefundId: string) {
    const { merchantId, saltKey, saltIndex, base } = this.creds();
    const path = `/pg/v1/status/${merchantId}/${merchantRefundId}`;
    const res = await this.get(`${base}${path}`, statusChecksum(path, saltKey, saltIndex), merchantId);
    return this.parse(res);
  }

  private parse(json: any) {
    return {
      code: json?.code ?? 'UNKNOWN',
      state: json?.data?.state ?? 'PENDING',
      providerRefundId: json?.data?.transactionId as string | undefined,
      raw: json,
    };
  }
  private async post(url: string, body: unknown, checksum: string) {
    const r = await fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, accept: 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json();
  }
  private async get(url: string, checksum: string, merchantId: string) {
    const r = await fetch(url, {
      method: 'GET', signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, 'X-MERCHANT-ID': merchantId, accept: 'application/json' },
    });
    return r.json();
  }
}
```

- [ ] **Step 2: Verify + commit.** `npx tsc --noEmit`. Commit `feat(phonepe): PhonepeRefundClient — signed S2S refund + Check-Status calls`.

---

### Task 5: RefundsService.manual (COD) + DTO — the fully-live path first

**Files:** `refunds/dto/manual-refund.dto.ts`, `refunds/refunds.service.ts` (constructor + `manual`).

**Interfaces — Produces:** `RefundsService.manual(orderId, dto, actorId)`.

- [ ] **Step 1: DTO**
```ts
// dto/manual-refund.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RefundDisposition } from '@prisma/client';
export class ManualRefundDto {
  @IsString() @IsNotEmpty() @MaxLength(120) utrReference!: string;
  @IsEnum(RefundDisposition) disposition!: RefundDisposition;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}
```

- [ ] **Step 2: Service `manual`** (one transaction; assert COD = no SUCCESS PhonePe payment; PROCESSED immediately). Inject `PrismaService`, `OrderEventsService`, `InventoryService`, `env`, `PhonepeRefundClient`.

```ts
async manual(orderId: string, dto: ManualRefundDto, actorId: string) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, status: true, totalMinor: true,
      items: { select: { productId: true, quantity: true } },
      payments: { where: { status: 'SUCCESS' }, select: { id: true } } },
  });
  if (!order) throw new NotFoundException('Order not found');
  assertRefundable(order.status);
  if (order.payments.length) {
    throw new ConflictException('This order was paid online — use the PhonePe refund, not manual.');
  }
  return this.prisma.$transaction(async (tx) => {
    const refund = await tx.refund.create({
      data: {
        orderId, amountMinor: order.totalMinor, method: 'MANUAL', disposition: dto.disposition,
        utrReference: dto.utrReference, status: 'PROCESSED', reason: dto.reason, actorId,
      },
    }); // partial unique index → 409 (mapped by the global Prisma filter, see note) on a 2nd active refund
    if (shouldRestock(dto.disposition)) {
      for (const it of order.items) {
        await this.inventory.adjust({ productId: it.productId, delta: it.quantity, reason: InventoryReason.RETURNED, actorId, reference: order.number, tx });
      }
    }
    await tx.order.update({ where: { id: orderId }, data: { status: OrderStatus.REFUNDED } });
    await this.events.record({ orderId, type: OrderEventType.RefundIssued, actorId, note: `Manual refund (UTR ${dto.utrReference})`, meta: { method: 'MANUAL', disposition: dto.disposition, amountMinor: order.totalMinor } }, tx);
    await this.events.record({ orderId, type: 'refund_settled', actorId, toStatus: OrderStatus.REFUNDED, meta: { refundId: refund.id } }, tx);
    return { id: refund.id, status: refund.status };
  }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });
}
```
> **Prereq note:** the partial unique index throws Prisma `P2002`; without a global `PrismaClientKnownRequestError` filter (fast-follow FF-9) this surfaces as 500. Task 5 adds a **narrow** catch mapping `P2002` on `Refund` → `ConflictException('A refund already exists for this order')` (or registers the global filter). Pick one; the plan uses a local catch to stay scoped.

- [ ] **Step 3: Verify + commit.** `npx tsc --noEmit && npm test`. Commit `feat(refunds): COD manual refund (one-step PROCESSED, mandatory UTR, disposition restock)`.

---

### Task 6: RefundsService.initiate (prepaid) + DTO

**Files:** `refunds/dto/refund-order.dto.ts`, `refunds.service.ts` (`initiate`).

- [ ] **Step 1: DTO** — `RefundOrderDto { disposition: RefundDisposition, reason?: string }`.

- [ ] **Step 2: `initiate`** — persist (CAS + refund + restock + event) in a tx, THEN call PhonePe (outside the tx), then store `providerRefundId`.

```ts
async initiate(orderId: string, dto: RefundOrderDto, actorId: string) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, status: true, totalMinor: true, userId: true,
      items: { select: { productId: true, quantity: true } },
      payments: { where: { status: 'SUCCESS' }, orderBy: { createdAt: 'desc' }, select: { id: true, providerTxnId: true } } },
  });
  if (!order) throw new NotFoundException('Order not found');
  assertRefundable(order.status);
  const payment = order.payments[0];
  if (!payment) throw new ConflictException('No successful online payment to refund — use the manual (COD) refund.');

  // Persist the refund intent atomically (CAS gate + unique index + restock + event).
  const refund = await this.prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({ where: { id: payment.id, status: 'SUCCESS' }, data: { status: 'REFUND_PENDING' } });
    if (claimed.count !== 1) throw new ConflictException('A refund is already in progress for this order.');
    const r = await tx.refund.create({
      data: { orderId, paymentId: payment.id, amountMinor: order.totalMinor, method: 'PHONEPE', disposition: dto.disposition, status: 'PENDING', reason: dto.reason, actorId },
    });
    const merchantRefundId = deriveMerchantRefundId(r.id);
    await tx.refund.update({ where: { id: r.id }, data: { merchantRefundId } });
    if (shouldRestock(dto.disposition)) {
      for (const it of order.items) {
        await this.inventory.adjust({ productId: it.productId, delta: it.quantity, reason: InventoryReason.RETURNED, actorId, reference: order.number, tx });
      }
    }
    await this.events.record({ orderId, type: OrderEventType.RefundIssued, actorId, note: 'PhonePe refund initiated', meta: { method: 'PHONEPE', disposition: dto.disposition, amountMinor: order.totalMinor, merchantRefundId } }, tx);
    return { ...r, merchantRefundId };
  }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });

  // Call PhonePe OUTSIDE the tx. A failure here leaves the refund PENDING for `recheck`.
  try {
    const res = await this.phonepe.refund({ merchantRefundId: refund.merchantRefundId!, originalTxnId: payment.providerTxnId!, merchantUserId: order.userId ?? order.id, amountMinor: order.totalMinor });
    await this.settleFromProvider(refund.id, res); // may already be COMPLETED/FAILED; usually PENDING
  } catch (e) {
    this.logger.error(JSON.stringify({ scope: 'refund:initiate:call_failed', refundId: refund.id }));
    // stays PENDING — admin uses recheck
  }
  return { id: refund.id, status: 'PENDING' };
}
```

- [ ] **Step 3: Verify + commit.** `npx tsc --noEmit`. Commit `feat(refunds): prepaid PhonePe refund initiation (CAS gate, restock, provider call, failure-safe)`.

---

### Task 7: Settlement — shared settle + callback branch + recheck

**Files:** `refunds.service.ts` (`settle`, `settleFromProvider`, `recheck`), `phonepe.service.ts` (callback refund branch).

- [ ] **Step 1: `settle`** — idempotent, only a PENDING refund transitions:
```ts
// state token from mapRefundState(providerState)
async settle(refundId: string, state: 'PROCESSED'|'FAILED'|'PENDING', providerRefundId?: string, raw?: unknown) {
  if (state === 'PENDING') return;
  await this.prisma.$transaction(async (tx) => {
    const claimed = await tx.refund.updateMany({ where: { id: refundId, status: 'PENDING' }, data: { status: state, providerRefundId, rawResponse: raw as any } });
    if (claimed.count !== 1) return; // already settled — idempotent no-op
    const refund = await tx.refund.findUnique({ where: { id: refundId }, select: { orderId: true, paymentId: true } });
    if (!refund) return;
    if (state === 'PROCESSED') {
      if (refund.paymentId) await tx.payment.update({ where: { id: refund.paymentId }, data: { status: 'REFUNDED' } });
      await tx.order.update({ where: { id: refund.orderId }, data: { status: OrderStatus.REFUNDED } });
      await this.events.record({ orderId: refund.orderId, type: 'refund_settled', toStatus: OrderStatus.REFUNDED, meta: { refundId } }, tx);
    } else { // FAILED — money never moved; free the payment for retry, order unchanged
      if (refund.paymentId) await tx.payment.update({ where: { id: refund.paymentId }, data: { status: 'SUCCESS' } });
      await this.events.record({ orderId: refund.orderId, type: 'refund_failed', note: 'PhonePe reported the refund failed', meta: { refundId } }, tx);
    }
  }, { timeout: env.ADMIN_WRITE_TX_TIMEOUT_MS });
}
async settleFromProvider(refundId: string, res: { state: string; providerRefundId?: string; raw: unknown }) {
  return this.settle(refundId, mapRefundState(res.state), res.providerRefundId, res.raw);
}
```

- [ ] **Step 2: `recheck`** — poll Check-Status for the order's active PhonePe refund and settle:
```ts
async recheck(orderId: string) {
  const refund = await this.prisma.refund.findFirst({ where: { orderId, method: 'PHONEPE', status: 'PENDING' }, select: { id: true, merchantRefundId: true } });
  if (!refund?.merchantRefundId) throw new NotFoundException('No pending PhonePe refund to re-check');
  const res = await this.phonepe.status(refund.merchantRefundId);
  await this.settleFromProvider(refund.id, res);
  return { id: refund.id, state: res.state };
}
```

- [ ] **Step 3: Callback refund branch** in `phonepe.service.handleCallback` — after decoding + the webhook claim, if `decoded.merchantTransactionId` matches a `Refund.merchantRefundId` (not a Payment), route to `RefundsService.settle(refund.id, mapRefundState(decoded.state), decoded.transactionId, decoded)` and return. (Inject `RefundsService` into `PhonepeService`, or emit via a shared method — avoid a circular module dep by putting `settle` reachable; the plan wires `RefundsModule` exporting `RefundsService` and `PhonepeModule` importing it.)

- [ ] **Step 4: Verify + commit.** `npx tsc --noEmit && npm test`. Commit `feat(refunds): idempotent settlement (callback + recheck), FAILED never leaves the order stuck`.

---

### Task 8: Controller + module + wiring, then the live/mocked demo

**Files:** `refunds/refunds.controller.ts`, `refunds/refunds.module.ts`, `app.module.ts`.

- [ ] **Step 1: Controller** — `@Controller('admin/orders')` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@UseInterceptors(AdminAuditInterceptor)` + `@Throttle(...)`; `@Roles(UserRole.ADMIN)` on each:
  - `@Post(':id/refund')` → `initiate(id, dto, user.sub)`
  - `@Post(':id/refund/manual')` → `manual(id, dto, user.sub)`
  - `@Post(':id/refund/recheck')` → `recheck(id)`

- [ ] **Step 2: Module** — `providers: [RefundsService, PhonepeRefundClient]`, `exports: [RefundsService]`; register in `app.module.ts`. Wire `PhonepeModule` to import `RefundsModule` for the callback branch (or expose `settle` via a light interface to avoid a cycle).

- [ ] **Step 3: Verify.** `npx tsc --noEmit && npm test` (full suite green). Start backend.

- [ ] **Step 4: Live demo — COD manual (fully live).** Seed a COD order in a refundable state (DELIVERED). `POST /admin/orders/:id/refund/manual` with `{utrReference, disposition:'RETURNED'}` → Refund PROCESSED, Order REFUNDED, product stock +qty (reason RETURNED), `refund_issued` + `refund_settled` events. Repeat with `disposition:'DAMAGED'` → no restock. Missing `utrReference` → 422. A second manual refund on the same order → 409.

- [ ] **Step 5: Live demo — prepaid (PhonePe mocked at the HTTP boundary).** Start a tiny local mock HTTP server; set `PHONEPE_BASE_URL` to it; it returns `{code:'PAYMENT_PENDING', data:{state:'PENDING', transactionId:'T-MOCK'}}` for `/pg/v1/refund`, and canned states for `/pg/v1/status/...`. Seed a prepaid DELIVERED order with a SUCCESS payment. `POST /admin/orders/:id/refund {disposition:'RETURNED'}` → Refund PENDING + providerRefundId stored + Payment REFUND_PENDING + restock + `refund_issued`. Then POST a signed refund callback (mock) with `state:'COMPLETED'` → Refund PROCESSED, Payment REFUNDED, Order REFUNDED, `refund_settled`. Separately: a `state:'FAILED'` callback → Refund FAILED, Payment back to SUCCESS, Order NOT REFUNDED, `refund_failed`. Double-initiate → 409. Kill the mock mid-initiate, then `POST /refund/recheck` (mock status COMPLETED) → reconciles. **Record real-PhonePe sandbox refund verification as a pre-launch checklist item (spec §10) — NOT done here.**

- [ ] **Step 6: Commit.** `feat(refunds): admin refund endpoints (ADMIN-only, throttled) + module wiring`.

---

## Self-Review

**Spec coverage:** refundable states §2.1 → Task 2 `assertRefundable` + Task 5/6 payment checks. Restock-at-init + disposition → Tasks 5/6 (`shouldRestock`). COD one-step PROCESSED + UTR → Task 5. Prepaid CAS + provider call + failure-safe → Task 6. Settlement (callback + recheck) + FAILED-not-stuck → Task 7. Idempotency (unique index + CAS + deterministic id) → Tasks 1/2/5/6. ADMIN-only + throttle → Task 8. Signing (request/status/callback) → Task 3. S2S client → Task 4. Schema → Task 1. Demo (COD live / PhonePe mocked) + pre-launch checklist → Task 8. ✅

**Placeholder scan:** none — each step has real code/commands. The one `P2002`-filter choice (Task 5 note) is called out as a scoped decision, not a gap.

**Type consistency:** `mapRefundState → 'PROCESSED'|'FAILED'|'PENDING'` matches `settle`'s param + `RefundStatus`. `deriveMerchantRefundId` used in Task 6 + Task 7 recheck. `PhonepeRefundClient.refund/.status` return shape matches `settleFromProvider`. `RefundDisposition`/`RefundMethod`/`REFUND_PENDING` all defined in Task 1. `OrderEventType.RefundIssued` exists (D1 Task 3); `refund_settled`/`refund_failed` are free-form `type` strings (schema allows). ✅

**Known follow-through:** the phonepe↔refunds module dependency (Task 7 Step 3) must avoid a circular import — resolved by RefundsModule exporting RefundsService and PhonepeModule importing RefundsModule (RefundsModule does NOT import PhonepeModule; PhonepeRefundClient lives in the phonepe module and is provided to RefundsModule). Verify at wire-up.
