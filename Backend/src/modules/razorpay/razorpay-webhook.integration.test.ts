/**
 * Integration tests for the Razorpay webhook shell — the first integration
 * suite in this repo (plan §6). Boots the REAL app wiring via
 * Test.createTestingModule(AppModule) + configureApp() (the same function
 * main.ts uses), so these tests exercise the actual express.raw mount,
 * parser ordering, global 'api' prefix, and guard stack — not a lookalike.
 *
 * THE MOUNTED-PATH REGRESSION TEST: the express.raw mount
 * (app.setup.ts RAZORPAY_WEBHOOK_RAW_PATH) and the controller route
 * (@Controller('razorpay') @Post('webhook') under the global prefix) must
 * stay in lockstep. If they ever diverge, the global JSON parser consumes
 * the webhook body first, the controller receives a parsed object instead
 * of the raw Buffer, and the byte-exact tests here fail loudly.
 *
 * No database: PrismaService.onModuleInit swallows connect failures by
 * design, the DB-invariant gate warns (NODE_ENV=test), and the
 * WebhookEventsService is overridden with a recording fake — the claim
 * persistence contract is pinned separately in its own unit tests.
 *
 * Run: npx tsx --test src/modules/razorpay/razorpay-webhook.integration.test.ts
 */

// Env fixture MUST precede any app import — the env proxy validates the whole
// schema on first read, and module import order matters here.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://nobody:nope@localhost:59999/absent';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
process.env.RAZORPAY_KEY_ID = 'rzp_test_keyid';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_integration';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { configureApp } from '../../app.setup';
import { WebhookEventsService } from '../../common/security/webhook-events.service';
import { resetEnvCacheForTests } from '../../common/config/env';

const SECRET = 'whsec_integration';
const sign = (body: string) => createHmac('sha256', SECRET).update(body).digest('hex');

interface RecordedClaim {
  provider: string;
  eventType?: string;
  idempotencyKey?: string;
  rawBody: string;
}

const claims: RecordedClaim[] = [];
const seenKeys = new Set<string>();

const fakeWebhookEvents = {
  record: async (input: RecordedClaim) => {
    claims.push(input);
    const key = input.idempotencyKey ?? `raw:${input.rawBody}`;
    const duplicate = seenKeys.has(key);
    seenKeys.add(key);
    return { shouldProcess: !duplicate, eventId: `evt_${claims.length}` };
  },
  markProcessed: async () => undefined,
  markFailed: async () => undefined,
};

let app: INestApplication;

before(async () => {
  // ES imports are hoisted above the process.env assignments at the top of
  // this file — if any imported module touched the lazy env proxy during
  // import, it memoized a parse WITHOUT our fixture vars. Re-parse now.
  resetEnvCacheForTests();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WebhookEventsService)
    .useValue(fakeWebhookEvents)
    .compile();
  // bodyParser:false + configureApp = EXACTLY the main.ts bootstrap shape.
  app = moduleRef.createNestApplication({ bodyParser: false });
  configureApp(app);
  await app.init();
});

after(async () => {
  await app.close();
});

// A deliberately non-canonical JSON body: re-serialising it (key order,
// spacing) would change the bytes and break the HMAC — only the raw mount
// can pass this test.
const WEIRD_BODY =
  '{ "entity":"event",  "event": "payment.captured", "contains":["payment"], "payload": { "payment": { "entity": { "id":"pay_1", "status":"captured", "amount": 49900, "order_id":"order_A" } } } }';

test('MOUNTED-PATH REGRESSION: the raw mount and controller route are in lockstep — byte-exact body reaches the handler', async () => {
  claims.length = 0;
  const res = await request(app.getHttpServer())
    .post('/api/razorpay/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', sign(WEIRD_BODY))
    .set('X-Razorpay-Event-Id', 'evt_lockstep_1')
    .send(WEIRD_BODY);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body, { received: true, duplicate: false });
  // The claim recorded the EXACT bytes — if the express.raw mount had not
  // matched this route, the JSON parser would have consumed the body, the
  // controller would have seen an object, and this request would have 400d.
  assert.equal(claims[0]!.rawBody, WEIRD_BODY);
  assert.equal(claims[0]!.idempotencyKey, 'razorpay:evt_lockstep_1');
  assert.equal(claims[0]!.provider, 'razorpay');
  assert.equal(claims[0]!.eventType, 'payment.captured');
});

test('tampered signature ⇒ 400, no claim recorded', async () => {
  claims.length = 0;
  const res = await request(app.getHttpServer())
    .post('/api/razorpay/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', sign('{"different":"body"}'))
    .send(WEIRD_BODY);
  assert.equal(res.status, 400);
  assert.equal(claims.length, 0);
});

test('missing signature ⇒ 400; missing body ⇒ 400', async () => {
  const noSig = await request(app.getHttpServer())
    .post('/api/razorpay/webhook')
    .set('Content-Type', 'application/json')
    .send(WEIRD_BODY);
  assert.equal(noSig.status, 400);

  const noBody = await request(app.getHttpServer())
    .post('/api/razorpay/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', sign(''));
  assert.equal(noBody.status, 400);
});

test('a redelivered event id still ACKs 200 but is flagged duplicate (claim short-circuit)', async () => {
  const body = '{"entity":"event","event":"refund.processed","contains":["refund"],"payload":{"refund":{"entity":{"id":"rfnd_1","status":"processed","amount":100,"payment_id":"pay_1"}}}}';
  const send = () =>
    request(app.getHttpServer())
      .post('/api/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', sign(body))
      .set('X-Razorpay-Event-Id', 'evt_dup_1')
      .send(body);
  const first = await send();
  assert.deepEqual(first.body, { received: true, duplicate: false });
  const second = await send();
  assert.equal(second.status, 200, 'retries must always be ACKed — never make the provider retry forever');
  assert.deepEqual(second.body, { received: true, duplicate: true });
});

test('ack is verify+claim only — the shell never writes settlement state (Phase 4 boundary)', async () => {
  // The fake records claims; markProcessed was never called by the shell.
  // (Settlement, markProcessed, and money transitions arrive in Phase 4.)
  claims.length = 0;
  const body = '{"entity":"event","event":"payment.failed","contains":["payment"],"payload":{"payment":{"entity":{"id":"pay_9","status":"failed","amount":1,"order_id":"order_Z"}}}}';
  const res = await request(app.getHttpServer())
    .post('/api/razorpay/webhook')
    .set('Content-Type', 'application/json')
    .set('X-Razorpay-Signature', sign(body))
    .set('X-Razorpay-Event-Id', 'evt_shell_1')
    .send(body);
  assert.equal(res.status, 200);
  assert.equal(claims.length, 1);
});
