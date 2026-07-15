# Pre-launch checklist — Wood House Herbals

Consolidated blockers that must clear **before go-live**. None of these are bugs
in the built features; they are the config, deploy, and storefront-wiring steps
that the admin program deliberately deferred. Grouped by area; each item names
where it's enforced/guarded so nothing ships silently misconfigured.

Last updated: 2026-07-14 (post-merge deployment forensics — added §4 catalog
population + storefront Vercel env; backend is now live at
`api.woodhouseherbals.com`).

## 1. Store profile & tax data (invoices depend on this)
- [ ] **Replace the placeholder store profile.** `store.gstin/state/legalName`
      were seeded with PLACEHOLDER values (fake GSTIN `29ABCDE1234F1Z5`). Set the
      real values via the admin **Settings → Store profile** tab. Guardrail is
      already in place: `StoreProfileService.getInvoiceProfile()` **503s** if
      `gstin`/`state`/`legalName` are unset — so a fake GSTIN can't reach a real
      invoice, but a *placeholder* one could. Verify the real GSTIN's state code
      matches `store.state` (the Section-1 cross-check rejects a mismatch).
- [ ] Confirm `store.shippingGstRate` (default 18) is correct for your shipping.

## 2. Payments — Razorpay (real money)
- [ ] **Set the three core keys in the deploy env** (Coolify): `RAZORPAY_KEY_ID`,
      `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. All three are **hard-required
      at prod boot** (the app refuses to start without them); there is no dev
      fallback. Use test-mode keys (`rzp_test_…`) in staging.
- [ ] **Register the webhook in the Razorpay dashboard against the API origin** —
      `https://api.<domain>/api/razorpay/webhook` (NOT the storefront origin). Set
      the same secret you put in `RAZORPAY_WEBHOOK_SECRET`. Configure **test-mode
      and live-mode webhooks separately**, each with its own secret. Subscribe to:
      `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`,
      `refund.failed`.
- [ ] **Set the per-webhook failure-alert email** in the dashboard. Razorpay
      **auto-disables a webhook after 24 h of continuous delivery failures** — the
      alert email is how you learn before events stop arriving. If it disables,
      re-enable it manually from the dashboard after fixing the endpoint.
- [ ] **Reconciliation dead-man alert** (the cron is the sole lost-webhook backstop
      and the sole owner of terminal abandonment). Wire a monitor that fires on
      **either**: (a) LIVENESS — the **max** over all three
      `reconcile:{payments,refunds,redrive}:last_completed_at` StoreSetting keys is
      > 30 min old (a per-row-failure-but-still-firing sweep keeps liveness fresh,
      so this alone is not enough); **paired with** (b) per-domain BACKLOG —
      oldest `INITIATED` razorpay payment age, oldest `PENDING` `GATEWAY` refund age,
      and oldest `processed=false` razorpay `WebhookEvent` age each exceeding
      ~2× their sweep interval. Wholesale sweep failures also emit `logger.error`
      lines, so error-rate monitoring is a parallel net.
- [ ] **Rotation window**: if you rotate `RAZORPAY_WEBHOOK_SECRET`, set the old
      value as `RAZORPAY_WEBHOOK_SECRET_OLD` for ≤24 h (retried deliveries created
      before the rotation are still signed with the old secret), then clear it.
- [ ] **Sandbox verification** (test-mode keys, before go-live): initiate →
      checkout.js test card → `payment.captured` → order PAID + cart cleared;
      failed-then-retry on the same order (order must NOT cancel between);
      full refund cycle → `refund.processed` → order REFUNDED; refund-create
      timeout drill (no double refund); a tampered-signature webhook is rejected;
      strand an INITIATED payment and watch the cron settle it; a TTL-expired
      payment cancels + restocks exactly once.
- [ ] **Cloudflare (if adopted in front of the API — §4.2 of the migration plan):**
      (1) Bot Fight Mode can't be skip-ruled on the Free plan — keep it OFF on the
      API zone, or grey-cloud the API hostname, or use a plan with Super Bot Fight
      Mode + a Skip rule for `/api/razorpay/webhook`; (2) set `TRUST_PROXY_HOPS=2`
      for the CF→Traefik→app chain and **verify empirically** (log `req.ip` + XFF);
      (3) lock down the VPS raw IP / any Coolify-generated hostname so the webhook
      route can't be reached bypassing CF; (4) no Workers/Snippets or body-touching
      transform rules on the webhook path (they would break raw-body HMAC).

## 3. Storage & media
- [ ] **Configure Cloudflare R2** for invoice PDFs (`R2_*` env). Without it the
      invoice service uses the `pdfBytes` dev fallback (fine for dev, not prod).
- [ ] Cloudinary is already working (signed uploads for products/banners/content);
      confirm the prod `CLOUDINARY_*` creds point at the intended cloud.

## 4. Auth, cookies & deployment
- [x] **Deploy the NestJS backend.** Done 2026-07-14 — live at
      `https://api.woodhouseherbals.com` via Coolify (`/api/health/ready` → db ok).
- [ ] **Set `NEXT_PUBLIC_API_URL` on the storefront Vercel project and REBUILD.**
      Proven live 2026-07-14: the production bundle was built without it, so the
      baked fallback `http://localhost:4000` (`Frontend/src/lib/env.ts:51`) sends
      every visitor's browser to their *own* machine — the deployed storefront
      makes **zero** requests to the real API and silently hides all product
      sections. It is a **build-time inline**, so setting the var without a
      redeploy does nothing. Note `Frontend/DEPLOY.md` lines 20/40 are stale: the
      "falls back to mock data" behaviour they describe was deleted in the
      keystone (`f5a7e8f`). Also confirm the backend `WEB_ORIGIN` includes the
      storefront origin (credentialed CORS).
