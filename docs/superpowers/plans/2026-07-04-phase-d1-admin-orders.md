# Phase D1 — admin-orders backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read + non-money-movement write surface for admin order management — list, detail, add-note, cancel (with pre-shipment restock) — plus an `OrderEvent` timeline writer wired into every status-transition driver.

**Architecture:** A new `admin-orders` NestJS module mirroring `admin-products` exactly (thin controller → service → Prisma; pure logic extracted into standalone unit-tested files). A new `@Global() OrderEventsModule` exposes `OrderEventsService.record()`, called from the admin cancel/note actions and retrofitted into the two existing transition drivers (`phonepe.service`, `shipments.service`). No refunds, no invoices — those are D1b/D3. Money is never moved here; cancel only restocks pre-shipment reserved stock.

**Tech Stack:** NestJS 10, Prisma, Postgres, class-validator/class-transformer DTOs, `node --import tsx --test` + `node:assert/strict` for pure unit tests. No jest/vitest, no mock-Prisma harness.

## Global Constraints

- **Money is integer paise** (`*Minor` Int fields). Never floats; never divide for storage.
- **Order management roles = `[UserRole.ADMIN, UserRole.MANAGER]`** for every admin-orders endpoint (read and write). STAFF has no admin-panel login path (spec §3). This is intentionally narrower than `admin-products` READ_ROLES (which still lists STAFF) — do not copy STAFF here.
- **Refunds and invoices are OUT OF SCOPE for D1** (D1b / D3). No `Refund` writes, no `PaymentStatus` changes, no PhonePe refund calls in this plan.
- **`OrderEvent` is written on every status transition**, going forward, from all drivers (spec §4).
- **Cancel is pre-shipment only** — `PENDING` / `PAID` / `PROCESSING` (spec §2.1); illegal transitions reject with **409 Conflict**.
- **Cancel restock uses `InventoryReason.ORDER_CANCELLED`** via `InventoryService.adjust` in the same transaction (spec §2.2). Stock was reserved (`ORDER_RESERVED`, negative delta) at order creation, so cancel returns it (positive delta).
- **Orders have no soft-delete** (no `deletedAt` on `Order`) — do NOT add `excludeDeleted` to order queries.
- **Commits:** author as Shivanshu, plain messages, **no Claude attribution / co-author / trailer lines**.
- **Pagination envelope is `{ items, total, page, perPage }`** via `pageArgs(dto)` from `src/common/dto/pagination.dto.ts`.
- Run gates from `Backend/`: `npm run typecheck` (tsc --noEmit) and `npm test` must be green before each commit.

## File Structure

New files under `Backend/src/modules/`:

- `order-events/order-event-data.ts` — pure builder: `RecordOrderEventInput` → `Prisma.OrderEventUncheckedCreateInput` (drops nulls correctly). **Unit-tested.**
- `order-events/order-event-data.test.ts` — pure test.
- `order-events/order-event-types.ts` — the `OrderEventType` string constants (`status_changed` | `note_added` | `refund_issued`).
- `order-events/order-events.service.ts` — thin `OrderEventsService.record(input, tx?)`.
- `order-events/order-events.module.ts` — `@Global()` module exporting the service.
- `admin-orders/order-transitions.ts` — pure `canCancel()` / `assertCancellable()` (the §2.1 cancel guard). **Unit-tested.**
- `admin-orders/order-transitions.test.ts` — pure test.
- `admin-orders/admin-order-where.ts` — pure list where-builder. **Unit-tested.**
- `admin-orders/admin-order-where.test.ts` — pure test.
- `admin-orders/admin-order-sort.ts` — `AdminOrderSort` enum + pure `buildAdminOrderOrderBy()`. **Unit-tested.**
- `admin-orders/admin-order-sort.test.ts` — pure test.
- `admin-orders/admin-order-summary.ts` — pure row→summary mapper (derives `paymentStatus` + `itemCount`). **Unit-tested.**
- `admin-orders/admin-order-summary.test.ts` — pure test.
- `admin-orders/dto/list-admin-orders.dto.ts` — list query DTO (extends `PaginationDto`).
- `admin-orders/dto/add-order-note.dto.ts` — note body + visibility.
- `admin-orders/dto/cancel-order.dto.ts` — cancel reason.
- `admin-orders/admin-orders.service.ts` — list / detail / addNote / cancel.
- `admin-orders/admin-orders.controller.ts` — `@Controller('admin/orders')`, `@Roles(ADMIN, MANAGER)`.
- `admin-orders/admin-orders.module.ts` — module.

Modified:

- `Backend/src/app.module.ts` — register `OrderEventsModule` + `AdminOrdersModule`.
- `Backend/src/modules/phonepe/phonepe.service.ts` — record events at PENDING→PAID and PENDING→CANCELLED (after the CAS guard).
- `Backend/src/modules/shipments/shipments.service.ts` — record events at →PROCESSING / →SHIPPED / →DELIVERED.
- `Backend/src/modules/shipments/shipments.controller.ts` — align `@Roles(ADMIN, STAFF)` → `@Roles(ADMIN, MANAGER)`.

**Convention note (be faithful to the codebase):** this repo has **no mock-Prisma/integration test harness**. Pure logic is extracted into standalone files and unit-tested with `node:test`; DB-touching service/controller code is verified by `npm run typecheck` + a **live demo against the real DB**. Tasks 1–3 are full Red-Green TDD. Tasks 4–7 are wiring — their "test" step is typecheck + the end-of-plan live demo (spec §7), not an invented mock test.

---

### Task 1: Cancel state-machine guard (pure)

