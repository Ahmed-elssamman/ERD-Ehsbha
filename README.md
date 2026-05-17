# Ehsbha

Smart driver operating system for ride-share, delivery, and transportation drivers in Egypt and MENA.

**Web-only platform.** Installable PWA. Mobile-first responsive UI. Production-grade SaaS dashboard.

Workspaces: **`backend/`** (NestJS 11 + Prisma 6 + PostgreSQL) · **`web/`** (React 19 + Vite 6 + TailwindCSS + PWA).

Full design: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Status

| Layer | Stack | Verification |
|---|---|---|
| Backend | NestJS 11 · Prisma 6 · Neon Postgres · JWT (rotating refresh) | 33/33 endpoints smoke-pass · 36/36 engine unit tests pass |
| Web | React 19 · Vite 6 · TailwindCSS 3 · Radix · TanStack Query 5 · Recharts · vite-plugin-pwa | Typecheck clean · Production build clean · PWA precaches ~1.2 MB |

Demo login (seeded): phone `+201000000001`, password `demo1234`.

---

## 1 — Quick start (the only steps you need)

You need **two terminals** running simultaneously.

**One-time setup**:

```bash
# 1. install all workspaces
npm install --legacy-peer-deps

# 2. configure the backend .env — ONLY if backend/.env doesn't already exist.
#    DANGER: do NOT blindly `cp .env.example .env` if you already have a working .env —
#    you'll overwrite your real DATABASE_URL with the placeholder.
cd backend
[ -f .env ] || cp .env.example .env
#    Then open backend/.env and put your real DATABASE_URL + strong JWT secrets.
#    For Neon: console.neon.tech → project → "Connection string" → "psql" tab.
#    The Postgres URL starts with `postgresql://` — it is NOT the same as the Neon Data API REST URL.

# 3. generate Prisma client (needed on every fresh install or schema change)
cd ..
npm run backend:prisma:generate

# 4. (only on a fresh database) apply migrations + seed demo data
cd backend
npx prisma migrate status        # if "Database schema is up to date" → skip migrate
npm run prisma:migrate           # otherwise: apply migrations
npm run seed                     # populates demo driver + 30 days of data (idempotent)
cd ..
```

**Run** (two terminals):

```bash
# Terminal 1 — backend (must be up first)
npm run backend:dev
# → "Ehsbha API listening on http://localhost:4000/api/v1"

# Terminal 2 — web
npm run web:dev
# → http://localhost:5173
```

Open **http://localhost:5173** and log in with the demo credentials.

> If you have `npm-run-all` installed at the root (it's in devDependencies), you can also run both at once with `npm run dev`.

---

## 2 — Production build

```bash
npm run web:typecheck            # all clean
npm run web:build                # production bundle + service worker
npm run web:preview              # preview the production build (port 5173)

