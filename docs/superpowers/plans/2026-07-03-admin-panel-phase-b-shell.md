# Admin Panel Phase B — App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the standalone `Admin/` Next.js 14 app — toolchain, botanical shadcn/ui theme (light + dark), typed API client that talks to the Phase-A backend, admin login, a protected dashboard shell (sidebar + topbar + breadcrumbs + command palette + 30-minute idle timeout), and stub pages with designed empty states for all 13 sections — plus the `admin-check` CI job.

**Architecture:** A third app beside `Backend/` and `Frontend/`, dev port **3001**, deployed later at `admin.woodhouseherbals.com`. It is a pure client of the NestJS API (`/api/*`) over httpOnly cookies — no Prisma, no NextAuth, no server-side secrets. Auth reuses Phase A: `POST /api/auth/admin-login` (rejects customers), a 401→`/api/auth/refresh`→retry-once interceptor, and a client idle timer that logs out after 30 minutes. This phase builds the shell only; the 13 feature areas are stubs with empty states, filled in Phases C–F and later.

**Tech Stack:** Next.js 14.2.5 (App Router), React 18.3, TypeScript 5.5 (strict), Tailwind CSS 3.4 + `tailwindcss-animate`, shadcn/ui (New York style, hand-authored), `next-themes`, `@tanstack/react-query` 5, `react-hook-form` + `zod`, `cmdk`, `sonner`, `lucide-react`, Radix primitives, Node 20 / npm.

## Global Constraints

- Working directory for Admin commands: `/home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin` (created in Task 1) unless a step says otherwise. Repo root: `/home/shivanshu/Desktop/Code/Woodhouse-herbals`.
- Quality gates after every task, run in `Admin/`: `npm run typecheck && npm run build` must pass. Where a task adds a `.test.ts`, also `npm run test` (Node's `node:test` via tsx — same runner convention as `Backend/`). `npm run lint` is soft (`next lint`) — run it, but it is not a hard gate (mirrors the storefront's CI "lint || true").
- TypeScript strict: `true`. `@/*` path alias → `./src/*`. Never introduce `any` without an inline justification comment.
- **Never** read `process.env` directly in app code — go through `src/lib/env.ts` (exception: `env.ts` itself). Only `NEXT_PUBLIC_*` vars exist here; there are no server secrets in this app.
- **Never** copy the storefront's brand Tailwind config or palette. Use the botanical shadcn theme defined in the Design System section below, verbatim.
- Every network call sends `credentials: 'include'`. Base URL is `${env.apiUrl}/api`. Do NOT port the storefront's `withFallback` mock-fallback — the admin must surface API failures, never mask them.
- Pin dependency versions exactly as listed in Task 1 (match the storefront's `next@14.2.5`, `react@^18.3.1`, `typescript@^5.5.3`, `tailwindcss@^3.4.6`). Node `20.x` via `engines` + `.nvmrc`.
- Commits: conventional-commit style (`feat(admin): …`), author is the repo's configured git user (Shivanshu), **NO** Claude attribution, **NO** trailers, **NO** co-author lines.
- Backend must be reachable at `http://localhost:4000` for manual verification steps. Start it with `npm run start:dev` in `Backend/` (kill it after). A dev ADMIN account exists from Phase A: `owner@woodhouseherbals.test` / `Adm1n!Passw0rd#2026`. The backend's `WEB_ORIGIN` already includes `http://localhost:3001` (Phase A, Task 3).
- Feature components are `'use client'` unless they are pure server components with no hooks. The root layout and stub pages can stay server components; anything using hooks/`next-themes`/react-query must be a client component.

## Design System (the single source for theme tokens — copy verbatim)

"Calm botanical workspace": warm green-tinted neutrals (not cold slate), one herbal-green accent, terracotta for destructive. Fraunces (display serif) is used in EXACTLY three places — the sidebar wordmark, page `<h1>` titles, and big dashboard stat numbers — via the `font-display` utility. Everything else is Inter. SKUs/order numbers use the `font-mono` utility.

These are the shadcn CSS variables. They go in `src/styles/globals.css` (Task 1) and are referenced by `tailwind.config.ts`'s color mapping. Do not alter the numbers.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 140 14% 98%;
    --foreground: 150 14% 13%;
    --card: 0 0% 100%;
    --card-foreground: 150 14% 13%;
    --popover: 0 0% 100%;
    --popover-foreground: 150 14% 13%;
    --primary: 148 33% 37%;
    --primary-foreground: 140 20% 98%;
    --secondary: 140 12% 94%;
    --secondary-foreground: 150 14% 20%;
    --muted: 140 12% 95%;
    --muted-foreground: 150 8% 42%;
    --accent: 148 30% 92%;
    --accent-foreground: 148 40% 22%;
    --destructive: 9 62% 45%;
    --destructive-foreground: 40 30% 98%;
    --border: 140 10% 89%;
    --input: 140 10% 89%;
    --ring: 148 33% 37%;
    --radius: 0.6rem;
    --chart-1: 148 33% 37%;
    --chart-2: 150 24% 58%;
    --chart-3: 40 55% 52%;
    --chart-4: 9 62% 52%;
    --chart-5: 205 40% 38%;
  }

  .dark {
    --background: 150 12% 8%;
    --foreground: 140 10% 91%;
    --card: 150 11% 11%;
    --card-foreground: 140 10% 91%;
    --popover: 150 11% 11%;
    --popover-foreground: 140 10% 91%;
    --primary: 142 40% 55%;
    --primary-foreground: 150 30% 10%;
    --secondary: 150 8% 17%;
    --secondary-foreground: 140 10% 91%;
    --muted: 150 8% 16%;
    --muted-foreground: 150 8% 60%;
    --accent: 150 12% 20%;
    --accent-foreground: 140 15% 90%;
    --destructive: 9 55% 52%;
    --destructive-foreground: 40 30% 96%;
    --border: 150 8% 20%;
    --input: 150 8% 22%;
    --ring: 142 40% 55%;
    --chart-1: 142 40% 55%;
    --chart-2: 150 20% 48%;
    --chart-3: 40 50% 58%;
    --chart-4: 9 55% 58%;
    --chart-5: 205 38% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
  /* Tabular numerals for data tables and stats so columns align. */
  .tnum {
    font-feature-settings: "tnum" 1, "cv01" 1;
  }
}
```

Signature rules the shell must follow (enforced in Tasks 8, 10):
- Active sidebar item = a 2px herbal-green left bar (`before:` pseudo or a `<span>`), a tinted `bg-accent` fill, and `text-accent-foreground` — a quiet indicator, never a full pill.
- Primary buttons, focus rings, and positive/"good" metric numbers use `primary` (herbal green). Destructive actions/badges use `destructive` (terracotta).
- Page headers: an `<h1 class="font-display …">` title, optional one-line muted description, right-aligned primary action slot.
- Cards: `rounded-[var(--radius)]`, `border`, `bg-card`, minimal shadow (`shadow-sm`). Calm, flat-ish.

## App Structure (target end state of Phase B)

```
Admin/
├─ package.json  package-lock.json  .nvmrc  .gitignore  .env.example
├─ next.config.mjs  tsconfig.json  tailwind.config.ts  postcss.config.js  components.json
└─ src/
   ├─ middleware.ts                       # redirect unauth'd → /login by cookie presence
   ├─ app/
   │  ├─ layout.tsx                        # fonts (Inter+Fraunces), <html>, Providers
   │  ├─ providers.tsx                     # QueryClient + next-themes + Sonner Toaster
   │  ├─ (auth)/
   │  │  ├─ login/page.tsx  forgot/page.tsx  reset/page.tsx
   │  └─ (dashboard)/
   │     ├─ layout.tsx                     # auth guard + role gate + idle timeout + shell
   │     ├─ page.tsx                       # Dashboard (stub)
   │     ├─ products/page.tsx  categories/page.tsx  orders/page.tsx
   │     ├─ customers/page.tsx  coupons/page.tsx  inventory/page.tsx
   │     ├─ reviews/page.tsx  content/page.tsx  marketing/page.tsx
   │     ├─ analytics/page.tsx  shipping/page.tsx  settings/page.tsx
   ├─ components/
   │  ├─ ui/                               # shadcn primitives (Task 4)
   │  ├─ layout/                           # sidebar, topbar, breadcrumbs, command-palette, theme-toggle
   │  └─ common/                           # page-header, empty-state
   ├─ hooks/    use-admin-auth.ts  use-idle-timeout.ts
   ├─ lib/      env.ts  cn.ts  api.ts  query-keys.ts  nav.ts
   └─ styles/   globals.css
   └─ types/    api.ts
