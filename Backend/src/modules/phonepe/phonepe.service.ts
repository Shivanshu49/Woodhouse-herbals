import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { InventoryReason, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { WebhookEventsService } from '../../common/security/webhook-events.service';
import { DEV_FALLBACKS, env } from '../../common/config/env';

const PAY_ENDPOINT = '/pg/v1/pay';

interface InitiateInput {
  orderNumber: string;
  userId: string;
}

interface DecodedCallback {
  merchantId?: string;
  merchantTransactionId: string;
  transactionId?: string;
  amount?: number;
  state: 'COMPLETED' | 'FAILED' | 'PENDING' | string;
  responseCode?: string;
  paymentInstrument?: unknown;
}

/**
 * PhonePe integration.
 *
 * Security invariants enforced here:
 * - Payment amount is read from `Order.totalMinor` server-side, never
 *   from the client request.
 * - Webhook signature verification uses the *raw* request bytes (the
 *   controller hands them in as a string before any JSON parsing).
 * - Callback handling is idempotent: terminal payment states are never
 *   re-transitioned, so duplicate webhook deliveries are safe.
 */
@Injectable()
export class PhonepeService {
  private readonly logger = new Logger(PhonepeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly webhooks: WebhookEventsService,
  ) {}

  /**
   * Single point of credential access for PhonePe. In production the
   * validator in env.ts already refuses to boot without these set; here
   * we narrow the type from `string | undefined` to `string` and apply
   * the dev fallbacks visibly. Webhook signing/verification reads via
   * this helper so dev and prod follow the exact same code path.
   */
  private credentials(): { merchantId: string; saltKey: string; saltIndex: string } {
    return {
      merchantId: env.PHONEPE_MERCHANT_ID ?? DEV_FALLBACKS.PHONEPE_MERCHANT_ID,
      saltKey: env.PHONEPE_SALT_KEY ?? DEV_FALLBACKS.PHONEPE_SALT_KEY,
      saltIndex: env.PHONEPE_SALT_INDEX, // schema gives this a default
    };
  }

  async initiate(input: InitiateInput) {
    const order = await this.prisma.order.findUnique({
      where: { number: input.orderNumber },
      select: {
        id: true,
        userId: true,
        totalMinor: true,
        status: true,
        shippingPhone: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== input.userId) {
      // Mask ownership mismatch as not-found to avoid leaking existence.
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(`Order is already ${order.status.toLowerCase()}`);
    }

    const { merchantId, saltKey, saltIndex } = this.credentials();

    const merchantTxnId = `WH${Date.now()}${randomUUID().slice(0, 6)}`;
    const webOrigin = env.WEB_ORIGIN.split(',')[0]!;

    const payload = {
      merchantId,
      merchantTransactionId: merchantTxnId,
      merchantUserId: order.userId,
      amount: order.totalMinor,
      redirectUrl: `${webOrigin}/account/orders/${input.orderNumber}`,
      redirectMode: 'POST',
      callbackUrl: `${webOrigin}/api/phonepe/callback`,
      mobileNumber: order.shippingPhone,
      paymentInstrument: { type: 'PAY_PAGE' },
    };

    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const checksum = `${createHash('sha256').update(base64 + PAY_ENDPOINT + saltKey).digest('hex')}###${saltIndex}`;

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'phonepe',
        providerTxnId: merchantTxnId,
        amountMinor: order.totalMinor,
        status: PaymentStatus.INITIATED,
      },
    });

    this.logger.log(
      JSON.stringify({
        scope: 'phonepe:initiate',
        merchantTxnId,
        orderId: order.id,
        amountMinor: order.totalMinor,
      }),
    );

    return {
      merchantTransactionId: merchantTxnId,
      base64Payload: base64,
      checksum,
      endpoint: PAY_ENDPOINT,
    };
  }

  /**
   * Verify a webhook signature against the raw request body bytes.
   *
   * PhonePe sends `X-VERIFY: sha256(rawBody + saltKey)###saltIndex`.
   * Uses timingSafeEqual to avoid leaking byte-by-byte differences.
   * Caller MUST pass the raw body — re-serialised JSON will fail.
   */
  verifySignature(rawBody: string, signature: string): boolean {
    const { saltKey, saltIndex } = this.credentials();
    const expected = `${createHash('sha256').update(rawBody + saltKey).digest('hex')}###${saltIndex}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  /**
   * Handle a verified callback. Idempotent: terminal states aren't replayed,
   * and only an INITIATED payment can move to SUCCESS/FAILED. On SUCCESS,
   * the order's cart is cleared. On FAILED, decremented stock is restored.
   */
  async handleCallback(
    rawBody: string,
    signature: string,
  ): Promise<{ ok: true; state: string; replayed?: boolean }> {
    let outer: { response?: string };
    try {
      outer = JSON.parse(rawBody);
    } catch {
      throw new BadRequestException('Invalid callback body');
    }
    if (!outer.response || typeof outer.response !== 'string') {
      throw new BadRequestException('Missing response payload');
    }

    let decoded: DecodedCallback;
    try {
      decoded = JSON.parse(Buffer.from(outer.response, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed response payload');
    }
    if (!decoded.merchantTransactionId || !decoded.state) {
      throw new BadRequestException('Missing transaction state');
    }

    // Persist + claim the webhook for at-most-once processing.
    // Idempotency key = provider transaction id. A re-delivered webhook
    // with the same id short-circuits below.
    const claim = await this.webhooks.record({
      provider: 'phonepe',
      eventType: `payment.${decoded.state.toLowerCase()}`,
      idempotencyKey: `phonepe:${decoded.merchantTransactionId}`,
      signature,
      rawBody,
      payload: decoded as unknown as Prisma.InputJsonValue,
    });
    if (!claim.shouldProcess) {
      this.logger.log(
        JSON.stringify({
          scope: 'phonepe:callback:replayed',
          eventId: claim.eventId,
          txn: decoded.merchantTransactionId,
        }),
      );
      return { ok: true, state: decoded.state, replayed: true };
    }

    try {
      const payment = await this.prisma.payment.findUnique({
        where: { providerTxnId: decoded.merchantTransactionId },
        include: { order: { include: { items: true } } },
      });
      if (!payment) throw new NotFoundException('Payment not found');

      if (
        payment.status === PaymentStatus.SUCCESS ||
        payment.status === PaymentStatus.FAILED ||
        payment.status === PaymentStatus.REFUNDED
      ) {
        this.logger.log(
          JSON.stringify({
            scope: 'phonepe:callback:terminal_already',
            txn: decoded.merchantTransactionId,
            existing: payment.status,
          }),
        );
        await this.webhooks.markProcessed(claim.eventId);
        return { ok: true, state: payment.status };
      }

      // Amount sanity — PhonePe echoes back the charged amount in paise.
      if (typeof decoded.amount === 'number' && decoded.amount !== payment.amountMinor) {
        this.logger.error(
          JSON.stringify({
            scope: 'phonepe:callback:amount_mismatch',
            txn: decoded.merchantTransactionId,
            expected: payment.amountMinor,
            got: decoded.amount,
          }),
        );
        await this.markFailed(payment.id, payment.order.id, payment.order.items, decoded);
        await this.webhooks.markProcessed(claim.eventId);
        return { ok: true, state: PaymentStatus.FAILED };
      }

      if (decoded.state === 'COMPLETED') {
        await this.markSuccess(payment.id, payment.order.id, payment.order.cartSessionId, decoded);
        await this.webhooks.markProcessed(claim.eventId);
        return { ok: true, state: PaymentStatus.SUCCESS };
      }
      if (decoded.state === 'FAILED') {
        await this.markFailed(payment.id, payment.order.id, payment.order.items, decoded);
        await this.webhooks.markProcessed(claim.eventId);
        return { ok: true, state: PaymentStatus.FAILED };
      }
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { rawResponse: decoded as unknown as Prisma.InputJsonValue },
      });
      // PENDING — leave the webhook unprocessed so a subsequent terminal
      // callback can pick it up; just acknowledge to PhonePe.
      return { ok: true, state: payment.status };
    } catch (err) {
      await this.webhooks.markFailed(claim.eventId, err);
      throw err;
    }
  }

  private async markSuccess(
    paymentId: string,
    orderId: string,
    cartSessionId: string | null,
    decoded: DecodedCallback,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.INITIATED },
        data: {
          status: PaymentStatus.SUCCESS,
          rawResponse: decoded as unknown as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) return; // raced — leave alone

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });

      if (cartSessionId) {
        const cart = await tx.cart.findUnique({ where: { sessionId: cartSessionId } });
        if (cart) {
          await tx.cartLine.deleteMany({ where: { cartId: cart.id } });
        }
      }
    });
    this.logger.log(JSON.stringify({ scope: 'phonepe:callback:success', orderId }));
  }

  private async markFailed(
    paymentId: string,
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
    decoded: DecodedCallback,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: paymentId, status: PaymentStatus.INITIATED },
        data: {
          status: PaymentStatus.FAILED,
          rawResponse: decoded as unknown as Prisma.InputJsonValue,
        },
      });
      if (updated.count !== 1) return;

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // Restore stock through InventoryService so each return is audited.
      for (const item of items) {
        await this.inventory.adjust({
          productId: item.productId,
          delta: item.quantity,
          reason: InventoryReason.ORDER_CANCELLED,
          reference: orderId,
          tx,
        });
      }
    });
    this.logger.warn(JSON.stringify({ scope: 'phonepe:callback:failed', orderId }));
  }
}
