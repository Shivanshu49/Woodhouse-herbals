import test from 'node:test';
import assert from 'node:assert/strict';
import { LoginBackoff, type LoginBackoffConfig } from './login-backoff';

const cfg: LoginBackoffConfig = {
  freeAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  idleResetMs: 300_000,
};

test('the first `freeAttempts` failures from an IP are not blocked', () => {
  const b = new LoginBackoff(cfg);
  const t = 1_000_000;
  for (let i = 0; i < cfg.freeAttempts; i++) {
    assert.equal(b.registerFailure('1.1.1.1', t).blocked, false);
  }
  assert.equal(b.peek('1.1.1.1', t).blocked, false);
});

test('the failure past the free allowance blocks the IP with a positive backoff', () => {
  const b = new LoginBackoff(cfg);
  const t = 1_000_000;
  for (let i = 0; i < cfg.freeAttempts; i++) b.registerFailure('1.1.1.1', t);
  const d = b.registerFailure('1.1.1.1', t); // one past the allowance
  assert.equal(d.blocked, true);
  assert.ok(d.retryAfterMs > 0);
  assert.equal(b.peek('1.1.1.1', t).blocked, true);
});

test('backoff grows exponentially and is capped at maxDelayMs', () => {
  const b = new LoginBackoff({ freeAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 8_000, idleResetMs: 300_000 });
  const t = 0;
  for (let i = 0; i < 3; i++) b.registerFailure('9.9.9.9', t); // exhaust the free allowance
  const delays: number[] = [];
  for (let i = 0; i < 6; i++) delays.push(b.registerFailure('9.9.9.9', t).retryAfterMs);
  assert.deepEqual(delays.slice(0, 4), [1_000, 2_000, 4_000, 8_000]);
  assert.ok(delays.every((d) => d <= 8_000));
});

test('DoS FIX: an attacker flooding one IP never blocks a different (victim) IP', () => {
  const b = new LoginBackoff(cfg);
  const t = 500;
  for (let i = 0; i < 50; i++) b.registerFailure('203.0.113.7', t); // attacker
  assert.equal(b.peek('203.0.113.7', t).blocked, true, 'attacker IP is blocked');
  assert.equal(b.peek('198.51.100.9', t).blocked, false, 'victim IP is untouched');
});

test('a correct login auto-unlocks the IP (registerSuccess clears the counter)', () => {
  const b = new LoginBackoff(cfg);
  const t = 10;
  for (let i = 0; i <= cfg.freeAttempts; i++) b.registerFailure('1.2.3.4', t);
  assert.equal(b.peek('1.2.3.4', t).blocked, true);
  b.registerSuccess('1.2.3.4');
  assert.equal(b.peek('1.2.3.4', t).blocked, false, 'unblocked immediately after success');
  // counter reset — the next failure starts from the free allowance again
  assert.equal(b.registerFailure('1.2.3.4', t).blocked, false);
});

test('the block lifts once retryAfterMs has elapsed', () => {
  const b = new LoginBackoff(cfg);
  const t = 0;
  for (let i = 0; i <= cfg.freeAttempts; i++) b.registerFailure('7.7.7.7', t);
  const { retryAfterMs } = b.peek('7.7.7.7', t);
  assert.ok(retryAfterMs > 0);
  assert.equal(b.peek('7.7.7.7', t + retryAfterMs).blocked, false);
});

test('an idle IP is forgotten after idleResetMs', () => {
  const b = new LoginBackoff(cfg);
  const t = 0;
  for (let i = 0; i <= cfg.freeAttempts; i++) b.registerFailure('5.5.5.5', t);
  assert.equal(b.peek('5.5.5.5', t).blocked, true);
  // long idle → counter forgotten, so a fresh failure is within the free allowance
  assert.equal(b.registerFailure('5.5.5.5', t + cfg.idleResetMs + 1).blocked, false);
});

test('a missing IP is never blocked (fail-open — the account is never locked either)', () => {
  const b = new LoginBackoff(cfg);
  for (let i = 0; i < 50; i++) b.registerFailure(undefined, 0);
  assert.equal(b.peek(undefined, 0).blocked, false);
});