```

---

### Task 1: Scaffold the Admin app + toolchain + botanical theme

Creates the whole `Admin/` project skeleton so `npm install`, `npm run build`, and `npm run typecheck` succeed and the dev server boots on 3001. No app UI yet beyond a placeholder page.

**Files (all under `Admin/`):**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `.env.example`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `components.json`, `next-env.d.ts` (generated by build)
- Create: `src/lib/cn.ts`, `src/styles/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: a buildable Next.js app; `cn(...)` helper; the theme in `globals.css`. Every later task depends on this skeleton.

- [ ] **Step 1: Create `Admin/package.json`**

```json
{
  "name": "woodhouse-admin",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": "20.x"
  },
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "node --import tsx --test --test-reporter=spec $(find src -name '*.test.ts' -type f | sort)"
  },
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-dropdown-menu": "^2.1.2",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-slot": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.3",
    "@tanstack/react-query": "^5.51.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "cmdk": "^1.0.0",
    "lucide-react": "^0.408.0",
    "next": "14.2.5",
    "next-themes": "^0.3.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.52.1",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.4.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.10",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.5",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "tsx": "^4.16.2",
    "typescript": "^5.5.3"
  }
}
```

Note: `@radix-ui/react-dialog` backs both the `sheet.tsx` (mobile sidebar) and `dialog.tsx` (command palette container) primitives in Task 4 — it is already in the dependency list above. No other Radix Dialog wrapper (e.g. `vaul`) is needed.

- [ ] **Step 2: Confirm the dependency set**

Read back the `dependencies` block and confirm every Radix package the Task 4 primitives import is present: `react-avatar`, `react-dialog`, `react-dropdown-menu`, `react-label`, `react-separator`, `react-slot`, `react-tooltip`. If any is missing, add it before installing.

- [ ] **Step 3: Create toolchain config files**

`Admin/.nvmrc`:
```
20
```

`Admin/.gitignore`:
```
node_modules
.next
out
.env
.env.local
next-env.d.ts
*.tsbuildinfo
.DS_Store
```

`Admin/postcss.config.js`:
```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`Admin/next.config.mjs`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
```

`Admin/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "forceConsistentCasingInFileNames": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`Admin/components.json` (shadcn config, New York style, so hand-authored components in Task 4 match):
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui",
    "hooks": "@/hooks",
    "lib": "@/lib"
  }
}
```

`Admin/.env.example`:
```
# Admin app — public config only (NEXT_PUBLIC_*). No secrets here.
# The NestJS API origin. Dev backend runs on 4000.
NEXT_PUBLIC_API_URL=http://localhost:4000
# This admin app's own public URL (used for absolute links, metadata).
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

- [ ] **Step 4: Create `src/lib/cn.ts`**

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Create `src/styles/globals.css`**

Paste the entire CSS block from the plan's **Design System** section verbatim (the `@tailwind` directives, `:root`, `.dark`, and the two `@layer base` blocks).

- [ ] **Step 6: Create `src/app/layout.tsx`** (minimal; fonts + Providers wired in Task 5)

```tsx
import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Wood House Herbals — Admin',
  description: 'Store management for Wood House Herbals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create `src/app/page.tsx`** (placeholder; replaced by redirect logic later)

```tsx
export default function IndexPage() {
  return (
    <main className="grid min-h-screen place-items-center">
      <p className="text-muted-foreground">Wood House Herbals admin — loading…</p>
    </main>
  );
}
```

- [ ] **Step 8: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

- [ ] **Step 9: Install and verify**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm install`
Expected: creates `node_modules` + `package-lock.json`, no peer-dep errors that abort (warnings OK).

Run: `npm run build`
Expected: build succeeds (compiles the placeholder page). `next-env.d.ts` is generated.

Run: `npm run typecheck`
Expected: no errors.

Run (boot check): `npm run dev &` then `sleep 4 && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3001 && kill %1`
Expected: `200`.

- [ ] **Step 10: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin
git commit -m "feat(admin): scaffold Admin Next.js app with botanical shadcn theme"
```

(The commit includes `package-lock.json`; `.gitignore` keeps `node_modules`/`.next` out.)

---

### Task 2: Env accessor + query keys + API types

**Files:**
- Create: `Admin/src/lib/env.ts`, `Admin/src/lib/query-keys.ts`, `Admin/src/types/api.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `env: { apiUrl: string; siteUrl: string }` (frozen).
  - `qk` — query-key factory object (e.g. `qk.me`, `qk.dashboardStats`).
  - Types: `AdminUser { id: string; email: string | null; role: AdminRole }`, `AdminRole = 'ADMIN' | 'MANAGER' | 'STAFF'`, `AdminMeResponse`, `AdminLoginResponse`.

- [ ] **Step 1: Create `src/lib/env.ts`**

```ts
/**
 * Admin env accessor — the single point of NEXT_PUBLIC_* access.
 * Next.js inlines NEXT_PUBLIC_* at build time, so each var is read as a
 * literal `process.env.NEXT_PUBLIC_X` expression. Only public config lives
 * here (URLs); this app holds no server secrets.
 */
interface PublicEnv {
  apiUrl: string;
  siteUrl: string;
}

function readUrl(name: string, raw: string | undefined, fallback: string): string {
  const value = raw ?? fallback;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    throw new Error(`Admin env ${name} is not a valid URL: ${JSON.stringify(value)}`);
  }
  return value;
}

const raw = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
};

