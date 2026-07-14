/**
 * Attacker-scoped (per-IP) progressive login backoff.
 *
 * Replaces the previous victim-keyed hard account lock. That lock let an
 * unauthenticated attacker lock any KNOWN email out of their own account by
 * submitting a handful of wrong passwords (a targeted DoS — the lock was
 * keyed on the target account, so the real owner was refused even with the
 * correct password). Here, failures are attributed to the CLIENT IP and
 * never to the target account:
 *
 *   - The real owner, on a different IP, is never affected by an attacker's
 *     failures — there is no account-level lock to trip.
 *   - A successful login clears the IP's counter (auto-unlock).
 *   - Repeated failures from one IP earn an exponentially growing delay,
 *     capped, so online password-guessing stays expensive.
 *
 * State is in-memory and per-process — the same trust model as the app's
 * @nestjs/throttler baseline. `now` is passed in so the policy is a pure,
 * deterministic function of (attempts, time) and unit-testable without
 * fake timers.
 */

export interface LoginBackoffConfig {
  /** Failed attempts an IP gets for free before any delay applies. */
  freeAttempts: number;
  /** Delay applied on the first failure past the free allowance (ms). */
  baseDelayMs: number;
  /** Upper bound on any single backoff delay (ms). */
  maxDelayMs: number;
  /** Idle period after which an untouched IP's counter is forgotten (ms). */
  idleResetMs: number;
}

export interface BackoffDecision {
  /** True when the caller should be refused before any password work. */
  blocked: boolean;
  /** Milliseconds until the IP may try again (0 when not blocked). */
  retryAfterMs: number;
}

interface IpEntry {
  failures: number;
  blockedUntil: number; // epoch ms; 0 = never blocked
  lastSeen: number; // epoch ms
}

const NOT_BLOCKED: BackoffDecision = { blocked: false, retryAfterMs: 0 };

// Sweep stale entries only once the map is large, so a rotating-IP flood
// cannot grow it without bound while normal traffic pays nothing.
const SWEEP_THRESHOLD = 10_000;

export class LoginBackoff {
  private readonly ipState = new Map<string, IpEntry>();

  constructor(private readonly cfg: LoginBackoffConfig) {}

  /** Read-only gate, evaluated before doing any password work. */
  peek(ip: string | undefined, now: number): BackoffDecision {
    if (!ip) return NOT_BLOCKED;
    const e = this.ipState.get(ip);
    if (!e || now >= e.blockedUntil) return NOT_BLOCKED;
    return { blocked: true, retryAfterMs: e.blockedUntil - now };
  }

  /** Record a failed attempt from this IP and return the resulting gate. */
  registerFailure(ip: string | undefined, now: number): BackoffDecision {
    if (!ip) return NOT_BLOCKED;
    this.maybeSweep(now);

    let e = this.ipState.get(ip);
    if (!e || now - e.lastSeen > this.cfg.idleResetMs) {
      e = { failures: 0, blockedUntil: 0, lastSeen: now };
    }
    e.failures += 1;
    e.lastSeen = now;

    const over = e.failures - this.cfg.freeAttempts;
    e.blockedUntil =
      over > 0 ? now + Math.min(this.cfg.baseDelayMs * 2 ** (over - 1), this.cfg.maxDelayMs) : 0;

    this.ipState.set(ip, e);
    return e.blockedUntil > now
      ? { blocked: true, retryAfterMs: e.blockedUntil - now }
      : NOT_BLOCKED;
  }

  /** A correct login clears the IP's counter — the auto-unlock. */
  registerSuccess(ip: string | undefined): void {
    if (ip) this.ipState.delete(ip);
  }

  private maybeSweep(now: number): void {
    if (this.ipState.size < SWEEP_THRESHOLD) return;
    for (const [k, v] of this.ipState) {
      if (now - v.lastSeen > this.cfg.idleResetMs) this.ipState.delete(k);
    }
  }
}
