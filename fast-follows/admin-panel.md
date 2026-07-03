# Admin panel — deferred fast-follows

Tracked items deferred from the Phase B (app shell) final whole-branch review.
None block Phase C from starting. Fix opportunistically or in a dedicated
cleanup pass. Severity is the reviewer's.

**Already resolved (not in this list):**
- Login error handling (was #4) — fixed on `feat/admin-phase-c`
  (`Admin/src/lib/auth-errors.ts` + test; login page now distinguishes
  401 / 403 / 429 / 5xx / network).
- Cookie-domain decision (was #2) — fixed on `feat/admin-phase-c`
  (`COOKIE_DOMAIN` env stamps `Domain` on the auth cookies in prod;
  documented in `Admin/README.md`).

---

## Important

### FF-1 — `/products/new` is a dead 404 wired into the most prominent CTAs
The products page header button, its empty-state button, the command palette
"Add new product" item, and `Cmd+N` all push to `/products/new`, which renders
Next's default 404 *outside* the shell with no way back.
- **Where:** `Admin/src/app/(dashboard)/products/page.tsx`,
  `Admin/src/components/layout/command-palette.tsx`,
  `Admin/src/app/(dashboard)/layout.tsx` (Cmd+N).
- **Fix:** largely resolved by Phase C step 4 (the real Add Product page at
  `/products/new`). Until then, and for any other stray sub-route, add a
  `Admin/src/app/(dashboard)/not-found.tsx` that renders inside the shell with
  a "back to dashboard" link.

### FF-2 — Idle timeout is per-tab, but logout revokes the whole session family
The 30-min idle timer only observes activity in its own tab. With two admin
tabs open, an idle background tab fires `logout`, which revokes the refresh
family server-side and kills the session the user is actively working in
another tab.
- **Where:** `Admin/src/hooks/use-idle-timeout.ts`, consumed in
  `Admin/src/app/(dashboard)/layout.tsx`.
- **Fix:** share a `lastActivityAt` timestamp across tabs via `localStorage`
  (or `BroadcastChannel`); only fire `onIdle` when *all* tabs have been idle
  past the threshold.

---

## Minor

### FF-3 — CI `admin-check` doesn't run the unit tests
The job runs install + soft lint + build; the 7 `node:test` tests only run
locally.
- **Where:** `.github/workflows/ci.yml` (`admin-check` job).
- **Fix:** add a `- name: Test\n  run: npm run test` step after the build.

### FF-4 — Dialog / control accessibility gaps
- The user-menu trigger has no accessible name (SR announces the avatar
  initials, e.g. "OW, button") — add `aria-label="Account menu"`.
  (`Admin/src/components/layout/user-menu.tsx`)
- The mobile-nav `SheetContent` and the `CommandDialog` lack an (sr-only)
  `DialogTitle`, so Radix logs a dev warning and screen readers announce an
  unnamed dialog. Add a visually-hidden title to each.
  (`Admin/src/components/layout/topbar.tsx`,
  `Admin/src/components/layout/command-palette.tsx`)

### FF-5 — `Cmd+N` is a browser-reserved shortcut
Chrome/Edge/Firefox reserve `Ctrl/Cmd+N` for "new window", and
`e.preventDefault()` cannot intercept it, so the shortcut is dead for most
users. The command palette already covers "add product".
- **Where:** `Admin/src/app/(dashboard)/layout.tsx`.
- **Fix:** rebind to a non-reserved combo (e.g. a `g p` sequence or
  `Cmd+Shift+P`), or drop it and rely on the palette.

### FF-6 — `env.ts` silently falls back to `localhost` in production builds
A deploy missing `NEXT_PUBLIC_API_URL` would quietly ship an admin pointing at
`http://localhost:4000`.
- **Where:** `Admin/src/lib/env.ts`.
- **Fix:** throw when the var is unset and `process.env.NODE_ENV === 'production'`;
  keep the localhost fallback for dev only.

### FF-7 — `next@14.2.5` carries a known npm advisory
Pinned to match the storefront. `npm install` warns.
- **Where:** `Admin/package.json` and `Frontend/package.json`.
- **Fix:** bump both apps to a patched `14.2.x` together in one change so they
  stay in lockstep.

### FF-8 — `useLogout.onSettled` does a redundant invalidate
It calls `setQueryData(qk.me, null)` (instant) then
`invalidateQueries({ queryKey: qk.me })`, which can trigger a pointless
me → refresh → retry round-trip on the next mount.
- **Where:** `Admin/src/hooks/use-admin-auth.ts`.
- **Fix:** `setQueryData(qk.me, null)` alone is sufficient for instant logout UI.
