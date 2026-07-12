import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RazorpayService } from './razorpay.service';
import { InitiateRazorpayDto } from './dto/razorpay.dto';
import { Public } from '../../common/decorators/public.decorator';
import { SESSION_COOKIE } from '../../common/auth/auth-types';
import { WebhookEventsService } from '../../common/security/webhook-events.service';
import { parseWebhookEnvelope } from './razorpay-webhook-router';

@Controller('razorpay')
export class RazorpayController {
  // Explicit tokens: the integration harness runs under tsx (esbuild), which
  // applies decorators but does NOT emit design:paramtypes — implicit
  // constructor injection would resolve to undefined there. Compiled builds
  // are unaffected either way.
  constructor(
    @Inject(RazorpayService) private readonly razorpay: RazorpayService,
    @Inject(WebhookEventsService) private readonly webhooks: WebhookEventsService,
  ) {}

  /**
   * Option-A ownership (plan §1.2, approved): @Public so guests can pay —
   * the service accepts the JWT owner OR the guest whose wh_sid session
   * matches the order's cartSessionId, and 404s everyone else. The amount is
   * derived from the order server-side; 10 inits / 10 min keeps card-testing
   * rings off the endpoint (same budget as the PhonePe era).
   */
  @Public()
  @Throttle({ default: { ttl: 10 * 60 * 1000, limit: 10 } })
  @Post('initiate')
  initiate(@Body() dto: InitiateRazorpayDto, @Req() req: Request) {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    const userId = req.user?.sub;
    if (!userId && !sessionId) throw new BadRequestException('No session');
    return this.razorpay.initiate({ orderNumber: dto.orderNumber, userId, sessionId });
  }

  /**
   * Webhook SHELL (Phase 3): verify + claim + ack ONLY — settlement lands in
   * Phase 4. Public; authenticated by X-Razorpay-Signature over the RAW
   * request bytes (express.raw mounted in app.setup.ts — see
   * RAZORPAY_WEBHOOK_RAW_PATH for the lockstep warning). Claimed events stay
   * processed=false so Phase 4's processor and the Phase 6 sweeps pick them
   * up. Generous throttle: the signature is the real auth; 300/min is DoS
   * hygiene that never 429s a legitimate provider retry burst.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    if (!signature) throw new BadRequestException('Missing signature');

    // express.raw() leaves req.body as a Buffer for this route.
    const raw = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : typeof req.body === 'string'
        ? req.body
        : '';
    if (!raw) throw new BadRequestException('Missing body');

    if (!this.razorpay.verifyWebhook(raw, signature)) {
      throw new BadRequestException('Signature mismatch');
    }

    let payload: unknown = {};
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new BadRequestException('Invalid webhook body');
    }
    const parsed = parseWebhookEnvelope(payload);

    // Claim for at-most-once processing. Key = the provider event id (unique
    // per event; retries redeliver the same id); the sha256(rawBody) fallback
    // inside record() covers a missing header.
    const claim = await this.webhooks.record({
      provider: 'razorpay',
      eventType: parsed.kind === 'unknown' ? (parsed.event ?? 'unknown') : parsed.event,
      idempotencyKey: eventId ? `razorpay:${eventId}` : undefined,
      signature,
      rawBody: raw,
      payload: payload as never,
    });

    // Phase 4 replaces this ack-only tail with persist-then-ack settlement.
    return { received: true, duplicate: !claim.shouldProcess };
  }
}