export const env: PublicEnv = Object.freeze({
  apiUrl: readUrl('NEXT_PUBLIC_API_URL', raw.apiUrl, 'http://localhost:4000'),
  siteUrl: readUrl('NEXT_PUBLIC_SITE_URL', raw.siteUrl, 'http://localhost:3001'),
});

export type { PublicEnv };
```

- [ ] **Step 2: Create `src/types/api.ts`**

```ts
/** Roles that may use the admin panel. CUSTOMER is rejected at login. */
export type AdminRole = 'ADMIN' | 'MANAGER' | 'STAFF';

/** Shape returned by GET /api/auth/me. */
export interface AdminMeResponse {
  id: string;
  email: string | null;
  role: AdminRole | 'CUSTOMER';
}

/** Shape returned by POST /api/auth/admin-login. */
export interface AdminLoginResponse {
  user: {
    id: string;
    email: string | null;
    fullName: string;
    role: AdminRole;
  };
}

/** The signed-in admin as the app models it (post role-gate). */
export interface AdminUser {
  id: string;
  email: string | null;
  role: AdminRole;
}
```

- [ ] **Step 3: Create `src/lib/query-keys.ts`**

```ts
/**
 * Central react-query key factory. Every query/mutation references a key
 * from here so invalidations stay consistent across the app.
 */
export const qk = {
  me: ['auth', 'me'] as const,
  dashboardStats: ['dashboard', 'stats'] as const,
};
```

- [ ] **Step 4: Gates and commit**

Run: `npm run typecheck && npm run build`
Expected: both pass.

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/lib/env.ts Admin/src/lib/query-keys.ts Admin/src/types/api.ts
git commit -m "feat(admin): env accessor, query-key factory, and API types"
```

---

### Task 3: Typed API client with 401→refresh→retry

The one integration seam. Mirrors the storefront's `ApiError` + fetch wrapper, adds a single automatic refresh-and-retry on 401 (admin sessions are long-lived; the 15-min access token WILL expire mid-session), and deliberately omits `withFallback`.

**Files:**
- Create: `Admin/src/lib/api.ts`
- Create: `Admin/src/lib/api.test.ts`

**Interfaces:**
- Consumes: `env` (Task 2), types from `@/types/api`.
- Produces:
  - `class ApiError extends Error { status: number }`
  - `api` object: `api.auth.adminLogin(...)`, `api.auth.me()`, `api.auth.logout()`, `api.auth.refresh()`, `api.auth.forgotPassword(email)`, `api.auth.resetPassword({token,password})`, `api.uploads.sign(folder)`.
  - `shouldAttemptRefresh(status, path): boolean` — pure, exported for testing.

- [ ] **Step 1: Write the failing test**

Create `Admin/src/lib/api.test.ts`:

```ts
/**
 * Pure unit tests for the API client's refresh-decision logic. No network.
 * Run this file alone: npx tsx --test src/lib/api.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAttemptRefresh } from './api';

test('a 401 on a normal call triggers a refresh attempt', () => {
  assert.equal(shouldAttemptRefresh(401, '/admin/products'), true);
});

test('a 401 on the refresh call itself does NOT recurse', () => {
  assert.equal(shouldAttemptRefresh(401, '/auth/refresh'), false);
});

test('a 401 on login does NOT trigger a refresh (bad credentials, not stale token)', () => {
  assert.equal(shouldAttemptRefresh(401, '/auth/admin-login'), false);
});

test('non-401 statuses never trigger a refresh', () => {
  assert.equal(shouldAttemptRefresh(403, '/admin/products'), false);
  assert.equal(shouldAttemptRefresh(500, '/admin/products'), false);
  assert.equal(shouldAttemptRefresh(200, '/admin/products'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npx tsx --test src/lib/api.test.ts`
Expected: FAIL — `Cannot find module './api'`.

- [ ] **Step 3: Implement `src/lib/api.ts`**

```ts
/**
 * Typed HTTP client for the Wood House Herbals admin panel.
 *
 * Differences from the storefront client:
 *  - NO withFallback: the admin surfaces API failures, never masks them.
 *  - A single automatic 401 → POST /auth/refresh → retry-once. Admin
 *    sessions outlive the 15-min access token; this keeps active sessions
 *    alive without the user seeing a logout. The refresh cookie is rotated
 *    by the backend (Phase A). If refresh itself fails, the original 401
 *    propagates and the auth layer redirects to /login.
 */
import { env } from './env';
import type { AdminLoginResponse, AdminMeResponse } from '@/types/api';

const API_BASE = `${env.apiUrl}/api`;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Decide whether a failed response should trigger one refresh+retry.
 * Only 401s, and never for the refresh call itself or the login call
 * (a 401 there means bad credentials, not a stale access token).
 */
export function shouldAttemptRefresh(status: number, path: string): boolean {
  if (status !== 401) return false;
  if (path.startsWith('/auth/refresh')) return false;
  if (path.startsWith('/auth/admin-login')) return false;
  if (path.startsWith('/auth/login')) return false;
  return true;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (body?.message) {
      message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
    }
  } catch {
    /* non-JSON error body — keep the status-based message */
  }
  return new ApiError(res.status, message);
}

async function rawRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await rawRequest(method, path, body);

  if (!res.ok && shouldAttemptRefresh(res.status, path)) {
    const refreshed = await rawRequest('POST', '/auth/refresh');
    if (refreshed.ok) {
      res = await rawRequest(method, path, body);
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  auth: {
    adminLogin: (data: { email: string; password: string }) =>
      request<AdminLoginResponse>('POST', '/auth/admin-login', data),
    me: () => request<AdminMeResponse>('GET', '/auth/me'),
    logout: () => request<void>('POST', '/auth/logout'),
    refresh: () => request<{ ok: true }>('POST', '/auth/refresh'),
    forgotPassword: (email: string) =>
      request<{ ok: true }>('POST', '/auth/forgot-password', { email }),
    resetPassword: (data: { token: string; password: string }) =>
      request<{ ok: true }>('POST', '/auth/reset-password', data),
  },
  uploads: {
    sign: (folder: 'products' | 'banners' | 'content') =>
      request<{
        cloudName: string;
        apiKey: string;
        timestamp: number;
        folder: string;
        signature: string;
        uploadUrl: string;
      }>('POST', '/admin/uploads/sign', { folder }),
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/lib/api.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Gates and commit**

Run: `npm run typecheck && npm run build && npm run test`
Expected: all pass; test count 4.

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/lib/api.ts Admin/src/lib/api.test.ts
git commit -m "feat(admin): typed API client with 401 refresh-and-retry"
```

---

### Task 4: shadcn/ui primitives (New York style)

Hand-author the base component set the shell uses. These are the canonical shadcn/ui New York components, adapted only in that `cn` imports from `@/lib/cn`. Provide each file exactly as below.

**Files (all under `Admin/src/components/ui/`):**
- Create: `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `badge.tsx`, `separator.tsx`, `skeleton.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, `sheet.tsx`, `tooltip.tsx`, `command.tsx`, `sonner.tsx`