**Files:**
- Create: `Backend/src/modules/admin-orders/order-transitions.ts`
- Test: `Backend/src/modules/admin-orders/order-transitions.test.ts`

**Interfaces:**
- Consumes: `OrderStatus` from `@prisma/client`; `ConflictException` from `@nestjs/common`.
- Produces: `CANCELLABLE_STATUSES: readonly OrderStatus[]`, `canCancel(status: OrderStatus): boolean`, `assertCancellable(status: OrderStatus): void` (throws `ConflictException` on illegal). Consumed by Task 6.

- [ ] **Step 1: Write the failing test**

```ts
// Backend/src/modules/admin-orders/order-transitions.test.ts
/**
 * Pure unit tests for the admin cancel guard (spec §2.1). No Prisma client, no IO.
 * Run alone: npx tsx --test src/modules/admin-orders/order-transitions.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus } from '@prisma/client';
import { canCancel, assertCancellable, CANCELLABLE_STATUSES } from './order-transitions';

test('pre-shipment statuses are cancellable', () => {
  assert.equal(canCancel(OrderStatus.PENDING), true);
  assert.equal(canCancel(OrderStatus.PAID), true);
  assert.equal(canCancel(OrderStatus.PROCESSING), true);
});

test('shipped-and-beyond and terminal statuses are not cancellable', () => {
  assert.equal(canCancel(OrderStatus.SHIPPED), false);
  assert.equal(canCancel(OrderStatus.DELIVERED), false);
  assert.equal(canCancel(OrderStatus.CANCELLED), false);
  assert.equal(canCancel(OrderStatus.REFUNDED), false);
});

test('CANCELLABLE_STATUSES is exactly the three pre-shipment states', () => {
  assert.deepEqual([...CANCELLABLE_STATUSES].sort(), ['PAID', 'PENDING', 'PROCESSING']);
});

test('assertCancellable throws for SHIPPED', () => {
  assert.throws(() => assertCancellable(OrderStatus.SHIPPED), /Cannot cancel/);
});

test('assertCancellable is silent for PAID', () => {
  assert.doesNotThrow(() => assertCancellable(OrderStatus.PAID));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Backend && npx tsx --test src/modules/admin-orders/order-transitions.test.ts`
Expected: FAIL — cannot resolve `./order-transitions`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Backend/src/modules/admin-orders/order-transitions.ts
import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

/** Statuses an admin may cancel from — pre-shipment only (spec §2.1). */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.PAID,
  OrderStatus.PROCESSING,
];

