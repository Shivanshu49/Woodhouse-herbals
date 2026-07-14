/**
 * Contract test: the production start script must be self-arming.
 *
 * The DB-invariant boot gate (common/db/required-partial-indexes.ts) only
 * ENFORCES (process.exit(1)) when NODE_ENV=production — otherwise it warns
 * and continues. If start:prod relied on the deploy environment to set
 * NODE_ENV, a single forgotten env var on a fresh host (exactly the
 * rebuild-env-from-scratch Coolify scenario) would silently downgrade the
 * double-payout guard to a log line. The script therefore pins NODE_ENV
 * itself; this test makes that pin un-removable.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};

test('start:prod pins NODE_ENV=production inline (gate enforcement must not depend on deploy env)', () => {
  const script = pkg.scripts['start:prod'];
  assert.ok(script, 'start:prod script must exist');
  assert.match(
    script!,
    /(^|\s)NODE_ENV=production\s/,
    'start:prod must set NODE_ENV=production itself — the boot gate only enforces in production mode',
  );
});

test('start:prod targets the real build entry (dist/src/main.js, not dist/main.js)', () => {
  // nest build emits dist/src/main.js because tsconfig includes two roots
  // (src + prisma); dist/main.js was the historical MODULE_NOT_FOUND bug.
  assert.match(pkg.scripts['start:prod']!, /node dist\/src\/main\.js/);
});
