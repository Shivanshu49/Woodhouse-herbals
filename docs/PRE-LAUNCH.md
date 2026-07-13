# Pre-launch checklist — Wood House Herbals

Consolidated blockers that must clear **before go-live**. None of these are bugs
in the built features; they are the config, deploy, and storefront-wiring steps
that the admin program deliberately deferred. Grouped by area; each item names
where it's enforced/guarded so nothing ships silently misconfigured.

Last updated: end of Admin **Phase E** (Settings · Categories · Inventory ·
Content · Coupons all code-complete on `feat/admin-phase-e`).

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
- [ ] **Deploy the NestJS backend.** Vercel currently serves only the frontend, so
      login/account/admin are dead on the live site until the API is hosted.
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
- [ ] **Content:** the storefront never calls `GET /homepage`; hero copy is baked
      into JPGs; testimonials/FAQs/policy pages have **no public read endpoint** and
      their routes 404. Banner/offer **scheduling is stored but not enforced**.
- [ ] **Homepage sections & coupons at checkout** already read live data
      (badges/`isCombo`; coupon preview/redeem) — the gap is the storefront pages.
- [ ] **Offer strip / WH25 (July client round):** the client-approved offer
      ("Get 25% off on purchase of ₹499 & above, use code WH25") lives only in
      the frontend mock (`Frontend/src/data/homepage.ts`). Before wiring the
      strip to `GET /homepage`: set the same copy in admin offer-strip content
      (the dev seed still says `FLAT 20% OFF … GLOW20`) **and create the WH25
      coupon** (PERCENT 25, min order ₹499) in admin — no coupon row exists for
      any advertised code today, so WH25 would be rejected at checkout.

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
