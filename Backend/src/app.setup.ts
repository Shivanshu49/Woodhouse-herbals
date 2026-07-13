import { Reflector } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { env } from './common/config/env';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { SecurityLoggerInterceptor } from './common/security/security-logger.interceptor';

/**
 * The raw-body webhook route. ⚠ This literal and the RazorpayController
 * route (`@Controller('razorpay')` + `@Post('webhook')` under the global
 * 'api' prefix) MUST stay in lockstep — if they diverge, the global JSON
 * parser consumes the webhook body first, signature verification sees
 * re-serialised bytes, and every delivery 400s. The integration test
 * razorpay-webhook.integration.test.ts fails on any divergence; change
 * either side only with that test in front of you.
 */
export const RAZORPAY_WEBHOOK_RAW_PATH = '/api/razorpay/webhook';

/**
 * Full HTTP configuration, extracted from bootstrap so the integration
 * harness boots THE REAL wiring (raw-body mounts, parser ordering, prefix,
 * guards) instead of a lookalike. main.ts calls this once before listen();
 * tests call it on a Test.createTestingModule app.
 *
 * Ordering in here is load-bearing: express.raw for the webhook must be
 * mounted BEFORE express.json so the payment-webhook body is not consumed
 * by the global JSON parser (Razorpay signs the raw bytes — "Do not parse
 * or cast the webhook request body").
 */
export function configureApp(app: INestApplication): void {
  const expressApp = app.getHttpAdapter().getInstance() as express.Application;

  // ── Request body limits ─────────────────────────────────────────
  // 256 kb covers all current commerce payloads and blocks accidental DoS.
  expressApp.use(RAZORPAY_WEBHOOK_RAW_PATH, express.raw({ type: 'application/json', limit: '64kb' }));
  expressApp.use(express.json({ limit: '256kb' }));
  expressApp.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // Trusted proxy hop count for accurate client IPs (rate-limit / audit).
  // ⚠ Deploy target is Coolify/Traefik on a Hostinger KVM VPS — NOT Railway,
  // which the original hop analysis assumed. Verify the value empirically at
  // cutover on that topology (see env.ts TRUST_PROXY_HOPS).
  expressApp.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.setGlobalPrefix('api');
  app.use(cookieParser());

  // ── Security headers ────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", ...env.WEB_ORIGIN.split(',')],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
          upgradeInsecureRequests: env.NODE_ENV === 'production' ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts:
        env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // ── CORS: strict allow-list ─────────────────────────────────────
  const allowedOrigins = new Set(env.WEB_ORIGIN.split(',').map((o) => o.trim()));
  app.enableCors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin / health probes
      if (allowedOrigins.has(origin)) return cb(null, true);
      cb(new Error(`Origin ${origin} not permitted`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Idempotency-Key: POST /orders reads it (orders.controller.ts) so a retry
    // replays the same order. The storefront↔api split is cross-origin, so a
    // custom header triggers a preflight that must allow it, or the POST fails.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
    maxAge: 600,
  });

  // Hide implementation detail.
  expressApp.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader('X-Powered-By');
    next();
  });

  // ── Strict validation ──────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: env.NODE_ENV === 'production',
    }),
  );

  // ── Default-secure: every endpoint requires auth unless @Public() ──
  const reflector = app.get(Reflector);
  const jwt = app.get(JwtService);
  app.useGlobalGuards(new JwtAuthGuard(reflector, jwt), new RolesGuard(reflector));

  // ── Structured security/request logging ───────────────────────
  app.useGlobalInterceptors(new SecurityLoggerInterceptor());
}
