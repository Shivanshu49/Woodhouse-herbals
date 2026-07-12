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
import { RazorpaySettlementService } from './razorpay-settlement.service';
import { InitiateRazorpayDto, VerifyRazorpayDto } from './dto/razorpay.dto';
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
    @Inject(RazorpaySettlementService) private readonly settlement: RazorpaySettlementService,
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
   * Webhook — PERSIST-THEN-ACK (plan §1.1[5]): verify → claim → respond 200
   * → settle ASYNCHRONOUSLY. Razorpay marks a delivery failed after FIVE
   * seconds; our settle transactions may run up to ADMIN_WRITE_TX_TIMEOUT_MS
   * (20s), so inline settlement could time out and trigger spurious retries.
   * A crash between ack and settle leaves the claim processed=false — the
   * Phase 6 sweeps re-derive state from the provider (payments: order fetch;
   * refunds: refund fetch), so nothing is lost. Public; authenticated by
   * X-Razorpay-Signature over the RAW bytes (express.raw in app.setup.ts —
   * see RAZORPAY_WEBHOOK_RAW_PATH for the lockstep warning). Generous
   * throttle: the signature is the real auth; 300/min is DoS hygiene that
   * never 429s a legitimate provider retry burst.
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

    if (claim.shouldProcess) {
      // Fire-and-forget AFTER the response: the ack must beat the 5s
      // deadline regardless of settle latency. Errors are captured into the
      // claim (markFailed keeps processed=false → sweep backstop); success
      // burns it (markProcessed) so redeliveries short-circuit.
      setImmediate(() => {
        this.settlement
          .processWebhook(parsed)
          .then(() => this.webhooks.markProcessed(claim.eventId))
          .catch((err) => this.webhooks.markFailed(claim.eventId, err));
      });
    }
    return { received: true, duplicate: !claim.shouldProcess };
  }

  /**
   * Client verify fast-path (plan §1.1[4]): the checkout signature is a
   * HINT — the service re-fetches the payment from the API (authority #1)
   * and settles through the SAME door as the webhook. Same Option-A
   * ownership as initiate.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('verify')
  verify(@Body() dto: VerifyRazorpayDto, @Req() req: Request) {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    const userId = req.user?.sub;
    if (!userId && !sessionId) throw new BadRequestException('No session');
    return this.settlement.verifyFastPath({
      orderNumber: dto.orderNumber,
      userId,
      sessionId,
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: dto.razorpayPaymentId,
      razorpaySignature: dto.razorpaySignature,
    });
  }
}
