import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import { RazorpayClient } from './razorpay.client';
import { verifyWebhookSignature } from './razorpay-signing';
import { deriveOrderReceipt } from './razorpay-receipt';
import { decideInitiateReuse } from '../reconciliation/reconcile-decisions';

interface InitiateInput {
  orderNumber: string;
  /** Authenticated owner (JWT), when present. */
  userId?: string;
  /** Guest cart-session cookie (wh_sid), when present. */
  sessionId?: string;
}

/**
 * Razorpay integration — Phase 3 surface: initiate + webhook verification.
 * Settlement (webhook processing, verify fast-path, cron) lands in Phases
 * 4–6; nothing in this file moves money state beyond superseding a stale
 * INITIATED row.
 *
 * Security invariants (ported from the previous gateway service + plan §1.1/§1.2):
 * - Amount comes from `Order.totalMinor` server-side, never from the client.
 * - Ownership (Option A): the JWT owner OR the guest whose wh_sid session
 *   matches `order.cartSessionId` — the exact pattern of the public order
 *   read (orders.service.findOwnedByNumber). Mismatches mask as 404.
 * - Reuse-if-fresh: one live rzp order per order row
 *   (payment_one_initiated_per_order enforces it at the DB), with a TTL−2h
 *   freshness margin so the cron can never abandon an rzp order that was
 *   just handed to a customer mid-checkout.
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);

  // Explicit tokens for tsx-based integration runs (no design:paramtypes
  // under esbuild); see the matching note in razorpay.controller.ts.
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RazorpayClient) private readonly client: RazorpayClient,
  ) {}

  async initiate(input: InitiateInput) {
    if (!this.client.isConfigured()) {
      throw new ServiceUnavailableException('Online payments are not configured');
    }

    const order = await this.prisma.order.findUnique({
      where: { number: input.orderNumber },
      select: {
        id: true,
        number: true,
        userId: true,
        cartSessionId: true,
        status: true,
        totalMinor: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const ownedByUser = Boolean(input.userId && order.userId === input.userId);
    const ownedBySession = Boolean(input.sessionId && order.cartSessionId === input.sessionId);
    if (!ownedByUser && !ownedBySession) {
      // Mask ownership mismatch as not-found to avoid leaking existence.
      throw new NotFoundException('Order not found');
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ConflictException(`Order is already ${order.status.toLowerCase()}`);
    }

    // ── Reuse-if-fresh / supersede (plan §1.1[2]) ─────────────────────────
    const existing = await this.findInitiatedRow(order.id);
    const decision = decideInitiateReuse({
      existingCreatedAtMs: existing ? existing.createdAt.getTime() : null,
      nowMs: Date.now(),
      abandonTtlHours: env.PAYMENT_ABANDON_TTL_HOURS,
    });
    if (decision === 'reuse' && existing?.providerTxnId) {
      return this.checkoutParams(order.number, order.totalMinor, existing.providerTxnId);
    }
    if (decision === 'supersede-then-mint' && existing) {
      // CAS: only a still-INITIATED row is superseded — never clobber a
      // row a concurrent settle just advanced.
      await this.prisma.payment.updateMany({
        where: { id: existing.id, status: 'INITIATED' },
        data: { status: 'FAILED' },
      });
      this.logger.log(
        JSON.stringify({ scope: 'razorpay:initiate:superseded', paymentId: existing.id }),
      );
    }

    // ── Mint: S2S order create FIRST, row second (plan §1.1 crash windows:
    //    an orphan rzp order nobody holds an id for is unpayable; a crash
    //    after row insert is recovered by reuse-if-fresh on retry) ─────────
    let rzpOrderId: string;
    let raw: unknown;
    try {
      const created = await this.client.createOrder({
        amountMinor: order.totalMinor,
        receipt: deriveOrderReceipt(order.number, randomUUID().replace(/-/g, '')),
        notes: { orderNumber: order.number },
      });
      rzpOrderId = created.id;
      raw = created.raw;
    } catch {
      // Do NOT log the error object — provider errors can echo request material.
      this.logger.error(
        JSON.stringify({ scope: 'razorpay:initiate:provider_failed', orderId: order.id }),
      );
      throw new BadGatewayException('Payment gateway unavailable — try again');
    }

    try {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'razorpay',
          providerTxnId: rzpOrderId,
          amountMinor: order.totalMinor,
          status: 'INITIATED',
          rawResponse: raw as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Lost the double-mint race (payment_one_initiated_per_order):
        // return the winner's rzp order id instead of a second payable order.
        const winner = await this.findInitiatedRow(order.id);
        if (winner?.providerTxnId) {
          return this.checkoutParams(order.number, order.totalMinor, winner.providerTxnId);
        }
      }
      throw e;
    }

    this.logger.log(
      JSON.stringify({
        scope: 'razorpay:initiate',
        orderId: order.id,
        rzpOrderId,
        amountMinor: order.totalMinor,
      }),
    );
    return this.checkoutParams(order.number, order.totalMinor, rzpOrderId);
  }

  private findInitiatedRow(orderId: string) {
    return this.prisma.payment.findFirst({
      where: { orderId, status: 'INITIATED' },
      select: { id: true, providerTxnId: true, createdAt: true },
    });
  }

  private checkoutParams(orderNumber: string, amountMinor: number, rzpOrderId: string) {
    return {
      keyId: env.RAZORPAY_KEY_ID!,
      razorpayOrderId: rzpOrderId,
      amountMinor,
      currency: 'INR' as const,
      orderNumber,
    };
  }

  /**
   * Webhook signature verification over the RAW request bytes, with the
   * ≤24h secret-rotation window (RAZORPAY_WEBHOOK_SECRET_OLD).
   */
  verifyWebhook(rawBody: string, signature: string): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Razorpay webhook secret is not configured');
    }
    return verifyWebhookSignature(rawBody, signature, secret, env.RAZORPAY_WEBHOOK_SECRET_OLD);
  }
}