**Interfaces:**
- Consumes: `cn` (Task 1), Radix packages + `cmdk` + `sonner` + `next-themes` (Task 1 deps).
- Produces: the primitives every later component imports (`Button`, `Input`, `Label`, `Card*`, `Badge`, `Separator`, `Skeleton`, `Avatar*`, `DropdownMenu*`, `Sheet*`, `Tooltip*`, `Command*`, `Toaster`).

- [ ] **Step 1: `button.tsx`**

```tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
```

- [ ] **Step 2: `input.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
```

- [ ] **Step 3: `label.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const labelVariants = cva(
  'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

- [ ] **Step 4: `card.tsx`**

```tsx
import * as React from 'react';
import { cn } from '@/lib/cn';

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  ),
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
```

- [ ] **Step 5: `badge.tsx`**

```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-destructive-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
```

- [ ] **Step 6: `separator.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import { cn } from '@/lib/cn';

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
      className,
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
```

- [ ] **Step 7: `skeleton.tsx`**

```tsx
import { cn } from '@/lib/cn';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
```

- [ ] **Step 8: `avatar.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/cn';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square h-full w-full', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium', className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
```

- [ ] **Step 9: `dropdown-menu.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & { inset?: boolean }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:size-4',
      inset && 'pl-8',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-muted', className)} {...props} />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
```

- [ ] **Step 10: `sheet.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName;

const sheetVariants = cva(
  'fixed z-50 gap-4 bg-background p-6 shadow-lg transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
        bottom: 'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right: 'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = 'right', className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
      {children}
      <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn('text-lg font-semibold text-foreground', className)} {...props} />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
```

- [ ] **Step 11: `tooltip.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
```

- [ ] **Step 12: `command.tsx`**

```tsx
'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn('flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground', className)}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

const CommandDialog = ({ children, ...props }: React.ComponentProps<typeof Dialog>) => (
  <Dialog {...props}>
    <DialogContent className="overflow-hidden p-0">
      <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
        {children}
      </Command>
    </DialogContent>
  </Dialog>
);

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List ref={ref} className={cn('max-h-[300px] overflow-y-auto overflow-x-hidden', className)} {...props} />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />);
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground',
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator ref={ref} className={cn('-mx-1 h-px bg-border', className)} {...props} />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />
);
CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
```

Note: `command.tsx` imports `Dialog`/`DialogContent` from `@/components/ui/dialog`. Create `dialog.tsx` too (Step 13).

- [ ] **Step 13: `dialog.tsx`**

```tsx
'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
};
```

- [ ] **Step 14: `sonner.tsx`** (Toaster wired to next-themes)

```tsx
'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();
  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
```

- [ ] **Step 15: Gates and commit**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build`
Expected: both pass (unused components are fine; Next tree-shakes).

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/components/ui
git commit -m "feat(admin): shadcn/ui primitives (button, inputs, menus, sheet, command, toaster)"
```

---

### Task 5: Providers + root layout with fonts + theme toggle

**Files:**
- Create: `Admin/src/app/providers.tsx`, `Admin/src/components/layout/theme-toggle.tsx`
- Modify: `Admin/src/app/layout.tsx`

**Interfaces:**
- Consumes: `Toaster` (Task 4), `TooltipProvider` (Task 4), `Button`, `DropdownMenu*` (Task 4).
- Produces: `Providers` (QueryClient + next-themes + Tooltip + Toaster), `ThemeToggle` component, fonts wired (`--font-sans` = Inter, `--font-display` = Fraunces).

- [ ] **Step 1: Create `src/app/providers.tsx`**

```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30 * 1000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-right" richColors closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import '@/styles/globals.css';
import { cn } from '@/lib/cn';
import { Providers } from './providers';

const fontSans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

// Fraunces is a variable font — do NOT pass both `weight` and `axes`
// (next/font/google rejects the combination). Loading it with only
// `variable` gives the full weight range, which is all the display face needs.
const fontDisplay = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: { default: 'Wood House Herbals — Admin', template: '%s · WHH Admin' },
  description: 'Store management for Wood House Herbals.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(fontSans.variable, fontDisplay.variable, 'font-sans antialiased')}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create `src/components/layout/theme-toggle.tsx`**

```tsx
'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          <Sun className="h-[1.15rem] w-[1.15rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.15rem] w-[1.15rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Gates and manual theme check**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build`
Expected: both pass.

Manual: `npm run dev &` then open `http://localhost:3001` — the placeholder page renders with the Inter font and background token; no console errors. `kill %1` after.

- [ ] **Step 5: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/app/providers.tsx Admin/src/app/layout.tsx Admin/src/components/layout/theme-toggle.tsx
git commit -m "feat(admin): providers (query, theme, toaster), fonts, and theme toggle"
```

---

### Task 6: Auth hooks + login/forgot/reset pages + middleware

**Files:**
- Create: `Admin/src/hooks/use-admin-auth.ts`
- Create: `Admin/src/middleware.ts`
- Create: `Admin/src/app/(auth)/login/page.tsx`, `Admin/src/app/(auth)/forgot/page.tsx`, `Admin/src/app/(auth)/reset/page.tsx`
- Create: `Admin/src/app/(auth)/layout.tsx`

**Interfaces:**
- Consumes: `api` (Task 3), `qk` (Task 2), `AdminUser`/`AdminMeResponse` (Task 2), UI primitives (Task 4).
- Produces:
  - `useAdminUser()` — react-query over `GET /auth/me`, returns `AdminUser | null` (null when logged out OR role is CUSTOMER).
  - `useAdminLogin()` — mutation over `POST /auth/admin-login`, invalidates `qk.me`.
  - `useLogout()` — mutation over `POST /auth/logout`, clears `qk.me`.
  - Login/forgot/reset pages. Middleware that redirects `/` and `/(dashboard)/*` to `/login` when the access cookie is absent.

- [ ] **Step 1: Create `src/hooks/use-admin-auth.ts`**

```ts
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { AdminUser } from '@/types/api';

/**
 * The signed-in admin, or null when logged out / session expired / the
 * account is a CUSTOMER (which must never see the admin UI). Every guarded
 * surface reads this one query.
 */
export function useAdminUser() {
  return useQuery<AdminUser | null>({
    queryKey: qk.me,
    queryFn: async () => {
      try {
        const me = await api.auth.me();
        if (me.role === 'CUSTOMER') return null;
        return { id: me.id, email: me.email, role: me.role };
      } catch {
        return null;
      }
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => api.auth.adminLogin(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } catch {
        /* cookie may already be gone — treat as logged out */
      }
    },
    onSettled: () => {
      queryClient.setQueryData(qk.me, null);
      queryClient.invalidateQueries({ queryKey: qk.me });
    },
  });
}
```

- [ ] **Step 2: Create `src/middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';

// The access-token cookie set by the backend (Phase A). Its mere presence
// gates entry to the app shell; the real role check happens in the
// dashboard layout via GET /auth/me. When it's absent we skip rendering the
// protected tree and send the user to /login.
const ACCESS_COOKIE = 'wh_at';
const REFRESH_COOKIE = 'wh_rt';

const PUBLIC_PREFIXES = ['/login', '/forgot', '/reset'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession =
    req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);

  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

