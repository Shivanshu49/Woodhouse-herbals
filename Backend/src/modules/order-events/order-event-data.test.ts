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
