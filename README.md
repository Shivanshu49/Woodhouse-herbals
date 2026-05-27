# Wood House Herbals

Modern, premium, mobile-first natural skincare e-commerce platform for **Wood House Herbals** (by VedicGlory Healthcare). Three independent services covering the storefront, commerce API, and an optional AI recommendation service.

## Project layout

```
Woodhouse-herbals/
├── Frontend/      Next.js 14 (App Router) + TypeScript + Tailwind + Zustand + TanStack Query
├── Backend/       NestJS + Prisma + PostgreSQL + JWT cookies + Redis/BullMQ
├── AI-Service/    FastAPI service for skin/hair concern analysis (Claude vision/text)
└── docs/          Architecture notes and product flows
```

Each folder is **fully independent** — clone the repo, `cd` into the one you want to work on, install its dependencies, and run it. There is no monorepo wrapper.

## Tech stack (locked)

| Layer       | Choice                                                                 |
|-------------|------------------------------------------------------------------------|
| Frontend    | Next.js 14 App Router, TypeScript, Tailwind, Zustand, TanStack Query   |
| Backend     | NestJS, Prisma, PostgreSQL, JWT (httpOnly cookies), Redis + BullMQ     |
| AI          | FastAPI, Claude vision/text, Python tooling                            |
| Search      | Meilisearch                                                            |
| Payments    | PhonePe                                                                |
| Email       | Resend                                                                 |
| Storage     | Cloudflare R2                                                          |

## Quick start

### Frontend (storefront)

```bash
cd Frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:3000
```

Ships with realistic mock data and runs standalone — you can preview the full UI without spinning up the Backend or database first.

### Backend (commerce API)

```bash
cd Backend
cp .env.example .env       # then set DATABASE_URL, JWT secrets, etc.
npm install
npx prisma generate
npx prisma migrate dev     # needs a running Postgres
npm run prisma:seed
npm run start:dev          # http://localhost:4000/api
```

### AI Service

```bash
cd AI-Service
cp .env.example .env       # optional: add ANTHROPIC_API_KEY
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Works offline (deterministic recommender) without an Anthropic key; falls back to Claude-enriched summaries when one is set.

## Brand & product flow

1. Offer strip → seasonal hero → bestsellers → shop-by-concern
2. Smart search with suggestions in the sticky header
3. Shop page with filters by skin type, hair concern, category, price, rating
4. Product detail with gallery, ingredients, benefits, how-to-use, reviews, recommendations
5. Optional AI flow: skin/hair concern analysis → personalized product suggestions

See [`docs/architecture.md`](docs/architecture.md) for the full system design and build order.

## Shared types

Frontend ships its own TypeScript contracts under [`Frontend/src/types/`](Frontend/src/types/) (Product, Cart, Order, etc.). Backend uses Prisma-generated types from [`Backend/prisma/schema.prisma`](Backend/prisma/schema.prisma) as its source of truth. Keep the two aligned at the API boundary when you change a shape.