Note: `matcher` string must be a single line in the file (no wrapping). The access cookie is httpOnly but middleware runs server-side and can read it. Presence is a cheap gate; a stale/expired token still passes here and is caught by the dashboard layout's `/auth/me` call (Task 7), which triggers the client refresh-retry or redirect.

- [ ] **Step 3: Create `src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
```

- [ ] **Step 4: Create `src/app/(auth)/login/page.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { toast } from 'sonner';
import { Leaf } from 'lucide-react';
import { useAdminLogin } from '@/hooks/use-admin-auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAdminLogin();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await login.mutateAsync(values);
      router.replace('/');
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 401
          ? 'Invalid email or password.'
          : 'Something went wrong. Please try again.';
      toast.error(message);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Leaf className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Wood House Herbals</h1>
        <p className="text-sm text-muted-foreground">Sign in to the store admin.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" autoFocus {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/(auth)/forgot/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({ email: z.string().email('Enter a valid email address') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    // The backend answers identically whether or not the email exists, so we
    // always show the same confirmation (no account enumeration).
    try {
      await api.auth.forgotPassword(values.email);
    } catch {
      /* ignore — same confirmation regardless */
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="font-display text-2xl font-semibold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If that address has an admin account, a password reset link is on its way.
        </p>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted-foreground">We'll email you a reset link.</p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" autoFocus {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/(auth)/reset/page.tsx`**

```tsx
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z
  .object({
    password: z.string().min(10, 'Use at least 10 characters'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
type FormValues = z.infer<typeof schema>;

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await api.auth.resetPassword({ token, password: values.password });
      setDone(true);
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not reset your password. Try again.';
      toast.error(message);
    }
  }

  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="font-display text-2xl font-semibold">Invalid link</h1>
        <p className="text-sm text-muted-foreground">This reset link is missing its token.</p>
        <Link href="/forgot" className="inline-block text-sm text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="font-display text-2xl font-semibold">Password updated</h1>
        <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" autoComplete="new-password" autoFocus {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" autoComplete="new-password" {...register('confirm')} />
          {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
      <ResetForm />
    </Suspense>
  );
}
```

- [ ] **Step 7: Gates and manual verification**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build`
Expected: both pass.

Manual (needs backend running on 4000): start `Backend` with `npm run start:dev`; start `Admin` with `npm run dev`. Visit `http://localhost:3001` → redirected to `/login`. Sign in with `owner@woodhouseherbals.test` / `Adm1n!Passw0rd#2026` → redirects to `/` (which will 404 until Task 7's dashboard exists — acceptable at this step; confirm the network tab shows `admin-login` 200 + `me` 200). Sign in with a wrong password → toast "Invalid email or password." Kill both servers.

- [ ] **Step 8: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/hooks/use-admin-auth.ts Admin/src/middleware.ts "Admin/src/app/(auth)"
git commit -m "feat(admin): admin auth hooks, login/forgot/reset pages, and route middleware"
```

---

### Task 7: Dashboard layout — auth guard + role gate + idle timeout

**Files:**
- Create: `Admin/src/hooks/use-idle-timeout.ts`
- Create: `Admin/src/hooks/use-idle-timeout.test.ts`
- Create: `Admin/src/app/(dashboard)/layout.tsx`
- Create: `Admin/src/app/(dashboard)/loading.tsx`

**Interfaces:**
- Consumes: `useAdminUser`, `useLogout` (Task 6), UI primitives.
- Produces:
  - `useIdleTimeout({ timeoutMs, onIdle })` — resets on pointer/keyboard/visibility activity; calls `onIdle` after inactivity. Pure timing core `nextDeadline(now, timeoutMs)` exported for test.
  - The protected `(dashboard)/layout.tsx`: shows a skeleton while `me` loads, redirects to `/login` when `me` is null, renders `children` inside a placeholder shell (sidebar/topbar arrive in Task 8), and mounts the 30-minute idle timeout (logout + redirect).

- [ ] **Step 1: Write the failing test**

Create `Admin/src/hooks/use-idle-timeout.test.ts`:

```ts
/**
 * Pure unit tests for the idle-timeout deadline math. No React, no timers.
 * Run this file alone: npx tsx --test src/hooks/use-idle-timeout.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextDeadline, THIRTY_MINUTES_MS } from './use-idle-timeout';

test('deadline is now + timeout', () => {
  assert.equal(nextDeadline(1_000, 5_000), 6_000);
});

test('the default admin idle window is 30 minutes', () => {
  assert.equal(THIRTY_MINUTES_MS, 30 * 60 * 1000);
});

test('activity later pushes the deadline out', () => {
  const first = nextDeadline(0, THIRTY_MINUTES_MS);
  const afterActivity = nextDeadline(60_000, THIRTY_MINUTES_MS);
  assert.ok(afterActivity > first);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npx tsx --test src/hooks/use-idle-timeout.test.ts`
Expected: FAIL — `Cannot find module './use-idle-timeout'`.

- [ ] **Step 3: Create `src/hooks/use-idle-timeout.ts`**

```ts
'use client';

import { useEffect, useRef } from 'react';

export const THIRTY_MINUTES_MS = 30 * 60 * 1000;

/** The absolute time (ms epoch) at which the session goes idle. Pure. */
export function nextDeadline(now: number, timeoutMs: number): number {
  return now + timeoutMs;
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Calls `onIdle` after `timeoutMs` of no user activity. Any pointer/keyboard
 * activity, or the tab becoming visible, resets the timer. Activity is
 * throttled so a burst of events doesn't reset on every frame.
 */
export function useIdleTimeout({
  timeoutMs,
  onIdle,
}: {
  timeoutMs: number;
  onIdle: () => void;
}) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let lastReset = 0;

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return; // throttle
      lastReset = now;
      arm();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') arm();
    };

    arm();
    for (const evt of ACTIVITY_EVENTS) window.addEventListener(evt, onActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [timeoutMs]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test src/hooks/use-idle-timeout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create `src/app/(dashboard)/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-52" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/(dashboard)/layout.tsx`** (shell placeholder; sidebar/topbar added in Task 8)

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAdminUser, useLogout } from '@/hooks/use-admin-auth';
import { useIdleTimeout, THIRTY_MINUTES_MS } from '@/hooks/use-idle-timeout';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useAdminUser();
  const logout = useLogout();

  // Redirect to /login once we know there's no valid admin session.
  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useIdleTimeout({
    timeoutMs: THIRTY_MINUTES_MS,
    onIdle: () => {
      if (!user) return;
      void logout.mutateAsync().finally(() => {
        toast.info('Signed out after 30 minutes of inactivity.');
        router.replace('/login');
      });
    },
  });

  if (isLoading || !user) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Task 8 replaces this placeholder wrapper with the sidebar + topbar shell.
  return (
    <div className="min-h-screen bg-background" data-admin-role={user.role}>
      {children}
    </div>
  );
}
```

- [ ] **Step 7: Gates**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build && npm run test`
Expected: all pass; test count 7 (4 from api.test + 3 from idle).

