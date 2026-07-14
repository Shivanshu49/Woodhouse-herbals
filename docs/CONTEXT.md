# CONTEXT HANDOFF — Wood House Herbals

**Written:** 13 July 2026
**Repo:** github.com/Shivanshu49/Woodhouse-herbals (monorepo: Backend/ Frontend/ Admin/ AI-Service/)
**Client:** VedicGlory Healthcare · herbal skincare · Indian market · prices in ₹, paise stored as integers everywhere

You are my planning/review partner. I paste Claude Code output; you tell me what to approve, what to push back on, and what to paste next. For dashboard steps (Coolify/Hostinger/Cloudflare/Razorpay) give exact click-by-click — Claude Code can't touch those UIs. **Never put secrets in chat** — I paste them into dashboards myself. Flag India-specific correctness (GST, COD, en-IN, DPDP).

---

## THE ONE-LINE STATUS

The store **works end-to-end locally** — a real Razorpay payment of ₹258 was captured (`pay_TCzd37gw2k9v8p`). It is **not deployed**. The VPS is bought and has Coolify running, but nothing is deployed to it yet.

---

## WHAT IS DONE

### Admin panel — COMPLETE (merged to main)
Auth, dashboard, products (7-section add/edit, Cloudinary signed uploads), orders (state machine, refunds, GST invoice engine with FY series + CGST/SGST-vs-IGST), settings, categories, inventory, content manager, coupons.

### Razorpay migration — COMPLETE (Phases 0–7, branch `feat/razorpay-migration`)
PhonePe **fully removed** (repo-wide grep clean). Complete Razorpay gateway, every money phase adversarially reviewed:
- **Phase 0** — pinning tests + **boot-time DB invariant gate** (app refuses to boot in prod if the money-critical partial unique indexes are missing) + CI behavioural probes
- **Phase 1** — DB migrations: dropped `Payment.provider` default, `RefundMethod` `PHONEPE`→`GATEWAY`, added `Payment.providerPaymentId`, new `payment_one_initiated_per_order` partial unique index
- **Phase 2** — pure core (signing, state mapping, receipt derivation, cron decision fns) TDD
- **Phase 3** — RazorpayClient + `/initiate` + raw-body webhook mount + `TRUST_PROXY_HOPS`
- **Phase 4** — webhook settlement (persist-then-ack, 5s ack deadline) + `/verify` fast path — MONEY
- **Phase 5** — refund path re-target with `X-Refund-Idempotency` — MONEY
- **Phase 6** — reconciliation cron (payments sweep, refunds sweep, unprocessed-claims re-drive, dead-man timestamp) — MONEY
- **Phase 7** — PhonePe removal + docs (fixed two FALSE doc claims: a redirect-validation control that never existed, and a BullMQ background-jobs claim that was never true)

**Bugs the adversarial reviews caught that would have cost real money:**
- `captured_after_abandon` — a payment captured after the cron abandoned it vanished silently. No log, no refundable row. Customer money invisible.
- The **notes-body mismatch** — `initiate` sent `notes:{orderNumber}`, the recovery re-send omitted it. Razorpay rejects same-idempotency-key-different-body, which would be misread as "refund never created" → false conclude-FAILED → books say FAILED while the customer was actually refunded.
- 4xx classification — 408/425/429 and envelope-less 4xx were wrongly treated as definitive. Only an envelope-carrying 4xx is a Razorpay verdict. **This matters more once Cloudflare is in front** (a WAF/throttle response must never be read as "refund not created").
- `markFailed` throwing inside `setImmediate` → unhandled rejection → **process death** under Node 20 defaults.

### Storefront checkout — COMPLETE (branch `feat/storefront-checkout-keystone`)
- **The keystone**: the storefront catalog was 100% static mock (`Frontend/src/data/products.ts`). Now live-API-backed. `products.ts`, `homepage.ts`, `bestsellers.ts` **deleted** (`concerns.ts` kept). No mock fallback exists — an API outage shows an honest error, never phantom products. Unblocked three things at once: the Tier-1 Cloudinary images finally render, FF-2 (the `p_acne_facewash` salicylic phantom) is resolved, and Admin-added SKUs now appear at all.
- Cart **sync-on-mutation** (Option A): Zustand is an optimistic cache of the backend cart; `wh_sid` minted on first add. Single-flight request queue, stepper debounce, quantity clamps.
- Greenfield `/checkout` page: review → address → `POST /orders` → `/razorpay/initiate` → checkout.js → `/verify` → poll `/orders/[number]`.
- CORS: `Idempotency-Key` added to `allowedHeaders`.
- **Pricing authority verified**: the server recomputes `totalMinor` from live `Product.priceMinor` + DB coupon rows. `CreateOrderDto` carries no money field; `forbidNonWhitelisted` 400s any injected price. **No client-supplied price can reach the charge.**