export function canCancel(status: OrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/** Throws 409 if the order cannot be cancelled from its current status. */
export function assertCancellable(status: OrderStatus): void {
  if (!canCancel(status)) {
    throw new ConflictException(
      `Cannot cancel an order in ${status} status — only ${CANCELLABLE_STATUSES.join(
        ', ',
      )} orders can be cancelled. Once shipped, money is returned via the refund path.`,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Backend && npx tsx --test src/modules/admin-orders/order-transitions.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd Backend && npm run typecheck
git add src/modules/admin-orders/order-transitions.ts src/modules/admin-orders/order-transitions.test.ts
git commit -m "feat(admin-orders): pre-shipment cancel guard (state machine §2.1)"
```

---

### Task 2: List query logic (pure — where-builder, sort, summary mapper)

**Files:**
- Create: `Backend/src/modules/admin-orders/admin-order-where.ts`
- Test: `Backend/src/modules/admin-orders/admin-order-where.test.ts`
- Create: `Backend/src/modules/admin-orders/admin-order-sort.ts`
- Test: `Backend/src/modules/admin-orders/admin-order-sort.test.ts`
- Create: `Backend/src/modules/admin-orders/admin-order-summary.ts`
- Test: `Backend/src/modules/admin-orders/admin-order-summary.test.ts`

**Interfaces:**
- Produces:
  - `buildAdminOrderWhere(input: AdminOrderWhereInput): Prisma.OrderWhereInput`
  - `AdminOrderSort` enum + `buildAdminOrderOrderBy(sort?: AdminOrderSort): Prisma.OrderOrderByWithRelationInput`
  - `OrderSummaryRow`, `OrderSummary`, `toOrderSummary(row: OrderSummaryRow): OrderSummary`
  - All consumed by Task 4's service; `AdminOrderSort` also consumed by Task 4's DTO.

- [ ] **Step 1: Write the failing test (where-builder)**

```ts
// Backend/src/modules/admin-orders/admin-order-where.test.ts
/**
 * Pure unit tests for the admin order list where-builder. Type-only Prisma import.
 * Run alone: npx tsx --test src/modules/admin-orders/admin-order-where.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { buildAdminOrderWhere } from './admin-order-where';

test('empty input builds an empty where', () => {
  assert.deepEqual(buildAdminOrderWhere({}), {});
});

test('status filters on the order status column', () => {
  assert.deepEqual(buildAdminOrderWhere({ status: OrderStatus.PROCESSING }).status, 'PROCESSING');
});

test('paymentStatus filters via a payments relation (some)', () => {
  const where = buildAdminOrderWhere({ paymentStatus: PaymentStatus.SUCCESS });
  assert.deepEqual(where.payments, { some: { status: 'SUCCESS' } });
});

test('dateFrom/dateTo build a placedAt gte/lte range', () => {
  const where = buildAdminOrderWhere({ dateFrom: '2026-01-01T00:00:00.000Z', dateTo: '2026-02-01T00:00:00.000Z' });
  assert.deepEqual(where.placedAt, {
    gte: new Date('2026-01-01T00:00:00.000Z'),
    lte: new Date('2026-02-01T00:00:00.000Z'),
  });
});

test('dateFrom alone builds only gte', () => {
  const where = buildAdminOrderWhere({ dateFrom: '2026-01-01T00:00:00.000Z' });
  assert.deepEqual(where.placedAt, { gte: new Date('2026-01-01T00:00:00.000Z') });
});

test('q builds an OR across number, name, phone, and account email; trims', () => {
  const where = buildAdminOrderWhere({ q: '  WH-123 ' });
  assert.deepEqual(where.OR, [
    { number: { contains: 'WH-123', mode: 'insensitive' } },
    { shippingFullName: { contains: 'WH-123', mode: 'insensitive' } },
    { shippingPhone: { contains: 'WH-123', mode: 'insensitive' } },
    { user: { is: { email: { contains: 'WH-123', mode: 'insensitive' } } } },
  ]);
});

test('blank/whitespace q adds no OR', () => {
  assert.equal(buildAdminOrderWhere({ q: '   ' }).OR, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Backend && npx tsx --test src/modules/admin-orders/admin-order-where.test.ts`
Expected: FAIL — cannot resolve `./admin-order-where`.

- [ ] **Step 3: Write minimal implementation (where-builder)**

```ts
// Backend/src/modules/admin-orders/admin-order-where.ts
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

export interface AdminOrderWhereInput {
  q?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: string; // ISO 8601
  dateTo?: string; // ISO 8601
}

export function buildAdminOrderWhere(input: AdminOrderWhereInput): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (input.status) where.status = input.status;
  if (input.paymentStatus) where.payments = { some: { status: input.paymentStatus } };

  if (input.dateFrom || input.dateTo) {
    where.placedAt = {
      ...(input.dateFrom ? { gte: new Date(input.dateFrom) } : {}),
      ...(input.dateTo ? { lte: new Date(input.dateTo) } : {}),
    };
  }

  const q = input.q?.trim();
  if (q) {
    where.OR = [
      { number: { contains: q, mode: 'insensitive' } },
      { shippingFullName: { contains: q, mode: 'insensitive' } },
      { shippingPhone: { contains: q, mode: 'insensitive' } },
      { user: { is: { email: { contains: q, mode: 'insensitive' } } } },
    ];
  }

  return where;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Backend && npx tsx --test src/modules/admin-orders/admin-order-where.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing test (sort)**

```ts
// Backend/src/modules/admin-orders/admin-order-sort.test.ts
/** Run alone: npx tsx --test src/modules/admin-orders/admin-order-sort.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminOrderSort, buildAdminOrderOrderBy } from './admin-order-sort';

test('default / newest sorts by placedAt desc', () => {
  assert.deepEqual(buildAdminOrderOrderBy(), { placedAt: 'desc' });
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.Newest), { placedAt: 'desc' });
});

test('oldest sorts by placedAt asc', () => {
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.Oldest), { placedAt: 'asc' });
});

test('total_high / total_low sort by totalMinor', () => {
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.TotalHigh), { totalMinor: 'desc' });
  assert.deepEqual(buildAdminOrderOrderBy(AdminOrderSort.TotalLow), { totalMinor: 'asc' });
});
```

- [ ] **Step 6: Run test to verify it fails, then implement**

Run: `cd Backend && npx tsx --test src/modules/admin-orders/admin-order-sort.test.ts` → FAIL (unresolved import).

```ts
// Backend/src/modules/admin-orders/admin-order-sort.ts
import type { Prisma } from '@prisma/client';

export enum AdminOrderSort {
  Newest = 'newest',
  Oldest = 'oldest',
  TotalHigh = 'total_high',
  TotalLow = 'total_low',
}

export function buildAdminOrderOrderBy(sort?: AdminOrderSort): Prisma.OrderOrderByWithRelationInput {
  switch (sort) {
    case AdminOrderSort.Oldest:
      return { placedAt: 'asc' };
    case AdminOrderSort.TotalHigh:
      return { totalMinor: 'desc' };
    case AdminOrderSort.TotalLow:
      return { totalMinor: 'asc' };
    case AdminOrderSort.Newest:
    default:
      return { placedAt: 'desc' };
  }
}
```

Re-run: PASS (3 tests).

- [ ] **Step 7: Write the failing test (summary mapper)**

```ts
// Backend/src/modules/admin-orders/admin-order-summary.test.ts
/** Run alone: npx tsx --test src/modules/admin-orders/admin-order-summary.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { toOrderSummary } from './admin-order-summary';

const placedAt = new Date('2026-07-01T10:00:00.000Z');

test('maps a paid order row to a summary with derived payment status + item count', () => {
  const summary = toOrderSummary({
    id: 'o1',
    number: 'WH-1001',
    placedAt,
    status: OrderStatus.PAID,
    totalMinor: 129900,
    shippingFullName: 'Asha Rao',
    payments: [{ status: PaymentStatus.SUCCESS }],
    _count: { items: 3 },
  });
  assert.deepEqual(summary, {
    id: 'o1',
    number: 'WH-1001',
    placedAt,
    status: 'PAID',
    totalMinor: 129900,
    customerName: 'Asha Rao',
    paymentStatus: 'SUCCESS',
    itemCount: 3,
  });
});

test('an order with no payments has paymentStatus null (latest-payment rule)', () => {
  const summary = toOrderSummary({
    id: 'o2', number: 'WH-1002', placedAt, status: OrderStatus.PENDING,
    totalMinor: 5000, shippingFullName: 'Guest', payments: [], _count: { items: 1 },
  });
  assert.equal(summary.paymentStatus, null);
});
```

- [ ] **Step 8: Run test to verify it fails, then implement**

Run: `cd Backend && npx tsx --test src/modules/admin-orders/admin-order-summary.test.ts` → FAIL.

```ts
// Backend/src/modules/admin-orders/admin-order-summary.ts
import type { OrderStatus, PaymentStatus } from '@prisma/client';

/** Shape the list `select` returns — payments ordered desc, take 1 (latest first). */
export interface OrderSummaryRow {
  id: string;
  number: string;
  placedAt: Date;
  status: OrderStatus;
  totalMinor: number;
  shippingFullName: string;
  payments: { status: PaymentStatus }[];
  _count: { items: number };
}

export interface OrderSummary {
  id: string;
  number: string;
  placedAt: Date;
  status: OrderStatus;
  totalMinor: number;
  customerName: string;
  paymentStatus: PaymentStatus | null;
  itemCount: number;
}

export function toOrderSummary(row: OrderSummaryRow): OrderSummary {
  return {
    id: row.id,
    number: row.number,
    placedAt: row.placedAt,
    status: row.status,
    totalMinor: row.totalMinor,
    customerName: row.shippingFullName,
    paymentStatus: row.payments[0]?.status ?? null,
    itemCount: row._count.items,
  };
}
```

Re-run: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
cd Backend && npm run typecheck && npm test
git add src/modules/admin-orders/admin-order-where.ts src/modules/admin-orders/admin-order-where.test.ts \
        src/modules/admin-orders/admin-order-sort.ts src/modules/admin-orders/admin-order-sort.test.ts \
        src/modules/admin-orders/admin-order-summary.ts src/modules/admin-orders/admin-order-summary.test.ts
git commit -m "feat(admin-orders): pure list query logic — where-builder, sort, summary mapper"
```

---

### Task 3: OrderEventsService + `@Global` module (the timeline writer)

**Files:**
- Create: `Backend/src/modules/order-events/order-event-types.ts`
- Create: `Backend/src/modules/order-events/order-event-data.ts`
- Test: `Backend/src/modules/order-events/order-event-data.test.ts`
- Create: `Backend/src/modules/order-events/order-events.service.ts`
- Create: `Backend/src/modules/order-events/order-events.module.ts`
- Modify: `Backend/src/app.module.ts` (register `OrderEventsModule`)

**Interfaces:**
- Produces:
  - `OrderEventType` const (`StatusChanged: 'status_changed'`, `NoteAdded: 'note_added'`, `RefundIssued: 'refund_issued'`)
  - `RecordOrderEventInput` interface
  - `orderEventCreateData(input): Prisma.OrderEventUncheckedCreateInput` (pure)
  - `OrderEventsService.record(input: RecordOrderEventInput, tx?: Prisma.TransactionClient): Promise<void>`
  - Consumed by Tasks 5, 6, 7 (and later D1b).

- [ ] **Step 1: Write the failing test (pure data builder)**

```ts
// Backend/src/modules/order-events/order-event-data.test.ts
/** Run alone: npx tsx --test src/modules/order-events/order-event-data.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStatus } from '@prisma/client';
import { orderEventCreateData } from './order-event-data';
import { OrderEventType } from './order-event-types';

test('status change maps all fields', () => {
  const data = orderEventCreateData({
    orderId: 'o1',
    type: OrderEventType.StatusChanged,
    fromStatus: OrderStatus.PAID,
    toStatus: OrderStatus.CANCELLED,
    actorId: 'admin1',
    note: 'customer requested',
  });
  assert.equal(data.orderId, 'o1');
  assert.equal(data.type, 'status_changed');
  assert.equal(data.fromStatus, 'PAID');
  assert.equal(data.toStatus, 'CANCELLED');
  assert.equal(data.actorId, 'admin1');
  assert.equal(data.note, 'customer requested');
});

test('missing optionals collapse to null (statuses) / undefined (actor, note, meta)', () => {
  const data = orderEventCreateData({ orderId: 'o1', type: OrderEventType.NoteAdded });
  assert.equal(data.fromStatus, null);
  assert.equal(data.toStatus, null);
  assert.equal(data.actorId, undefined);
  assert.equal(data.note, undefined);
  assert.equal(data.meta, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd Backend && npx tsx --test src/modules/order-events/order-event-data.test.ts`
Expected: FAIL — cannot resolve `./order-event-data`.

- [ ] **Step 3: Write minimal implementation**

```ts
// Backend/src/modules/order-events/order-event-types.ts
/** OrderEvent.type is a free-form string in schema; these are the canonical values. */
export const OrderEventType = {
  StatusChanged: 'status_changed',
  NoteAdded: 'note_added',
  RefundIssued: 'refund_issued',
} as const;
export type OrderEventTypeValue = (typeof OrderEventType)[keyof typeof OrderEventType];
```

```ts
// Backend/src/modules/order-events/order-event-data.ts
import type { OrderStatus, Prisma } from '@prisma/client';

export interface RecordOrderEventInput {
  orderId: string;
  type: string;
  fromStatus?: OrderStatus | null;
  toStatus?: OrderStatus | null;
  actorId?: string | null;
  note?: string | null;
  meta?: Prisma.InputJsonValue;
}

/** Pure map to the Prisma create payload. Statuses default to null (nullable
 *  columns), the optional relation/scalars to undefined (omit → leave unset). */
export function orderEventCreateData(input: RecordOrderEventInput): Prisma.OrderEventUncheckedCreateInput {
  return {
    orderId: input.orderId,
    type: input.type,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    actorId: input.actorId ?? undefined,
    note: input.note ?? undefined,
    meta: input.meta ?? undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd Backend && npx tsx --test src/modules/order-events/order-event-data.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the service + module (thin — no unit test, verified by typecheck + live demo)**

```ts
// Backend/src/modules/order-events/order-events.service.ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { orderEventCreateData, RecordOrderEventInput } from './order-event-data';

@Injectable()
export class OrderEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Append one timeline event. Pass the caller's `tx` to write it in-band with
   *  the status change so an event never records without its transition. */
  async record(input: RecordOrderEventInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.orderEvent.create({ data: orderEventCreateData(input) });
  }
}
```

```ts
// Backend/src/modules/order-events/order-events.module.ts
import { Global, Module } from '@nestjs/common';
import { OrderEventsService } from './order-events.service';

// @Global so phonepe, shipments, and admin-orders can all record events without
// each importing this module (mirrors the @Global AuditModule precedent).
@Global()
@Module({
  providers: [OrderEventsService],
  exports: [OrderEventsService],
})
export class OrderEventsModule {}
```

- [ ] **Step 6: Register the module in `app.module.ts`**

Add the import near the other module imports and `OrderEventsModule` to the `imports` array (place it before the modules that will consume it — phonepe/shipments/admin-orders):

```ts
import { OrderEventsModule } from './modules/order-events/order-events.module';
// ...
@Module({
  imports: [
    // ...existing...
    OrderEventsModule,
    // ...
  ],
})
```

- [ ] **Step 7: Verify + commit**

```bash
cd Backend && npm run typecheck && npm test
git add src/modules/order-events/ src/app.module.ts
git commit -m "feat(order-events): OrderEventsService + @Global module (timeline writer)"
```

---

### Task 4: admin-orders list + detail endpoints

**Files:**
- Create: `Backend/src/modules/admin-orders/dto/list-admin-orders.dto.ts`
- Create: `Backend/src/modules/admin-orders/admin-orders.service.ts`
- Create: `Backend/src/modules/admin-orders/admin-orders.controller.ts`
- Create: `Backend/src/modules/admin-orders/admin-orders.module.ts`
- Modify: `Backend/src/app.module.ts` (register `AdminOrdersModule`)

**Interfaces:**
- Consumes: `buildAdminOrderWhere`, `buildAdminOrderOrderBy`, `AdminOrderSort`, `toOrderSummary` (Task 2); `pageArgs` + `PaginationDto` (`src/common/dto/pagination.dto.ts`); guards/decorators per the admin-products pattern.
- Produces: `AdminOrdersService.list(dto)` → `{ items, total, page, perPage }`; `AdminOrdersService.getById(id)` → full order; `GET /admin/orders`, `GET /admin/orders/:id`. Service consumed by Tasks 5, 6.

- [ ] **Step 1: Write the list DTO**

```ts
// Backend/src/modules/admin-orders/dto/list-admin-orders.dto.ts
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { AdminOrderSort } from '../admin-order-sort';

export class ListAdminOrdersDto extends PaginationDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @IsOptional() @IsISO8601() dateFrom?: string;
  @IsOptional() @IsISO8601() dateTo?: string;
  @IsOptional() @IsEnum(AdminOrderSort) sort?: AdminOrderSort = AdminOrderSort.Newest;
}
```

- [ ] **Step 2: Write the service (list + detail)**

```ts
// Backend/src/modules/admin-orders/admin-orders.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { pageArgs } from '../../common/dto/pagination.dto';
import { buildAdminOrderWhere } from './admin-order-where';
import { buildAdminOrderOrderBy } from './admin-order-sort';
import { toOrderSummary } from './admin-order-summary';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';

/** Thin list rows. Latest payment first so the summary mapper reads payments[0]. */
const SUMMARY_SELECT = {
  id: true,
  number: true,
  placedAt: true,
  status: true,
  totalMinor: true,
  shippingFullName: true,
  payments: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 },
  _count: { select: { items: true } },
} satisfies Prisma.OrderSelect;

/** Full detail — the D3 UI reads all of this. Address is denormalized on Order. */
const DETAIL_INCLUDE = {
  items: true,
  payments: { orderBy: { createdAt: 'desc' } },
  shipments: {
    include: { events: { orderBy: { occurredAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  },
  notes: { orderBy: { createdAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'desc' } },
  events: { orderBy: { createdAt: 'asc' } },
  user: { select: { id: true, fullName: true, email: true, phone: true } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListAdminOrdersDto) {
    const where = buildAdminOrderWhere({
      q: dto.q,
      status: dto.status,
      paymentStatus: dto.paymentStatus,
      dateFrom: dto.dateFrom,
      dateTo: dto.dateTo,
    });
    const orderBy = buildAdminOrderOrderBy(dto.sort);
    const { skip, take, page, perPage } = pageArgs(dto);

    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({ where, orderBy, skip, take, select: SUMMARY_SELECT }),
      this.prisma.order.count({ where }),
    ]);

    return { items: rows.map(toOrderSummary), total, page, perPage };
  }

  async getById(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }
}
```

- [ ] **Step 3: Write the controller**

```ts
// Backend/src/modules/admin-orders/admin-orders.controller.ts
import { Controller, Get, Param, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminAuditInterceptor } from '../../common/audit/admin-audit.interceptor';
import { AdminOrdersService } from './admin-orders.service';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';

// Order management is ADMIN + MANAGER (spec §3); no STAFF admin-panel path.
const ORDER_ROLES = [UserRole.ADMIN, UserRole.MANAGER];

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Roles(...ORDER_ROLES)
  @Get()
  list(@Query() dto: ListAdminOrdersDto) {
    return this.orders.list(dto);
  }

  @Roles(...ORDER_ROLES)
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.orders.getById(id);
  }
}
```

- [ ] **Step 4: Write the module + register in app.module.ts**

```ts
// Backend/src/modules/admin-orders/admin-orders.module.ts
import { Module } from '@nestjs/common';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';

