/**
 * First-admin provisioning — run once per environment:
 *
 *   ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD='...' npm run admin:create
 *
 * Idempotent: an existing user with that email is PROMOTED to ADMIN (and
 * marked email-verified) but their password is never overwritten. Never
 * bake credentials into the repo or .env files.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword, validatePasswordStrength } from '../src/common/utils/passwords';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME ?? 'Store Owner';

  if (!email || !password) {
    console.error('Usage: ADMIN_EMAIL=owner@example.com ADMIN_PASSWORD=... npm run admin:create');
    process.exit(1);
  }

  const errors = validatePasswordStrength(password);
  if (errors.length) {
    console.error('✖ Password rejected:');
    for (const e of errors) console.error(`  • ${e}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const user = await prisma.user.upsert({
    where: { email },
    // Existing account: promote + verify, but never overwrite the password.
    update: { role: 'ADMIN', emailVerified: true, emailVerifiedAt: now, deletedAt: null },
    create: {
      email,
      passwordHash,
      fullName,
      role: 'ADMIN',
      emailVerified: true,
      emailVerifiedAt: now,
      passwordChangedAt: now,
    },
    select: { id: true, email: true, role: true },
  });
  console.log(`✔ Admin ready: ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