### Infra — VPS live, nothing deployed
- **Hostinger KVM 2** — 8 GB, 2 vCPU, 96 GB disk, **Mumbai**, Ubuntu 24.04.4 LTS. IP `200.97.169.48`
- SSH key auth working; ufw active (22/80/443/8000); fail2ban running
- **Coolify 4.1.2** installed and healthy at `http://200.97.169.48:8000`, `localhost` server registered
- Snapshot taken (clean, Coolify-installed, nothing deployed)
- Coolify's `/data/coolify/source/.env` backed up (holds the encryption keys for every secret it stores)

---

## WHAT IS NOT DONE — in priority order

### 1. Deploy to the VPS ← THE ACTIVE TRACK
Repo has **no Dockerfiles at all**. Last prompt (unrun) asked Claude Code to add them.

**Blocking items found by the deploy recon:**
- **No Dockerfiles / .dockerignore** for Backend, Frontend, Admin
- **`output: 'standalone'`** missing in both Next configs
- **THE BOOT-GATE SEQUENCING TRAP**: the backend's boot gate `process.exit(1)`s in production if the partial unique indexes are absent. On a *fresh* Postgres they don't exist until `prisma migrate deploy` runs. If Coolify starts the app first, it crash-loops and looks broken — **that is correct behaviour, not a bug.** Fix: run `npx prisma migrate deploy` as a Coolify **pre-deployment command**. Caveat: the prisma CLI is a **devDependency** — the runtime image must NOT prune it away.
- **`NEXT_PUBLIC_*` MUST BE BUILD ARGS, not runtime env.** They're inlined at `next build`. If unset, `http://localhost:4000` gets baked into the bundle and shipped to real customers' browsers. Make the build **fail loudly** if `NEXT_PUBLIC_API_URL` is missing.
- **Health-check trap**: `/api/health/ready` returns **HTTP 200 even when the DB is down** (body says "degraded", status code lies). Point Coolify's backend probe at **`/api/health`**. Frontend/Admin → `GET /`.
- **Admin hardcodes `-p 3001`** and ignores `PORT`. Fix it.
- **Do NOT provision Redis or Meilisearch.** `ioredis` is in package.json but **never imported**; `REDIS_URL` is never consumed. Same dead-dependency pattern as `bullmq` (already removed). **Postgres only.**

**Deploy order:** Postgres (Coolify managed) → Backend (with pre-deploy migrate) → Frontend → Admin → domains + SSL → Cloudflare.

### 2. THE HARD GATE — backups before any real order
`pg_dump` → **Cloudflare R2** on a cron, retention policy, and **a restore you have actually performed and watched come back.**

Not optional. Losing that DB means losing customer orders, payment records, and **GST invoices Indian law requires you to retain for years**. Hostinger's weekly snapshots are a safety net, not a backup strategy for transactional data. **An untested backup is not a backup.**