@Module({
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
```

In `Backend/src/app.module.ts` add the import and list `AdminOrdersModule` in `imports` (near `AdminProductsModule`):

```ts
import { AdminOrdersModule } from './modules/admin-orders/admin-orders.module';
// ...imports: [ ...existing, AdminProductsModule, AdminOrdersModule, ... ]
```

- [ ] **Step 5: Verify (typecheck + start + smoke the list)**

```bash
cd Backend && npm run typecheck && npm test
```
Expected: typecheck clean; all pure tests green. Then start the server and smoke-test with an ADMIN cookie (dev admin `wf-roundtrip@woodhouse.test`):
```bash
# with the backend running on :4000 and a valid admin access cookie in $COOKIE
curl -s "http://localhost:4000/api/admin/orders?perPage=5" -H "Cookie: $COOKIE" | head -c 400
curl -s "http://localhost:4000/api/admin/orders?status=PENDING" -H "Cookie: $COOKIE" | head -c 400
```
Expected: `{ "items": [...], "total": N, "page": 1, "perPage": 5 }`; a bare `GET /admin/orders` with no cookie returns 401; a CUSTOMER cookie returns 403.

- [ ] **Step 6: Commit**

```bash
cd Backend
git add src/modules/admin-orders/ src/app.module.ts
git commit -m "feat(admin-orders): GET /admin/orders list + GET /admin/orders/:id detail"
```

---

### Task 5: Add-note endpoint

**Files:**
- Create: `Backend/src/modules/admin-orders/dto/add-order-note.dto.ts`
- Modify: `Backend/src/modules/admin-orders/admin-orders.service.ts` (add `addNote`)
- Modify: `Backend/src/modules/admin-orders/admin-orders.controller.ts` (add `POST :id/notes`)

**Interfaces:**
- Consumes: `OrderEventsService` (Task 3) — inject into the service; `OrderEventType.NoteAdded`; `AuthenticatedUser.sub` for `authorId`.
- Produces: `AdminOrdersService.addNote(id, dto, actorId)` → the created note; `POST /admin/orders/:id/notes`.

- [ ] **Step 1: Write the note DTO**

```ts
// Backend/src/modules/admin-orders/dto/add-order-note.dto.ts
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AddOrderNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(4000) body!: string;
  @IsOptional() @IsBoolean() isCustomerVisible?: boolean;
}
```

- [ ] **Step 2: Add `addNote` to the service (inject OrderEventsService)**

Update the constructor and add the method. The note create + its `note_added` event go in one transaction so the timeline can't record a note that didn't persist:

```ts
// add to imports
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';
import { AddOrderNoteDto } from './dto/add-order-note.dto';

// constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly events: OrderEventsService,
) {}