- [x] **Populate the production catalog — a fresh prod DB ships EMPTY.**
      Done 2026-07-14: `npm run prisma:seed` executed inside the deployed
      backend container (a pre-seed `pg_dump` snapshot sits at
      `/root/pre-seed-2026-07-14.sql` on the VPS). `start:prod` runs
      `prisma migrate deploy` but nothing ever seeds — the seed is a manual
      step by design. Verified live: 6 storefront-visible products, 1 DRAFT,
      1 archived combo, 8 concerns, 4 offer-strip rows, 1 hero banner.
      **⚠ ONE-TIME BOOTSTRAP ONLY — re-running this seed against a live store
      WILL wipe admin-managed offer strip and hero banners** (it
      `deleteMany`-regenerates both tables, seed.ts:17/28) **and reset
      stock/status/badges/ingredients on its 8 slugs.** Never re-run it once
      admins have touched content; it is a bootstrap, not a sync.
- [ ] **Replace the 4 Unsplash placeholder packshots via Admin.** Only
      `niacinamide-face-wash` and `vitamin-c-niacinamide-serum` carry real
      Cloudinary packshots; the face cream, Vitamin-C face wash, salicylic
      face wash and D-Tan scrub wear stock photos that must not reach launch.
      Also: publish a real combo product (the seeded combo is ARCHIVED, so the
      homepage Combo Packs section stays hidden until one exists); the
      relational `Category` table is intentionally still empty (storefront
      category circles derive from the product enum); the live offer strip
      advertises **WH25**, which checkout rejects until the coupon row exists
      (§5).
- [ ] **`NODE_ENV=production` is load-bearing for the DB-invariant boot gate**
      (`src/common/db/required-partial-indexes.ts` — the double-payout-guard +
      double-mint-guard index checks) AND for the Razorpay/JWT prod-boot
      credential requirements. Without it the index gate only WARNS and the app
      serves traffic even if a money-critical index is missing. `npm run
      start:prod` now pins `NODE_ENV=production` itself (a contract test keeps
      the pin), so a plain `start:prod` is safe — but if the Coolify service
      runs `node dist/src/main.js` (or any other entrypoint) directly, it MUST
      set `NODE_ENV=production` in the service env.
- [ ] **Same-site cookie domain.** Prod auth cookies are `SameSite=strict`, so the
      API must share a registrable domain with the storefront; set `COOKIE_DOMAIN`
      to stamp `Domain` on the auth cookies (see `Frontend/DEPLOY.md`).
- [ ] Set `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Google sign-in hidden
      until set) and MSG91 keys (real phone-OTP SMS; dev echoes the code).
- [ ] Admin app (`Admin/`, port 3001): set `NEXT_PUBLIC_API_URL` / `ADMIN_ORIGIN`
      for the deployed API; rotate the dev admin (`owner@woodhouseherbals.test`).
- [ ] **Connect Us form delivery (`/api/connect`).** Set `RESEND_API_KEY`,
      `CONNECT_FROM_EMAIL` on a **verified** Resend domain (the
      `onboarding@resend.dev` fallback only delivers to the Resend account
      owner), and `CONNECT_TO_EMAIL`. **Without the key the route returns
      `ok: true` to customers but the submission is irrecoverably discarded** —
      the DPDP-redacted log line keeps no name/phone/message content, only a
      submission id + presence flags (plus a keyed email digest when
      `CONNECT_LOG_KEY` is set, for correlating complaints).

## 5. Storefront wiring — Phase-E management is DARK until built
Everything the admin now manages is invisible to shoppers until the storefront is
migrated off mock data. Full batch tracked in `storefront-wiring.md`; headlines:
- [ ] **Categories:** public category endpoints must filter `isActive` + `deletedAt`
      (today the admin hide/soft-delete are inert on the storefront).
- [ ] **Content:** ~~the storefront never calls `GET /homepage`~~ (stale — the
      keystone `f5a7e8f` wired homepage/offer-strip/trust to `GET /homepage`);
      still true: hero copy is baked into JPGs (`Hero.tsx` hardcoded banners);
      testimonials/FAQs/policy pages have **no public read endpoint** and their
      routes 404. Banner/offer **scheduling is stored but not enforced**.
- [ ] **Homepage sections & coupons at checkout** already read live data
      (badges/`isCombo`; coupon preview/redeem) — the gap is the storefront pages.
- [ ] **Create the WH25 coupon row** (PERCENT 25, min order ₹499) in admin.
      The client-approved copy ("Get 25% off on purchase of ₹499 & above, use
      code WH25") is now the single source of truth in the backend seed
      (`Backend/prisma/seed.ts` offer strip, since `77e2cd8`) and the storefront
      strip reads it live — but **no coupon row exists for any advertised code**,
      so WH25 is rejected at checkout until created.

## 6. Coupons — enforced scope (by design)
- [ ] Admins can only create **PERCENT / FLAT** coupons with a **category**
      restriction + usage caps + schedule — that is exactly what checkout enforces.
      Eligibility (first-time/specific-user), concern/product restriction, and
      FREE_SHIPPING/BXGY are **rejected by the API** and remain unbuilt
      (**FF-26/27/28** — each its own money-path phase). Communicate this scope to
      whoever runs promotions so they don't expect those levers yet.

## 7. Deferred fast-follows
- [ ] Review `fast-follows/admin-panel.md` (FF-14…FF-28) and the
      `docs/superpowers/specs/2026-07-04-post-phase-c-backlog.md` — none block
      launch, but triage which to pull forward.