- [ ] **Step 8: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/hooks/use-idle-timeout.ts Admin/src/hooks/use-idle-timeout.test.ts "Admin/src/app/(dashboard)/layout.tsx" "Admin/src/app/(dashboard)/loading.tsx"
git commit -m "feat(admin): protected dashboard layout with role gate and 30-min idle timeout"
```

---

### Task 8: Sidebar + topbar + breadcrumbs

**Files:**
- Create: `Admin/src/lib/nav.ts`
- Create: `Admin/src/components/layout/sidebar.tsx`
- Create: `Admin/src/components/layout/topbar.tsx`
- Create: `Admin/src/components/layout/breadcrumbs.tsx`
- Create: `Admin/src/components/layout/user-menu.tsx`
- Modify: `Admin/src/app/(dashboard)/layout.tsx` (replace the placeholder wrapper with the real shell)

**Interfaces:**
- Consumes: `useAdminUser`/`useLogout` (Task 6), UI primitives (Task 4), `ThemeToggle` (Task 5).
- Produces:
  - `NAV_SECTIONS: NavItem[]` (`{ label, href, icon }`) — the 13-item nav, shared by sidebar + command palette (Task 9).
  - `Sidebar`, `Topbar`, `Breadcrumbs`, `UserMenu` components; the dashboard layout renders the full shell.

- [ ] **Step 1: Create `src/lib/nav.ts`**

```ts
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  TicketPercent,
  Boxes,
  Star,
  LayoutTemplate,
  Megaphone,
  BarChart3,
  Truck,
  Settings,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** The 13 admin sections, in sidebar order. Shared with the command palette. */
export const NAV_SECTIONS: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Products', href: '/products', icon: Package },
  { label: 'Categories', href: '/categories', icon: FolderTree },
  { label: 'Orders', href: '/orders', icon: ShoppingCart },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Coupons', href: '/coupons', icon: TicketPercent },
  { label: 'Inventory', href: '/inventory', icon: Boxes },
  { label: 'Reviews', href: '/reviews', icon: Star },
  { label: 'Content', href: '/content', icon: LayoutTemplate },
  { label: 'Marketing', href: '/marketing', icon: Megaphone },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Shipping', href: '/shipping', icon: Truck },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/** True when `pathname` is within `href` (exact for '/', prefix otherwise). */
export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 2: Create `src/components/layout/sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_SECTIONS, isActive } from '@/lib/nav';

/** Shared nav list — used by the desktop rail and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-2">
      {NAV_SECTIONS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-full before:bg-primary'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            )}
          >
            <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Fixed desktop sidebar (hidden below lg; the topbar renders the mobile sheet). */
export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-card lg:flex lg:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Leaf className="h-4 w-4" />
        </span>
        <span className="font-display text-base font-semibold leading-none">Wood House</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Create `src/components/layout/breadcrumbs.tsx`**

```tsx
'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { NAV_SECTIONS } from '@/lib/nav';

/** Section title for the current path, from the nav config (fallback: prettified segment). */
function currentSection(pathname: string): { label: string; href: string } {
  const top = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
  const match = NAV_SECTIONS.find((n) => n.href === (pathname === '/' ? '/' : top));
  if (match) return match;
  const seg = pathname.split('/').filter(Boolean)[0] ?? 'Admin';
  return { label: seg.charAt(0).toUpperCase() + seg.slice(1), href: top };
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const section = currentSection(pathname);
  const onSubPage = pathname !== section.href && section.href !== '/';

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link href="/" className="text-muted-foreground hover:text-foreground">
        Admin
      </Link>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      {onSubPage ? (
        <Fragment>
          <Link href={section.href} className="text-muted-foreground hover:text-foreground">
            {section.label}
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          <span className="font-medium text-foreground">Details</span>
        </Fragment>
      ) : (
        <span className="font-medium text-foreground">{section.label}</span>
      )}
    </nav>
  );
}
```

- [ ] **Step 4: Create `src/components/layout/user-menu.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAdminUser, useLogout } from '@/hooks/use-admin-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function initials(email: string | null): string {
  if (!email) return 'WH';
  return email.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const { data: user } = useAdminUser();
  const logout = useLogout();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-xs">{initials(user?.email ?? null)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm">{user?.email ?? 'Signed in'}</span>
          <span className="text-xs font-normal capitalize text-muted-foreground">
            {user?.role.toLowerCase()}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() =>
            void logout.mutateAsync().finally(() => router.replace('/login'))
          }
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Create `src/components/layout/topbar.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Menu, Leaf, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { UserMenu } from '@/components/layout/user-menu';
import { SidebarNav } from '@/components/layout/sidebar';

export function Topbar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      {/* Mobile nav trigger */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-14 items-center gap-2 border-b px-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Leaf className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-semibold">Wood House</span>
          </div>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="hidden lg:block">
        <Breadcrumbs />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenCommand}
          className="hidden gap-2 text-muted-foreground sm:flex"
        >
          <Search className="h-4 w-4" />
          <span>Search</span>
          <kbd className="pointer-events-none ml-2 hidden rounded border bg-muted px-1.5 font-mono text-[10px] md:inline">
            ⌘K
          </kbd>
        </Button>
        <Button variant="ghost" size="icon" onClick={onOpenCommand} className="sm:hidden" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
```