// method:
async addNote(id: string, dto: AddOrderNoteDto, actorId: string) {
  const order = await this.prisma.order.findUnique({ where: { id }, select: { id: true } });
  if (!order) throw new NotFoundException('Order not found');

  return this.prisma.$transaction(async (tx) => {
    const note = await tx.orderNote.create({
      data: {
        orderId: id,
        authorId: actorId,
        body: dto.body,
        isCustomerVisible: dto.isCustomerVisible ?? false,
      },
    });
    await this.events.record(
      {
        orderId: id,
        type: OrderEventType.NoteAdded,
        actorId,
        note: dto.isCustomerVisible ? 'Added a customer-visible note' : 'Added an internal note',
      },
      tx,
    );
    return note;
  });
}
```

- [ ] **Step 3: Add the controller route**

```ts
// add to imports: Body, Post; CurrentUser + AuthenticatedUser
import { Body, Controller, Get, Param, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/auth-types';
import { AddOrderNoteDto } from './dto/add-order-note.dto';

// route:
@Roles(...ORDER_ROLES)
@Post(':id/notes')
addNote(
  @Param('id') id: string,
  @Body() dto: AddOrderNoteDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.orders.addNote(id, dto, user.sub);
}
```

- [ ] **Step 4: Verify + live smoke**

```bash
cd Backend && npm run typecheck && npm test
```
Then, server running:
```bash
curl -s -X POST "http://localhost:4000/api/admin/orders/$ORDER_ID/notes" \
  -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d '{"body":"Called customer to confirm address","isCustomerVisible":false}' | head -c 300
```
Expected: the created note JSON; `GET /admin/orders/$ORDER_ID` now shows the note and a `note_added` event in `events`.

- [ ] **Step 5: Commit**

```bash
cd Backend
git add src/modules/admin-orders/
git commit -m "feat(admin-orders): POST /admin/orders/:id/notes (+ note_added event)"
```

---

### Task 6: Cancel endpoint (guard + pre-shipment restock + event)

**Files:**
- Create: `Backend/src/modules/admin-orders/dto/cancel-order.dto.ts`
- Modify: `Backend/src/modules/admin-orders/admin-orders.service.ts` (add `cancel`, inject `InventoryService`)
- Modify: `Backend/src/modules/admin-orders/admin-orders.controller.ts` (add `POST :id/cancel`)
- Modify: `Backend/src/modules/admin-orders/admin-orders.module.ts` (import `InventoryModule`)

**Interfaces:**
- Consumes: `assertCancellable` (Task 1); `InventoryService.adjust` with `InventoryReason.ORDER_CANCELLED`; `OrderEventsService` + `OrderEventType.StatusChanged`.
- Produces: `AdminOrdersService.cancel(id, dto, actorId)`; `POST /admin/orders/:id/cancel`.

- [ ] **Step 1: Write the cancel DTO**

```ts
// Backend/src/modules/admin-orders/dto/cancel-order.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @IsString() @IsNotEmpty() @MaxLength(500) reason!: string;
}
```

- [ ] **Step 2: Add `cancel` to the service**

Inject `InventoryService`; load the order with its status + items, guard with `assertCancellable`, then in one transaction: restock each item (`ORDER_CANCELLED`, positive delta), flip status to `CANCELLED`, record a `status_changed` event carrying the reason.

```ts
// add to imports
import { InventoryReason, OrderStatus } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { assertCancellable } from './order-transitions';
import { CancelOrderDto } from './dto/cancel-order.dto';

