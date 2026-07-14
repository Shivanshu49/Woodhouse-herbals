/**
 * L9 — the public, unauthenticated /api/health status must not disclose the app
 * version or uptime (a fingerprinting / deploy-recency signal).
 *
 * Run: npx tsx --test src/common/health/health.controller.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { HealthController } from './health.controller';

test('public /health status omits version and uptime', () => {
  const controller = new HealthController({} as any);
  const body = controller.status() as Record<string, unknown>;
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'woodhouse-api');
  assert.equal('version' in body, false, 'version must not be disclosed');
  assert.equal('uptimeSeconds' in body, false, 'uptime must not be disclosed');
});