- [ ] **Step 6: Rewrite `src/app/(dashboard)/layout.tsx`** to render the real shell (command palette wiring is completed in Task 9 — for now `onOpenCommand` is a no-op placeholder state)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAdminUser, useLogout } from '@/hooks/use-admin-auth';
import { useIdleTimeout, THIRTY_MINUTES_MS } from '@/hooks/use-idle-timeout';
import { Skeleton } from '@/components/ui/skeleton';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading } = useAdminUser();
  const logout = useLogout();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  useIdleTimeout({
    timeoutMs: THIRTY_MINUTES_MS,
    onIdle: () => {
      if (!user) return;
      void logout.mutateAsync().finally(() => {
        toast.info('Signed out after 30 minutes of inactivity.');
        router.replace('/login');
      });
    },
  });

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-60 border-r bg-card lg:block" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenCommand={() => setCommandOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
      {/* CommandPalette is mounted here in Task 9, controlled by commandOpen/setCommandOpen. */}
      {commandOpen ? null : null}
    </div>
  );
}
```

- [ ] **Step 7: Gates and manual verification**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build`
Expected: both pass (the `commandOpen` state is intentionally inert until Task 9; a lint "unused" note is acceptable — it's referenced by the placeholder).

Manual (backend running): log in, land on `/` — the sidebar (13 items, Dashboard active), topbar (breadcrumb "Admin › Dashboard", Search button, theme toggle, avatar) render. Resize below `lg`: sidebar collapses, the menu button opens the mobile sheet. Toggle theme: both light/dark render correctly. Sign out from the avatar menu → back to `/login`.

- [ ] **Step 8: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/lib/nav.ts Admin/src/components/layout "Admin/src/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): sidebar, topbar, breadcrumbs, and user menu shell"
```

---

### Task 9: Command palette (Cmd+K) + shortcuts

**Files:**
- Create: `Admin/src/components/layout/command-palette.tsx`
- Modify: `Admin/src/app/(dashboard)/layout.tsx` (mount the palette, wire the global Cmd+K / Cmd+N shortcuts)

**Interfaces:**
- Consumes: `Command*`/`CommandDialog` (Task 4), `NAV_SECTIONS` (Task 8).
- Produces: `CommandPalette({ open, onOpenChange })` — a searchable jump-to-section palette; global `⌘K`/`Ctrl+K` toggles it and `⌘N`/`Ctrl+N` jumps to new-product.

- [ ] **Step 1: Create `src/components/layout/command-palette.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { PlusCircle } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { NAV_SECTIONS } from '@/lib/nav';

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search sections and actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => go('/products/new')}>
            <PlusCircle className="h-4 w-4" />
            Add new product
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {NAV_SECTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                <Icon className="h-4 w-4" />
                {item.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 2: Wire shortcuts + mount the palette in `src/app/(dashboard)/layout.tsx`**

Add the import near the other layout imports:

```tsx
import { CommandPalette } from '@/components/layout/command-palette';
```

Add this effect inside `DashboardLayout`, directly after the `useIdleTimeout({...})` call:

```tsx
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
      if (meta && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        router.push('/products/new');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);
```

Replace the placeholder line `{commandOpen ? null : null}` with:

```tsx
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
```

- [ ] **Step 3: Gates and manual verification**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build`
Expected: both pass.

Manual (backend running, logged in): press `⌘K` (or `Ctrl+K`) → palette opens; type "ord" → Orders filters in; Enter → navigates to `/orders`. Press `⌘N` → navigates to `/products/new` (404 body until Phase D — the route push is what's verified). The topbar Search button also opens it.

- [ ] **Step 4: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/components/layout/command-palette.tsx "Admin/src/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): command palette with Cmd+K navigation and Cmd+N shortcut"
```

---

### Task 10: Stub pages + reusable PageHeader & EmptyState

All 13 sections get a real route with a page header and a designed empty state, so the shell is fully navigable and each later phase drops its real content into a page that already exists.

**Files:**
- Create: `Admin/src/components/common/page-header.tsx`
- Create: `Admin/src/components/common/empty-state.tsx`
- Create the 13 pages under `Admin/src/app/(dashboard)/`:
  `page.tsx` (Dashboard), `products/page.tsx`, `categories/page.tsx`, `orders/page.tsx`, `customers/page.tsx`, `coupons/page.tsx`, `inventory/page.tsx`, `reviews/page.tsx`, `content/page.tsx`, `marketing/page.tsx`, `analytics/page.tsx`, `shipping/page.tsx`, `settings/page.tsx`

**Interfaces:**
- Consumes: UI primitives (Task 4), `NAV_SECTIONS` icons (Task 8).
- Produces: `PageHeader({ title, description, action? })`, `EmptyState({ icon, title, description, action? })`, and 13 rendered routes.

- [ ] **Step 1: Create `src/components/common/page-header.tsx`**

```tsx
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/common/empty-state.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3: Create the Dashboard page `src/app/(dashboard)/page.tsx`**

```tsx
import { LayoutDashboard } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function DashboardPage() {
  return (
    <div>
      <PageHeader title="Dashboard" description="Your store at a glance." />
      <EmptyState
        icon={LayoutDashboard}
        title="Metrics arrive with your first orders"
        description="Sales, orders, low-stock alerts, and top products will appear here once the store is live. This section is built in the next phase."
      />
    </div>
  );
}
```

- [ ] **Step 4: Create the 12 section pages**

Each page follows the same shape: a `PageHeader` and an `EmptyState` whose copy is written for that section (invitation to act, not filler). Create each file exactly as given.

`src/app/(dashboard)/products/page.tsx`:
```tsx
import { Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';

export default function ProductsPage() {
  return (
    <div>
      <PageHeader
        title="Products"
        description="Your catalog — herbal skincare, combos, and everything you sell."
        action={
          <Button asChild>
            <Link href="/products/new">
              <Plus className="h-4 w-4" />
              Add product
            </Link>
          </Button>
        }
      />
      <EmptyState
        icon={Package}
        title="No products yet"
        description="Add your first product to start building the catalog. The full product editor lands in a later phase."
        action={
          <Button asChild>
            <Link href="/products/new">
              <Plus className="h-4 w-4" />
              Add product
            </Link>
          </Button>
        }
      />
    </div>
  );
}
```

`src/app/(dashboard)/categories/page.tsx`:
```tsx
import { FolderTree } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function CategoriesPage() {
  return (
    <div>
      <PageHeader title="Categories" description="Organize your catalog into shoppable groups." />
      <EmptyState
        icon={FolderTree}
        title="No categories yet"
        description="Group products into categories like Face Wash, Serum, or Scrub. Category management arrives in a later phase."
      />
    </div>
  );
}
```

`src/app/(dashboard)/orders/page.tsx`:
```tsx
import { ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function OrdersPage() {
  return (
    <div>
      <PageHeader title="Orders" description="Track and fulfill customer orders." />
      <EmptyState
        icon={ShoppingCart}
        title="No orders yet"
        description="When customers check out, their orders show up here for you to process, ship, and track."
      />
    </div>
  );
}
```

`src/app/(dashboard)/customers/page.tsx`:
```tsx
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function CustomersPage() {
  return (
    <div>
      <PageHeader title="Customers" description="Everyone who shops with Wood House Herbals." />
      <EmptyState
        icon={Users}
        title="No customers yet"
        description="Customer profiles, order history, and segments will appear here as people sign up and buy."
      />
    </div>
  );
}
```

`src/app/(dashboard)/coupons/page.tsx`:
```tsx
import { TicketPercent } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function CouponsPage() {
  return (
    <div>
      <PageHeader title="Coupons & discounts" description="Run promotions and reward loyal shoppers." />
      <EmptyState
        icon={TicketPercent}
        title="No coupons yet"
        description="Create percentage, fixed-amount, or free-shipping codes. Coupon management arrives in a later phase."
      />
    </div>
  );
}
```

`src/app/(dashboard)/inventory/page.tsx`:
```tsx
import { Boxes } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function InventoryPage() {
  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels and low-stock alerts across your catalog." />
      <EmptyState
        icon={Boxes}
        title="Nothing to track yet"
        description="Once you add products, their stock levels and movement history show up here."
      />
    </div>
  );
}
```

`src/app/(dashboard)/reviews/page.tsx`:
```tsx
import { Star } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function ReviewsPage() {
  return (
    <div>
      <PageHeader title="Reviews" description="Moderate and reply to customer reviews." />
      <EmptyState
        icon={Star}
        title="No reviews yet"
        description="Customer reviews will land here for you to approve, reject, or reply to."
      />
    </div>
  );
}
```

`src/app/(dashboard)/content/page.tsx`:
```tsx
import { LayoutTemplate } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function ContentPage() {
  return (
    <div>
      <PageHeader title="Content" description="Homepage banners, sections, and store pages." />
      <EmptyState
        icon={LayoutTemplate}
        title="Nothing to edit yet"
        description="Manage hero banners, the offer strip, testimonials, and policy pages here. Content tools arrive in a later phase."
      />
    </div>
  );
}
```

`src/app/(dashboard)/marketing/page.tsx`:
```tsx
import { Megaphone } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function MarketingPage() {
  return (
    <div>
      <PageHeader title="Marketing" description="Email, SMS, and WhatsApp campaigns." />
      <EmptyState
        icon={Megaphone}
        title="No campaigns yet"
        description="Reach customers with campaigns and recover abandoned carts. Marketing tools arrive in a later phase."
      />
    </div>
  );
}
```

`src/app/(dashboard)/analytics/page.tsx`:
```tsx
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader title="Analytics" description="Revenue, best sellers, and customer trends." />
      <EmptyState
        icon={BarChart3}
        title="No data to chart yet"
        description="Once orders start coming in, revenue and product performance appear here."
      />
    </div>
  );
}
```

`src/app/(dashboard)/shipping/page.tsx`:
```tsx
import { Truck } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function ShippingPage() {
  return (
    <div>
      <PageHeader title="Shipping" description="Zones, rates, and delivery estimates." />
      <EmptyState
        icon={Truck}
        title="No shipping rules yet"
        description="Set up shipping zones, rates, and a free-shipping threshold. Shipping settings arrive in a later phase."
      />
    </div>
  );
}
```

`src/app/(dashboard)/settings/page.tsx`:
```tsx
import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Store details, payments, integrations, and staff." />
      <EmptyState
        icon={Settings}
        title="Settings arrive in a later phase"
        description="Store info, payment configuration, integrations, and user roles will be managed here."
      />
    </div>
  );
}
```

- [ ] **Step 5: Gates and manual verification**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build`
Expected: both pass; the build output lists all 13 dashboard routes plus the 3 auth routes.

