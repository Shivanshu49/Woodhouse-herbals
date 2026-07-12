import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadEnv, env } from './common/config/env';
import { PrismaService } from './common/prisma/prisma.service';
import { assertRequiredPartialIndexes } from './common/db/required-partial-indexes';
import { configureApp } from './app.setup';

async function bootstrap() {
  loadEnv(); // Fail fast on bad / missing secrets.

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = new Logger('Bootstrap');

  // ── DB invariant gate ───────────────────────────────────────────
  // The money-critical partial unique indexes (e.g. the refund
  // double-payout guard) exist ONLY as raw migration SQL — Prisma 5
  // cannot express them in schema.prisma, so nothing else defends them.
  // Production refuses to serve traffic without them; dev warns.
  await assertRequiredPartialIndexes(app.get(PrismaService));

  // All HTTP wiring (raw-body mounts, parser ordering, prefix, security
  // headers, CORS, pipes, guards) lives in app.setup.ts so the integration
  // harness boots the REAL configuration, not a lookalike.
  configureApp(app);

  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`Wood House API running on http://localhost:${env.PORT}/api`);
}

void bootstrap();