// constructor gains inventory:
constructor(
  private readonly prisma: PrismaService,
  private readonly events: OrderEventsService,
  private readonly inventory: InventoryService,
) {}

// method:
async cancel(id: string, dto: CancelOrderDto, actorId: string) {
  const order = await this.prisma.order.findUnique({
    where: { id },
    select: { id: true, number: true, status: true, items: { select: { productId: true, quantity: true } } },
  });
  if (!order) throw new NotFoundException('Order not found');
  assertCancellable(order.status); // throws 409 if not PENDING/PAID/PROCESSING

  return this.prisma.$transaction(async (tx) => {
    // Restock — goods never shipped, so return reserved stock (spec §2.2).
    for (const item of order.items) {
      await this.inventory.adjust({
        productId: item.productId,
        delta: item.quantity,
        reason: InventoryReason.ORDER_CANCELLED,
        actorId,
        reference: order.number,
        tx,
      });
    }
    await tx.order.update({ where: { id }, data: { status: OrderStatus.CANCELLED } });
    await this.events.record(
      {
        orderId: id,
        type: OrderEventType.StatusChanged,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        actorId,
        note: dto.reason,
      },
      tx,
    );
    return { id, status: OrderStatus.CANCELLED };
  });
}
```

- [ ] **Step 3: Add the controller route + import InventoryModule in the module**

```ts
// admin-orders.controller.ts route:
@Roles(...ORDER_ROLES)
@Post(':id/cancel')
cancel(
  @Param('id') id: string,
  @Body() dto: CancelOrderDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.orders.cancel(id, dto, user.sub);
}
```

```ts
// admin-orders.module.ts — import InventoryModule so InventoryService injects.
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule],
  controllers: [AdminOrdersController],
  providers: [AdminOrdersService],
  exports: [AdminOrdersService],
})
export class AdminOrdersModule {}
```
(Confirm `InventoryModule` exports `InventoryService`; if it does not, add it to that module's `exports`.)

- [ ] **Step 4: Verify + live smoke (the critical demo)**

```bash
cd Backend && npm run typecheck && npm test
```
Then, server running, against a seeded PAID order with known stock:
```bash
# note the product's stockQty before
curl -s -X POST "http://localhost:4000/api/admin/orders/$PAID_ORDER_ID/cancel" \
  -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d '{"reason":"Customer changed their mind"}'
