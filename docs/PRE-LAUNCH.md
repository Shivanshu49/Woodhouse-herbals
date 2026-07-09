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

## 2. Payments — PhonePe (real money)
- [ ] **Real PhonePe SANDBOX refund verification** (D1b §10, still open): run an
      actual `/pg/v1/refund` against a real sandbox payment; confirm the callback
      + Check-Status response shapes match the D1b spec and `X-VERIFY` is accepted.
- [ ] Set `PHONEPE_BASE_URL` + real merchant creds (salt/index/merchantId) in the
      deploy env — dev falls back to `dev-salt` / `PGTESTPAYUAT` / sandbox host.
      A `.env` change needs a backend restart.
- [ ] Confirm the PhonePe callback URL is reachable from PhonePe (pay + refund webhooks).

## 3. Storage & media
- [ ] **Configure Cloudflare R2** for invoice PDFs (`R2_*` env). Without it the
      invoice service uses the `pdfBytes` dev fallback (fine for dev, not prod).
- [ ] Cloudinary is already working (signed uploads for products/banners/content);
      confirm the prod `CLOUDINARY_*` creds point at the intended cloud.

## 4. Auth, cookies & deployment
- [ ] **Deploy the NestJS backend.** Vercel currently serves only the frontend, so
      login/account/admin are dead on the live site until the API is hosted.
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