Manual (backend running, logged in): click through every sidebar item — each renders its header + empty state, the active nav indicator (green left bar + tinted bg) tracks the current section, and breadcrumbs update. `/products` shows the "Add product" action.

- [ ] **Step 6: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add Admin/src/components/common "Admin/src/app/(dashboard)"
git commit -m "feat(admin): 13 section stub pages with page headers and empty states"
```

---

### Task 11: admin-check CI job + Admin README + docs sync

**Files:**
- Modify: `.github/workflows/ci.yml` (repo root — add the `admin-check` job)
- Create: `Admin/README.md`

**Interfaces:**
- Consumes: the Admin app (all prior tasks).
- Produces: a CI job that installs, lints (soft), and builds the Admin app; a README with run instructions.

- [ ] **Step 1: Add the `admin-check` job to `.github/workflows/ci.yml`**

Insert this job directly after the `frontend-check` job (before the `backend-check` comment banner), matching the existing indentation:

```yaml
  # ────────────────────────────────────────────────────────────
  # Admin — Next.js admin panel
  # ────────────────────────────────────────────────────────────
  admin-check:
    name: admin · install · lint · build
    runs-on: ubuntu-latest
    timeout-minutes: 12
    defaults:
      run:
        working-directory: Admin
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: Admin/package-lock.json
      - name: Install
        run: npm ci --no-audit --no-fund
      - name: Lint (soft fail until the rules settle)
        run: npm run lint || true
      - name: Build
        env:
          NEXT_PUBLIC_API_URL: https://api.example.invalid
          NEXT_PUBLIC_SITE_URL: https://admin.example.invalid
        run: npm run build
```

- [ ] **Step 2: Create `Admin/README.md`**

```markdown
# Wood House Herbals — Admin

The store admin panel: a standalone Next.js 14 app that talks to the NestJS
API (`Backend/`) over cookie-based auth. Dev port **3001**.

## Prerequisites

- Node 20 (`.nvmrc`)
- The backend running on `http://localhost:4000` (`cd ../Backend && npm run start:dev`)
- A staff/admin account. Create one from `Backend/`:
  `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='…' npm run admin:create`

## Run

```bash
npm install
cp .env.example .env       # adjust NEXT_PUBLIC_API_URL if the backend isn't on :4000
npm run dev                # http://localhost:3001
```

## Scripts

- `npm run dev` — dev server on 3001
- `npm run build` / `npm run start` — production build / serve
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — unit tests (node:test via tsx)
- `npm run lint` — `next lint` (soft)

## Architecture

- Pure API client — no Prisma, no server secrets. All data flows through
  `src/lib/api.ts` (`credentials: 'include'`, automatic 401→refresh→retry).
- Auth: `POST /api/auth/admin-login` (rejects customers); a 30-minute idle
  timeout logs out client-side; the backend enforces a short refresh TTL.
- Theme: shadcn/ui with a botanical palette (`src/styles/globals.css`),
  light + dark via `next-themes`.
- This is the shell (Phase B). Feature areas (products, orders, …) are stubs
  filled in later phases. Spec: `docs/superpowers/specs/2026-07-03-admin-panel-design.md`.

## Deployment

Deploy as a separate Vercel project (Root Directory `Admin`) at
`admin.woodhouseherbals.com` — it must be same-site with the API
(`api.woodhouseherbals.com`) because auth cookies are `SameSite=strict`. Add
the admin origin to the backend's `WEB_ORIGIN`.
```

- [ ] **Step 3: Validate the CI YAML**

Run: `npx --yes js-yaml .github/workflows/ci.yml > /dev/null && echo "YAML OK"`
Expected: `YAML OK` (parses cleanly). If `js-yaml` is unavailable offline, instead run `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`.

- [ ] **Step 4: Final gates**

Run: `cd /home/shivanshu/Desktop/Code/Woodhouse-herbals/Admin && npm run typecheck && npm run build && npm run test`
Expected: all pass; tests 7/7.

- [ ] **Step 5: Commit**

```bash
cd /home/shivanshu/Desktop/Code/Woodhouse-herbals
git add .github/workflows/ci.yml Admin/README.md
git commit -m "ci(admin): add admin-check build job; document the Admin app"
```

---

## Completion checklist (whole phase)

- [ ] `npm run typecheck && npm run build && npm run test` green in `Admin/` (7 tests).
- [ ] Dev server boots on 3001; `/` redirects to `/login` when logged out.
- [ ] Login with the dev admin → lands on the dashboard shell; wrong password → toast; non-staff (a CUSTOMER account) is rejected and bounced to `/login`.
- [ ] Sidebar (13 items) + topbar (breadcrumbs, search, theme toggle, avatar) render; active nav indicator tracks the route; mobile sheet works below `lg`.
- [ ] `⌘K`/`Ctrl+K` opens the command palette and navigates; `⌘N` jumps to `/products/new`.
- [ ] Light and dark themes both render correctly and the toggle persists across reloads.
- [ ] All 13 section routes render a header + empty state.
- [ ] Idle timeout: after 30 min of inactivity the session logs out and redirects to `/login` (verify the mechanism by temporarily lowering `THIRTY_MINUTES_MS` in a local check, then revert — do NOT commit the lowered value).
- [ ] `admin-check` job present in CI and the YAML parses.
- [ ] Backend and Frontend untouched (this phase adds only `Admin/` and one CI job + one docs line).
