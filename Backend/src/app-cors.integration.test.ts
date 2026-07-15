/**
 * Integration test: the CORS preflight for POST /api/orders must allow the
 * `Idempotency-Key` request header.
 *
 * The storefront↔api split is cross-origin, so a POST /orders carrying
 * `Idempotency-Key` (orders.controller.ts — a stable key so a retry replays the
 * same order instead of creating a second) triggers a browser preflight. If the
 * header isn't in the CORS allow-list, the browser blocks the POST before it
 * ever reaches the server — a money-adjacent latent bug. This boots the REAL
 * app wiring (AppModule + configureApp — the same enableCors main.ts applies).
 *
 * No DB: NODE_ENV=test makes the DB-invariant gate warn instead of exit and
 * PrismaService swallows the connect failure; CORS preflight is handled by the
 * cors middleware before any guard or route, so no auth/DB is exercised.
 *
 * Run: npx tsx --test src/app-cors.integration.test.ts
 */

// Env fixture MUST precede any app import — the env proxy validates the whole
// schema on first read.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://nobody:nope@localhost:59999/absent';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
process.env.RAZORPAY_KEY_ID = 'rzp_test_keyid';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_integration';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.ADMIN_ORIGIN = 'http://localhost:3001';

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { resetEnvCacheForTests } from './common/config/env';

const ORIGIN = 'http://localhost:3000';
const ADMIN_ORIGIN = 'http://localhost:3001';
let app: INestApplication;

before(async () => {
  resetEnvCacheForTests();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
});

after(async () => {
  await app?.close();
  resetEnvCacheForTests();
});

test('preflight for POST /api/orders allows the Idempotency-Key header', async () => {
  const res = await request(app.getHttpServer())
    .options('/api/orders')
    .set('Origin', ORIGIN)
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'idempotency-key, content-type');

  // The cors middleware answers the preflight directly (204) with the allow-list.
  assert.ok(res.status === 204 || res.status === 200, `preflight status was ${res.status}`);
  const allowedHeaders = (res.headers['access-control-allow-headers'] || '').toLowerCase();
  assert.ok(
    allowedHeaders.includes('idempotency-key'),
    `Idempotency-Key not allowed: "${res.headers['access-control-allow-headers']}"`,
  );
  // credentials:true → the specific origin is echoed, never "*".
  assert.equal(res.headers['access-control-allow-origin'], ORIGIN);
});

test('a disallowed origin is not granted CORS access', async () => {
  const res = await request(app.getHttpServer())
    .options('/api/orders')
    .set('Origin', 'https://evil.example')
    .set('Access-Control-Request-Method', 'POST')
    .set('Access-Control-Request-Headers', 'idempotency-key');

  // The strict origin callback rejects: no allow-origin header is echoed back.
  assert.notEqual(res.headers['access-control-allow-origin'], 'https://evil.example');
});

test('CSP connect-src and CORS both include the independently configured admin origin', async () => {
  const res = await request(app.getHttpServer())
    .get('/api/health')
    .set('Origin', ADMIN_ORIGIN);

  assert.equal(res.status, 200);
  assert.equal(res.headers['access-control-allow-origin'], ADMIN_ORIGIN);
  const csp = res.headers['content-security-policy'] || '';
  assert.match(csp, new RegExp(`connect-src[^;]*${ADMIN_ORIGIN.replaceAll('.', '\\.')}`));
});