### 3. The webhook — still unproven
The ₹258 payment settled via the **`/verify` fast path** (client returns, server re-fetches from Razorpay's API, settles). The **webhook is the source of truth** and has **never run against a real payment**, because Razorpay cannot reach `localhost`.

This matters: if a customer's browser closes before the redirect — which happens constantly on mobile — **the webhook is what saves the order.** That path is untested.

Register `https://api.<domain>/api/razorpay/webhook` (test mode) once the backend has a public HTTPS origin. The reconciliation cron has also never swept a real payment.

### 4. Six homepage changes (client feedback round three)
Prompt written, never run. Analysed against the live site:
1. **Combo Kits circle** uses `/products/derma-revive-face-wash.png` — a face wash photo for a combo category. Needs a gift-box image. *(NB: I never actually attached the image I said I'd provide.)*
2. **Combo Packs** — reverse fill/border on the first card. ⚠️ **Will break the AA contrast we measured at 5.97:1** — must be re-measured. Also add gift-box images (use only KEEP-tagged files from `.assets-src/CLASSIFICATION.md`; **NEVER** `IMG-20251013-WA0001.jpg` or `IMG-20251217-WA0002.jpg` — AI renders with gibberish label text).
3. **Hero order** — face wash banner first. ⚠️ **The first slide is the LCP image** and has a hoisted preload. Repoint it or you silently regress the mobile LCP fix.
4. **Logo** looks stretched — fix aspect ratio, size up slightly. Used in navbar AND footer.
5. **"Pigmentation" → "Dark Spot & Pigmentation"** — ⚠️ **display label only.** The slug `?concern=pigmentation` must NOT change or links and filters break.
6. **Quiz section colour** = the Anti-Aging tile's colour. ⚠️ If that's the teal `#34A99D`, **white text on it is ~2.9:1 — fails AA even for large text.** Measure it.

### 5. Product catalogue — blocked on the client
- **Tier 1 (done)**: Serum Niacinamide + Neem FW — real Cloudinary packshots, live on the storefront.
- **Tier 2 (blocked on prices + copy)**: Derma Revive FW, SPF50 Sunscreen, 21-Herbs Face & Body Scrub, Gift Box FOR HER, Gift Box FOR HIM. Photos exist in `.assets-src/`.
- **Tier 3 (blocked on real photos)**: Body Butter and Men's Charcoal Scrub. **The only "packshots" are AI-generated.** Do not put a fabricated image of a real skincare product on a live store.

### 6. Pre-launch
- Real **GSTIN / PAN / registered state** in Settings (placeholders today → invoices are not legally correct)
- **Resend** (`RESEND_API_KEY` + verified domain) or the live contact form silently discards customer messages
- **Cloudflare** in front — ⚠️ **Free-plan Bot Fight Mode cannot be skip-ruled.** Either keep it OFF or grey-cloud the API hostname, or Razorpay's server-to-server webhook POSTs get blocked. Verify `TRUST_PROXY_HOPS` **empirically** on the CF→Traefik→app chain — do not assume.
- **Turnstile** on the contact form (spam is when-not-if)
- **DPDP cookie consent**
- `NODE_ENV=production` is load-bearing for the boot gate

---

## THE CLIENT MESSAGE — send this
> To launch I need: (1) prices + a 1–2 line description for Derma Revive Face Wash, SPF50 Sunscreen, 21-Herbs Face & Body Scrub, and both gift boxes; (2) real product photos for Body Butter and Men's Charcoal Scrub — the ones I have are AI-generated and can't go on a live store; (3) the real GSTIN, PAN and registered state for invoices; (4) confirmation of gift-box contents and pricing.

**Razorpay KYC is DONE.** Test keys work. Live keys stay locked away until cutover.

---

## COST
**~₹900/month** — Hostinger KVM 2. Everything else on free tiers: Cloudinary, Cloudflare R2, Cloudflare, Coolify, Resend.
Plus **~2% + 18% GST** to Razorpay per transaction. **Push UPI at checkout** — 0% MDR, and 60–80% of Indian D2C customers use it. That's the margin lever.

**SMS/OTP: skip it.** DLT registration is ₹5,900 + 3–7 days of the client's paperwork, and the backend degrades gracefully without it. Email covers order confirmations. WhatsApp (no DLT needed) is the better channel if you want one.

---

## WORKING PRINCIPLES THAT EARNED THEIR KEEP
- **Recon before building.** Every plan started with a blast-radius inventory. It's why nothing was a surprise.
- **Adversarial review on money code.** It caught `captured_after_abandon`, the notes-body mismatch, the 4xx misclassification, the process-killing unhandled rejection. Each one would have cost real money.
- **Mutation-test the guards.** Phase 0 found that deleting `status: 'PENDING'` from the settle claim left every test green. A test you haven't watched fail is a hypothesis, not a guard.
- **Verify, don't assert.** The contrast number in the handoff was wrong. The dev DB had drifted from the migration history. The Vercel build failed for a reason nobody predicted. Read the log, run the query, take the screenshot.
- **Delete the fallback.** `products.ts` was deleted rather than env-gated: *a fallback that doesn't exist can't be misconfigured into prod.*
- **Stop-and-show-me checkpoints.** Every money phase gated. It's why there are no surprises in the payment path.

---

## OPEN DECISIONS
1. **Domain scheme** — undecided, and it determines the cookie topology (`SameSite=Lax` if same-site; `SameSite=None; Secure` if cross-site). Do **not** design against an assumption — that mistake was already made once with Railway.
   `woodhouseherbals.com` currently points at the **old WordPress site**. Consider staging on a subdomain first rather than cutting the live domain over to an unproven box.
2. **Whose card is the infra on?** It should be VedicGlory's, not yours. Untangling shared accounts after launch is genuinely painful.
3. **Footer links to `/checkout` globally** — reachable with an empty cart. Handle the empty state, or remove the link (checkout is a step, not a destination).

---

## NEXT ACTION
Run the Dockerfile prompt. Then Coolify: Postgres → Backend (pre-deploy migrate) → Frontend → Admin → domains + SSL → webhook → **backup with a proven restore.**

**Nothing goes live until a `pg_dump` has been restored and watched to come back.**
