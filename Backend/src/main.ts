import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { loadEnv, env } from './common/config/env';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { SecurityLoggerInterceptor } from './common/security/security-logger.interceptor';

async function bootstrap() {
  loadEnv(); // Fail fast on bad / missing secrets.

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = new Logger('Bootstrap');

  // ── Request body limits ─────────────────────────────────────────
  // 256 kb covers all current commerce payloads and blocks accidental DoS.
  const expressApp = app.getHttpAdapter().getInstance() as express.Application;

  // PhonePe webhook needs the *raw* request bytes for HMAC verification.
  // express.raw must be mounted BEFORE express.json so the global JSON
  // parser does not consume the payment-callback body first.
  expressApp.use(
    '/api/phonepe/callback',
    express.raw({ type: 'application/json', limit: '64kb' }),
  );
  expressApp.use(express.json({ limit: '256kb' }));
  expressApp.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // Required for accurate client IP behind load balancers (rate-limit / audit).
  expressApp.set('trust proxy', 1);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');
  logger.log(`Wood House API running on http://localhost:${env.PORT}/api`);
}

void bootstrap();