# backend
cd backend
npx nest build
docker build -t ehsbha-api .
```

The web build emits a manifest, service worker (Workbox), and 40+ lazy-loaded chunks. Open the preview URL in Chrome and run Lighthouse to see Performance / PWA / Accessibility / SEO scores against the real bundle.

---

## 3 — Verify end-to-end (backend)

While the API is running:

```bash
cd backend
npm run smoke
```

The 33-check smoke script exercises every endpoint, verifies refresh-token rotation, posts a trip and checks that the daily aggregate moved by the exact piastres expected, then deletes it and verifies the aggregate is restored.

---

## 4 — What's in the web app

20 routes, all wired to the real backend, all lazy-loaded:

| Route | Page |
|---|---|
| `/login`, `/register` | Auth (phone + password, demo autofill, JWT rotating refresh) |
| `/` | Dashboard — Today KPIs · Forecast · Top-3 Decisions · Driver Score ring · Recent trips |
| `/trips`, `/trips/new`, `/trips/:id` | Trips list with filters · Add/Edit/Delete |
| `/expenses` | Month total · Category breakdown · CRUD |
| `/maintenance` | Risk overview (GREEN/AMBER/RED/OVERDUE) · History · Log new service |
| `/vehicle-health` | True cost / km · Completeness · Component pie |
| `/analytics` | Daily / Weekly / Monthly / Apps / Areas / Hours tabs |
| `/driver-score` | Animated SVG ring · 4 sub-scores · 14-day history chart |
| `/smart-decisions` | All recommendations colored by tone · dismiss |
| `/work-planner` | Needed per day / per hour / hours per day vs monthly goal |
| `/best-hours` | Time-of-day profitability · 7/30/90d windows |
| `/profit-simulator` | Client-side what-if · "use my vehicle costs" prefill |
| `/notifications` | List · per-item and bulk mark-read |
| `/settings` | Profile · Vehicles CRUD · Apps CRUD · Areas CRUD · Goals · Theme · Language |

Design system: HSL CSS-var theming (light + dark), Cairo + Inter fonts, Tailwind logical utilities (`ms-*`, `me-*`, …) so Arabic RTL works automatically. Animations via Framer Motion, all short (≤ 250 ms), all respecting `prefers-reduced-motion`.

PWA: manifest, Workbox service worker (`NetworkFirst` for `/api/*` with 6s timeout, `CacheFirst` for fonts), offline fallback page, SEO-ready meta + Open Graph + Twitter + JSON-LD structured data, `sitemap.xml` + `robots.txt`.

State: TanStack Query 5 with `localStorage` persistence (instant cold-start UX), Zustand for auth + theme + locale, mutations invalidate the right keys so analytics / forecast / decisions / score all refresh after a trip/expense write.

---

## 5 — Tech reference

**Backend**
- NestJS 11 (controllers + services, no over-engineered layers)
- Prisma 6 + PostgreSQL 16 (Neon-hosted in dev)
- JWT (HS256) with rotating refresh + reuse detection
- Argon2id password hashing
- Zod for all input validation
- `@nestjs/schedule` for nightly aggregate cron

**Web**
- React 19 + Vite 6 (manual chunks: react / query / forms / motion / charts)
- TypeScript 5.7 (strict, `noUnusedLocals`, `noUnusedParameters`)
- TailwindCSS 3 + `tailwindcss-animate`
- Radix UI primitives (Slot, Label, Dropdown, Toast)
- TanStack Query 5 + persist-client (localStorage)
- Zustand 4 + persist
- React Hook Form 7 + Zod 3 + `@hookform/resolvers`
- Framer Motion 11
- Recharts 2
- `vite-plugin-pwa` (Workbox autoUpdate)
- `lucide-react` icons, `class-variance-authority` for variants

---

## 6 — Project layout

```
.
├── ARCHITECTURE.md
├── README.md
├── package.json                 # workspaces (backend + web)
├── backend/
│   ├── prisma/                  # schema (money in piastres, distance in meters) + migrations + seed
│   ├── scripts/                 # smoke.ts (33-check end-to-end)
│   └── src/                     # auth, drivers, vehicles, apps, areas, trips, sessions, fuel,
│                                # expenses, maintenance, goals, aggregates, analytics
│                                # (+ engines: profit, fuel, maintenance, score, fatigue, recommendations),
│                                # recommendations, score, notifications, sync, health
└── web/
    ├── index.html               # SEO meta, manifest link, no-flash theme/dir bootstrap
    ├── vite.config.ts           # PWA + manual chunks
    ├── tailwind.config.ts       # HSL tokens, animations
    ├── public/                  # favicon, PWA icons, manifest assets, sitemap.xml, robots.txt, offline.html
    └── src/
        ├── main.tsx, App.tsx, router.tsx
        ├── styles/index.css     # Tailwind layers + CSS-var tokens
        ├── i18n/                # ar.json + en.json + Provider
        ├── providers/           # theme-provider, query-provider
        ├── stores/              # auth.store.ts (Zustand + persist)
        ├── hooks/               # use-vehicle-selector
        ├── lib/
        │   ├── api/             # axios client (JWT refresh) + typed endpoints
        │   ├── format.ts        # money / km / duration / number / date (locale-aware)
        │   ├── time.ts
        │   └── utils.ts
        ├── components/
        │   ├── ui/              # button, input, label, card, skeleton, alert, badge, tabs, select,
        │   │                    # textarea, dialog, empty-state, page-header, logo
        │   ├── controls/        # theme-toggle, lang-toggle
        │   └── layout/          # auth-layout, app-layout, sidebar
        ├── routes/              # protected-route, guest-route
        └── pages/               # auth, dashboard, trips, expenses, maintenance, vehicle-health,
                                 # analytics, driver-score, decisions, planner, best-hours,
                                 # simulator, notifications, settings, not-found
```

---

## 7 — Conventions

- Money is integer **piastres** (EGP × 100) everywhere.
- Distance is integer **meters**.
- Time stored UTC, presented in driver's timezone.
- Every driver-owned write upserts the affected `DailyAggregate`, `WeeklyAggregate`, `MonthlyAggregate`, `AppDailyAggregate`, and `AreaDailyAggregate` rows **in the same transaction** → reads are always O(1).
- Idempotency via `clientMutationId` UUID on trips/fuel/expenses/sessions.
- A nightly cron at 03:17 UTC re-derives yesterday's aggregates from raw rows.

---

## 8 — Troubleshooting

**"The site loads but login fails"** — Backend isn't running. Open DevTools → Network: if you see `ERR_CONNECTION_REFUSED` on `localhost:4000`, start `npm run backend:dev`.

**"`prisma` errors on backend start"** — Run `npm run backend:prisma:generate`. Needed after a fresh install or any `prisma/schema.prisma` change.

**`P1000: Authentication failed against database server` / "trying localhost:5432"** — Your `backend/.env` has the placeholder `DATABASE_URL` (or got overwritten by `.env.example`). Open `backend/.env` and put your real Postgres connection string. For Neon: console.neon.tech → project → "Connection string" → "psql" tab. The Postgres URL starts with `postgresql://` and is **different from the Neon Data API REST URL** (which has `.apirest.` in the hostname and starts with `https://` — that one does NOT work with Prisma).

**"First login is slow"** — Neon's free-tier DB sleeps after 5 min idle and takes ~5s to wake. Subsequent requests are fast.

**Port 5173 already in use** — Either kill the stale process (`netstat -ano | findstr :5173` → `taskkill /F /PID <pid>`), or Vite will pick the next free port and tell you in its banner.

**CORS issues** — Backend `.env` should have `CORS_ORIGINS=*` for local. For production, set it to your web origin.