```
Expected: `{ "id": "...", "status": "CANCELLED" }`. Verify in the DB: order status = CANCELLED; each line item's product `stockQty` increased by its quantity; an `InventoryMovement` row per item with reason `ORDER_CANCELLED`; an `OrderEvent` `status_changed` PAID→CANCELLED with the reason note. Then cancel a **SHIPPED** order → expect **409** with the "Cannot cancel" message and **no** stock change.

- [ ] **Step 5: Commit**

```bash
cd Backend
git add src/modules/admin-orders/
git commit -m "feat(admin-orders): POST /admin/orders/:id/cancel — guarded cancel + pre-shipment restock + event"
```

---

### Task 7: Retrofit event recording into existing drivers + align shipments roles

**Files:**
- Modify: `Backend/src/modules/phonepe/phonepe.service.ts` (record at PAID + CANCELLED, after the CAS guard)
- Modify: `Backend/src/modules/phonepe/phonepe.module.ts` (only if `OrderEventsService` needs an import — it's `@Global`, so likely not)
- Modify: `Backend/src/modules/shipments/shipments.service.ts` (record at PROCESSING / SHIPPED / DELIVERED)
- Modify: `Backend/src/modules/shipments/shipments.controller.ts` (`@Roles(ADMIN, STAFF)` → `@Roles(ADMIN, MANAGER)`, both admin endpoints)

**Interfaces:**
- Consumes: `OrderEventsService.record(input, tx)` (Task 3, `@Global`), `OrderEventType.StatusChanged`.

- [ ] **Step 1: Align shipments roles**

In `shipments.controller.ts`, change both admin endpoints (the `@Post()` create and `@Patch(':id')` update) from `@Roles(UserRole.ADMIN, UserRole.STAFF)` to `@Roles(UserRole.ADMIN, UserRole.MANAGER)`. Leave the customer `@Get('order/:number')` (JwtAuthGuard only) untouched.

- [ ] **Step 2: Record events in shipments.service.ts**

Inject `OrderEventsService` into the constructor. At the **→ PROCESSING** site (inside `create`'s transaction) capture the prior status and record:

```ts
// constructor gains: private readonly events: OrderEventsService
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';

// at the → PROCESSING branch (order was fetched as `order` with its status):
if (order.status === OrderStatus.PAID) {
  await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.PROCESSING } });
  await this.events.record(
    { orderId: order.id, type: OrderEventType.StatusChanged, fromStatus: OrderStatus.PAID, toStatus: OrderStatus.PROCESSING, meta: { via: 'shipment_created' } },
    tx,
  );
}
```

At the **→ SHIPPED / → DELIVERED** sites in `updateStatus`, the current code selects the shipment without the order's prior status. Read it once before the update so `fromStatus` is accurate:

```ts
// inside updateStatus's transaction, before the branch:
const orderRow = await tx.order.findUnique({ where: { id: shipment.orderId }, select: { status: true } });

