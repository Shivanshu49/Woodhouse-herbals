/**
 * The client IP that keys the login backoff (M1) and audit trail must be the
 * framework-resolved req.ip — which Express derives from X-Forwarded-For while
 * honouring the configured `trust proxy` hop count — NOT the leftmost XFF
 * entry, which the client controls and can spoof.
 *
 * Run: npx tsx --test src/modules/auth/extract-client-ip.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { extractClientIp } from './auth.controller';

test('extractClientIp returns the trusted req.ip and ignores a spoofed X-Forwarded-For', () => {
  const req = {
    ip: '9.9.9.9', // Express resolved this from XFF per `trust proxy`
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }, // attacker-prepended
    socket: { remoteAddress: '10.0.0.1' },
  } as unknown as Request;
  assert.equal(extractClientIp(req), '9.9.9.9');
});

test('extractClientIp falls back to the socket address when req.ip is absent', () => {
  const req = {
    headers: {},
    socket: { remoteAddress: '10.0.0.5' },
  } as unknown as Request;
  assert.equal(extractClientIp(req), '10.0.0.5');
});
