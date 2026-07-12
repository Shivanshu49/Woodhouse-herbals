/**
 * Pinning tests for the webhook idempotency store (Razorpay migration Phase 0).
 *
 * WebhookEventsService is the at-most-once backbone shared by every provider
 * webhook — it survives the PhonePe→Razorpay swap unchanged, so its exact
 * behavior is pinned here BEFORE any provider code moves. If a later change
 * breaks these, it is breaking settlement idempotency, not "just a test".
 *
 * Run: npx tsx --test src/common/security/webhook-events.service.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { WebhookEventsService } from './webhook-events.service';

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

interface FakeCalls {
  creates: unknown[];
  updates: unknown[];
  findUniques: unknown[];
}

/** Minimal PrismaService stand-in: only the webhookEvent delegate. */
function makeService(overrides: {
  create?: (args: never) => unknown;
  findUnique?: (args: never) => unknown;
  update?: (args: never) => unknown;
}): { svc: WebhookEventsService; calls: FakeCalls } {
  const calls: FakeCalls = { creates: [], updates: [], findUniques: [] };
  const prisma = {
    webhookEvent: {
      create: async (args: never) => {
        calls.creates.push(args);
        return overrides.create
          ? overrides.create(args)
          : { id: 'evt_new', processed: false };
      },
      findUnique: async (args: never) => {
        calls.findUniques.push(args);
        return overrides.findUnique ? overrides.findUnique(args) : null;
      },
      update: async (args: never) => {
        calls.updates.push(args);
        return overrides.update ? overrides.update(args) : {};
      },
    },
  };
  return { svc: new WebhookEventsService(prisma as never), calls };
}

const BASE_INPUT = {
  provider: 'phonepe',
  eventType: 'payment.completed',
  rawBody: '{"response":"abc"}',
  payload: { state: 'COMPLETED' } as never,
};

test('record: fresh event is claimed with shouldProcess=true and the created id', async () => {
  const { svc, calls } = makeService({});
  const claim = await svc.record({ ...BASE_INPUT, idempotencyKey: 'phonepe:TXN1' });
  assert.deepEqual(claim, { shouldProcess: true, eventId: 'evt_new' });
  assert.equal(calls.creates.length, 1);
  const data = (calls.creates[0] as { data: Record<string, unknown> }).data;
  assert.equal(data.idempotencyKey, 'phonepe:TXN1');
  assert.equal(data.provider, 'phonepe');
  assert.equal(data.eventType, 'payment.completed');
});

test('record: without an explicit key, falls back to sha256(provider:rawBody)', async () => {
  const { svc, calls } = makeService({});
  await svc.record({ ...BASE_INPUT });
  const expected = createHash('sha256')
    .update(`${BASE_INPUT.provider}:${BASE_INPUT.rawBody}`)
    .digest('hex');
  const data = (calls.creates[0] as { data: Record<string, unknown> }).data;
  assert.equal(data.idempotencyKey, expected);
});

test('record: P2002 duplicate of an UNPROCESSED event re-claims (shouldProcess=true)', async () => {
  const { svc } = makeService({
    create: () => {
      throw p2002();
    },
    findUnique: () => ({ id: 'evt_prior', processed: false }),
  });
  const claim = await svc.record({ ...BASE_INPUT, idempotencyKey: 'k' });
  assert.deepEqual(claim, { shouldProcess: true, eventId: 'evt_prior' });
});

test('record: P2002 duplicate of a PROCESSED event short-circuits (shouldProcess=false)', async () => {
  const { svc } = makeService({
    create: () => {
      throw p2002();
    },
    findUnique: () => ({ id: 'evt_prior', processed: true }),
  });
  const claim = await svc.record({ ...BASE_INPUT, idempotencyKey: 'k' });
  assert.deepEqual(claim, { shouldProcess: false, eventId: 'evt_prior' });
});

test('record: a KEYLESS duplicate is looked up by the DERIVED sha256 key', async () => {
  // The fallback-key path must use the same derived key for the duplicate
  // lookup that the insert used — a lookup by the (undefined) input key
  // would crash on every retried keyless webhook.
  const { svc, calls } = makeService({
    create: () => {
      throw p2002();
    },
    findUnique: () => ({ id: 'evt_prior', processed: true }),
  });
  const claim = await svc.record({ ...BASE_INPUT });
  const derived = createHash('sha256')
    .update(`${BASE_INPUT.provider}:${BASE_INPUT.rawBody}`)
    .digest('hex');
  const lookup = calls.findUniques[0] as { where: { idempotencyKey: string } };
  assert.equal(lookup.where.idempotencyKey, derived);
  assert.deepEqual(claim, { shouldProcess: false, eventId: 'evt_prior' });
});

test('record: P2002 with a vanished row rethrows (no silent claim)', async () => {
  const { svc } = makeService({
    create: () => {
      throw p2002();
    },
    findUnique: () => null,
  });
  await assert.rejects(() => svc.record({ ...BASE_INPUT, idempotencyKey: 'k' }), {
    code: 'P2002',
  });
});

test('record: non-P2002 errors propagate untouched', async () => {
  const boom = new Error('connection reset');
  const { svc } = makeService({
    create: () => {
      throw boom;
    },
  });
  await assert.rejects(() => svc.record({ ...BASE_INPUT }), boom);
});

test('markProcessed: flips processed with a timestamp and clears error', async () => {
  const { svc, calls } = makeService({});
  await svc.markProcessed('evt_1');
  assert.equal(calls.updates.length, 1);
  const args = calls.updates[0] as {
    where: { id: string };
    data: { processed: boolean; processedAt: Date; error: null };
  };
  assert.equal(args.where.id, 'evt_1');
  assert.equal(args.data.processed, true);
  assert.ok(args.data.processedAt instanceof Date);
  assert.equal(args.data.error, null);
});

test('markFailed: records the error truncated to 1000 chars, does NOT flip processed', async () => {
  const { svc, calls } = makeService({});
  await svc.markFailed('evt_2', new Error('x'.repeat(2000)));
  const args = calls.updates[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(args.where.id, 'evt_2');
  assert.equal((args.data.error as string).length, 1000);
  // The claim must stay re-processable: markFailed never sets processed.
  assert.equal('processed' in args.data, false);
});