if (status === ShipmentStatus.IN_TRANSIT || status === ShipmentStatus.OUT_FOR_DELIVERY) {
  await tx.order.update({ where: { id: shipment.orderId }, data: { status: OrderStatus.SHIPPED } });
  await this.events.record(
    { orderId: shipment.orderId, type: OrderEventType.StatusChanged, fromStatus: orderRow?.status ?? null, toStatus: OrderStatus.SHIPPED, meta: { via: 'shipment_status', shipmentStatus: status } },
    tx,
  );
} else if (status === ShipmentStatus.DELIVERED) {
  await tx.order.update({ where: { id: shipment.orderId }, data: { status: OrderStatus.DELIVERED } });
  await this.events.record(
    { orderId: shipment.orderId, type: OrderEventType.StatusChanged, fromStatus: orderRow?.status ?? null, toStatus: OrderStatus.DELIVERED, meta: { via: 'shipment_status', shipmentStatus: status } },
    tx,
  );
}
```

- [ ] **Step 3: Record events in phonepe.service.ts**

Inject `OrderEventsService`. In `markSuccess`, **after** the `updated.count !== 1` CAS guard and the `tx.order.update(... PAID ...)`, record PENDING→PAID. The payment was loaded with `include: { order: { include: { items: true } } }`, so the prior status is available; if not in scope at the call site, pass `fromStatus: OrderStatus.PENDING` (the CAS on `INITIATED` guarantees the order was PENDING):

```ts
import { OrderEventsService } from '../order-events/order-events.service';
import { OrderEventType } from '../order-events/order-event-types';
// constructor gains: private readonly events: OrderEventsService

// markSuccess, after tx.order.update to PAID:
await this.events.record(
  { orderId, type: OrderEventType.StatusChanged, fromStatus: OrderStatus.PENDING, toStatus: OrderStatus.PAID, meta: { via: 'phonepe_callback' } },
  tx,
);

// markFailed, after tx.order.update to CANCELLED (and before/after the restock loop, same tx):
await this.events.record(
  { orderId, type: OrderEventType.StatusChanged, fromStatus: OrderStatus.PENDING, toStatus: OrderStatus.CANCELLED, note: 'Payment failed', meta: { via: 'phonepe_callback' } },
  tx,
);
```

- [ ] **Step 4: Verify + live smoke**

```bash
cd Backend && npm run typecheck && npm test
```
Then, server running: drive a seeded order through the shipment flow (create shipment → PROCESSING; mark IN_TRANSIT → SHIPPED; mark DELIVERED) as an ADMIN or MANAGER (confirm a MANAGER cookie is now accepted and a STAFF/absent cookie is 401/403). After each transition, `GET /admin/orders/:id` shows a matching `status_changed` event with correct `fromStatus`/`toStatus`. If a PhonePe sandbox callback is reachable, confirm PENDING→PAID records an event too.

- [ ] **Step 5: Commit**

```bash
cd Backend
git add src/modules/phonepe/ src/modules/shipments/
git commit -m "feat(orders): record OrderEvent on phonepe + shipment transitions; align shipments roles to ADMIN/MANAGER"
```

---

## Self-Review

**Spec coverage (spec §5 D1 + supporting sections):**
- `GET /admin/orders` list w/ filters (status, paymentStatus, date range, q), pagination, sort, thin SUMMARY_SELECT → Tasks 2 + 4. ✅
- `GET /admin/orders/:id` full detail (items, customer, address snapshot scalars, totals, payments, shipments+tracking, notes, refunds, events timeline) → Task 4 `DETAIL_INCLUDE`. ✅
- `POST /admin/orders/:id/notes` (+ `note_added` event) → Task 5. ✅
- `POST /admin/orders/:id/cancel` guarded + restock + event → Tasks 1 + 6. ✅ (§2.1 matrix enforced by `assertCancellable`; §2.2 restock via `ORDER_CANCELLED`.)
- `OrderEventsService` + patch phonepe + shipments → Tasks 3 + 7. ✅ (§4)
- `@Roles(ADMIN, MANAGER)` + `AdminAuditInterceptor` on the controller → Task 4. ✅ (§3)
- Align shipments `@Roles` ADMIN,STAFF → ADMIN,MANAGER → Task 7. ✅ (§3)
- **Out of scope, correctly absent:** refunds/PhonePe refund API (D1b), GST invoice + invoice sequence (D3), OrderItem HSN snapshot (§8 prereq, D3), StoreSettings GSTIN (§8, D3). ✅

**Placeholder scan:** No TBD/TODO/"handle edge cases" — every code step carries real code and exact commands. ✅

**Type consistency:** `toOrderSummary`/`OrderSummaryRow` payment shape (`payments: {status}[]`) matches `SUMMARY_SELECT` (`payments: { select: { status }, take: 1 }`). `RecordOrderEventInput` used identically in Tasks 3/5/6/7. `AdminOrderSort` defined in Task 2, imported by Task 4's DTO. `assertCancellable(OrderStatus)` signature consistent Tasks 1↔6. `InventoryService.adjust` call shape matches the recon'd signature (`{productId, delta, reason, actorId?, reference?, tx?}`). `user.fullName` (not `name`) in `DETAIL_INCLUDE`. ✅

**Known follow-through (not gaps):** Task 6 asserts `InventoryModule` exports `InventoryService`; Task 7 assumes `OrderEventsModule` `@Global` reach into phonepe/shipments (no per-module import). Both are called out inline so the implementer verifies rather than assumes.
