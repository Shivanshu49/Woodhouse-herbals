import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import { integrationsStatus } from './integrations-status';
import { StoreProfilePatch, validateStoreProfilePatch } from './store-profile-validation';

export interface AdminStoreProfile {
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  state: string | null;
  stateCode: string | null;
  shippingGstRate: number;
}

@Injectable()
export class StoreSettingsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current store-profile values for the Settings UI (nullable — may be unset). */
  async getProfile(): Promise<AdminStoreProfile> {
    const rows = await this.prisma.storeSetting.findMany({
      where: { key: { startsWith: 'store.' } },
      select: { key: true, value: true },
    });
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const str = (k: string) => (typeof m[k] === 'string' && m[k] ? (m[k] as string) : null);
    return {
      legalName: str('store.legalName') ?? str('store.name'),
      gstin: str('store.gstin'),
      pan: str('store.pan'),
      address: str('store.address'),
      state: str('store.state'),
      stateCode: str('store.stateCode'),
      shippingGstRate: typeof m['store.shippingGstRate'] === 'number' ? (m['store.shippingGstRate'] as number) : 18,
    };
  }

  /** Validate + persist a store-profile patch (stateCode is derived, never trusted). */
  async updateProfile(patch: StoreProfilePatch, actorId: string): Promise<AdminStoreProfile> {
    const { ok, errors, normalized } = validateStoreProfilePatch(patch);
    if (!ok) throw new BadRequestException({ message: 'Store profile validation failed', errors });

    // A GSTIN's first two digits ARE the seller's GST state code. Cross-check the
    // MERGED profile (patch over stored) so an admin can't pair, say, a Maharashtra
    // GSTIN (27…) with a Karnataka state (29) — which would print a self-contradictory
    // legal invoice AND flip the place-of-supply CGST/SGST-vs-IGST split.
    const current = await this.getProfile();
    const mergedGstin = normalized.gstin ?? current.gstin;
    const mergedStateCode = normalized.stateCode ?? current.stateCode;
    if (mergedGstin && mergedStateCode && mergedGstin.slice(0, 2) !== mergedStateCode) {
      throw new BadRequestException({
        message: 'Store profile validation failed',
        errors: {
          gstin: `GSTIN state code (${mergedGstin.slice(0, 2)}) must match the store state code (${mergedStateCode}).`,
        },
      });
    }

    const map: Array<[string, Prisma.InputJsonValue]> = [];
    const put = (key: string, v: string | number | undefined) => {
      if (v !== undefined) map.push([key, v]);
    };
    put('store.legalName', normalized.legalName);
    put('store.gstin', normalized.gstin);
    put('store.pan', normalized.pan);
    put('store.address', normalized.address);
    put('store.state', normalized.state);
    put('store.stateCode', normalized.stateCode);
    put('store.shippingGstRate', normalized.shippingGstRate);

    await this.prisma.$transaction(
      map.map(([key, value]) =>
        this.prisma.storeSetting.upsert({
          where: { key },
          create: { key, value, updatedBy: actorId },
          update: { value, updatedBy: actorId },
        }),
      ),
    );
    return this.getProfile();
  }

  /** Provider configured/not-configured from env presence — never exposes secrets. */
  integrations() {
    return integrationsStatus({
      CLOUDINARY_CLOUD_NAME: env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: env.CLOUDINARY_API_SECRET,
      R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: env.R2_BUCKET,
      RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: env.RAZORPAY_WEBHOOK_SECRET,
      RESEND_API_KEY: env.RESEND_API_KEY,
    });
  }
}
