# Ehsbha — Smart Driver Operating System

> **Real profit, real decisions, in seconds.**
> A bilingual (Arabic-first / English) PWA that helps ride-share, delivery, and transportation drivers in Egypt and MENA know — to the piaster — whether they're actually making money, and what to do next to make more.

```
Backend:  NestJS 11 · Prisma 6 · Neon PostgreSQL · JWT (rotating refresh)
Web:      React 19 · Vite 6 · TailwindCSS 3 · TanStack Query 5 · Workbox PWA
OCR:      Azure Image Analysis 4.0 · Arabic + English + Persian glyph folding · 100% on 21 test cases
Locale:   Arabic-first RTL + English LTR · Cairo + Inter fonts · all UI logical-direction safe
```

| Metric | Value | Why it matters |
|---|---|---|
| OCR accuracy on Arabic ride-hailing receipts | **100% (360/360 fields across 21 cases)** | Drivers don't retype anything |
| Endpoints covered by smoke test | 33/33 | Every API path is exercised before release |
| Engine unit tests | 36/36 passing | Profit math is correct to the piaster |
| Web routes, all lazy-loaded | 20 | Cold start stays under a second on cheap phones |
| Aggregates recomputed | O(1) reads, write-time materialised | Analytics never scans the trips table |
| Languages | Arabic (default) + English | First-class RTL, not bolted on |
| PWA precache | ~1.2 MB | Installable, offline-tolerant |

> **Demo login (seeded):** phone `+201000000001`, password `demo1234`.

---

## Table of contents

1. [What Ehsbha does — the 60-second pitch](#1--what-ehsbha-does--the-60-second-pitch)
2. [Flagship feature — OCR that actually works in Arabic](#2--flagship-feature--ocr-that-actually-works-in-arabic)
3. [The full feature catalogue](#3--the-full-feature-catalogue)
4. [A typical day, end to end](#4--a-typical-day-end-to-end)
5. [Architecture in one diagram](#5--architecture-in-one-diagram)
6. [Quick start](#6--quick-start)
7. [Production build & verification](#7--production-build--verification)
8. [API reference — the endpoints that matter](#8--api-reference--the-endpoints-that-matter)
9. [Tech stack reference](#9--tech-stack-reference)
10. [Project layout](#10--project-layout)
11. [Conventions you'll see everywhere](#11--conventions-youll-see-everywhere)
12. [Troubleshooting](#12--troubleshooting)

---

## 1 — What Ehsbha does (the 60-second pitch)

Drivers in MENA use four or five apps at once (Uber, Careem, inDrive, DiDi, plus private clients). At day's end they have no idea what they actually earned after commission, fuel, maintenance, and tolls — let alone which app, area, or hour of the day was most profitable.

**Ehsbha answers three questions, every day:**

1. **Did I make money today?** — `Net profit = gross + tips − commission − fuel − maintenance − overhead`, to the piaster.
2. **What should I do next?** — A recommendation engine ranks the top three actions (switch app, change area, take a break, hit a service threshold) by expected EGP impact.
3. **When am I most profitable?** — Hour-of-day and day-of-week heatmaps over 7 / 30 / 90 day windows, plus a 30-day forecast.

Everything else (trips, expenses, maintenance, fuel logs, scoring) feeds those three answers. The product is intentionally small.

---

## 2 — Flagship feature — OCR that actually works in Arabic

Manually typing 12 trips a day is a hard sell. So Ehsbha reads the driver's app screenshots directly.

### What's hard about it

Arabic screenshots are an OCR adversary:

- Right-to-left layout — values often appear *above* their labels, not beside them.
- Arabic-Indic digits (٠–٩) on inDrive, comma decimal separators (`٦٥,٠٠`).
- Persian glyph contamination — Azure sometimes returns `ک` (U+06A9) where Arabic `ك` (U+0643) was, and `ی` for `ي`.
- Dark mode (inDrive) drops local contrast on key fields.
- Status-bar clocks (`11:17`) leak into the parser and get parsed as trip durations (`40 620` seconds).
- The same labels mean different things in different sections (`أجرة المشوار` appears twice on every Didi screen — once for the driver's earnings, once for the rider's payment, with **different values**).
- Bottom navigation labels (`الأرباح`, `القائمة`) get scraped as pickup addresses.

### What it does

The pipeline runs through nine specialised stages:

```
Screenshot
   │
   ├─ Sharp preprocessing (auto-rotate, 2200 px cap, gentle denoise, sharpen for Arabic strokes)
   │
   ├─ Azure Image Analysis 4.0 Read OCR (lines + words + bboxes + confidence)
   │
   ├─ Chrome filter (drops the status-bar clock + bottom navigation by geometry + content)
   │
   ├─ Semantic + digit normaliser (ة→ه, أ→ا, ک→ك, ی→ي, ٠–٩→0–9, ٫→.)
   │
   ├─ Platform detector (12+ signatures per app — Uber / inDrive / DiDi / Careem)
   │
   ├─ Per-platform parser (label dictionary + section-aware extraction + value-above-label fallback)
   │
   ├─ Multi-trip splitter (slices Uber "ملخص الدخل" screens into N independent cards)
   │
   ├─ Confidence scorer (OCR × platform × per-field weights, surfaces low-confidence warnings)
   │
   └─ Validator (sanity-checks against business invariants: paid ≤ total km, received ≤ gross, …)
```

### How well it works

The benchmark runner ([`backend/scripts/ocr-benchmark.ts`](./backend/scripts/ocr-benchmark.ts)) replays the full pipeline against 21 hand-curated fixtures with field-level golden answers and reports per-field accuracy.

| Platform | Test cases | Single-trip | Multi-trip cards | Field accuracy |
|---|---:|---:|---:|---:|
| Uber | 12 | 9 | 6 | **100%** (225/225) |
| DiDi | 5 | 5 | — | **100%** (75/75) |
| inDrive | 4 | 4 | — | **100%** (60/60) |
| **Total** | **21** | **18** | **6** | **100% (360/360)** |

The accuracy journey is logged in PR commits: **52.6% baseline → 67.8% (Phase A) → 80.7% → 87.0% → 91.1% → 96.7% → 99.3% → 100%**.

### Using it (from the web app)

```
Add Trip → "استخراج من لقطة الشاشة"
   ↓
1. Pick the app           (Uber / inDrive / DiDi / Careem)  ← four-up chip selector
2. Pick the screenshot type:
     a. "رحلة واحدة"      — a trip-details screen (one trip)
     b. "عدة رحلات"       — a summary screen with multiple trip cards
3. Drop 1–5 screenshots and click Extract.
4. Review and edit the parsed fields per trip card
   (income, distance, duration, datetime, pickup, destination, payment).
5. Click "احفظ كل الرحلات (N)" — one POST /trips/batch saves them all,
   then redirects to the trip list.
```

Each card auto-fills `startedAt` by combining the date header (`الجمعة، 15 مايو`) with the per-card time (`5:49 م`) — including year inference when the screenshot doesn't show one.

### Running the benchmark yourself

```bash
cd backend
npm run benchmark:ocr
```

The script reports per-case accuracy, top failing fields, and writes the full report (raw OCR text, parsed output, per-field diffs) to `backend/test-fixtures/results/baseline-{timestamp}.json` so any regression is immediately diff-able.

---

## 3 — The full feature catalogue

### 3.1 OCR & bulk operations

| Capability | What it gives the driver |
|---|---|
| **Single-trip extraction** | One screenshot in, one trip pre-filled out. Driver reviews and saves. |
| **Multi-trip extraction** | One screenshot of an Uber earnings summary in, N independently editable trip cards out. |
| **Bulk save** | `POST /trips/batch` saves up to 20 cards in one request — sequential transactions on the server avoid the aggregate-counter race that plagued naive parallel POSTs. |
| **Bulk delete** | "تحديد متعدد" mode on the trips list — check rows or "تحديد الكل", confirm, gone. `POST /trips/batch-delete` accepts up to 200 ids per call. Failures stay selected for retry. |
| **Idempotency** | Each card carries a deterministic `clientMutationId` derived from the image SHA-256 + card index. Replay-safe even on flaky 3G. |
| **Per-field confidence** | Every value shows a colored badge — green > 85%, amber 60–85%, red below. The driver knows where to look. |
| **OCR warnings** | 25+ machine-readable codes (`OCR_LOW_CONFIDENCE_grossEgp`, `OCR_VALUE_CONFLICT_grossEgp`, `OCR_OUT_OF_RANGE_distance`, `OCR_TIME_AMBIGUOUS`, …) each translated to a one-sentence driver hint. |

### 3.2 Smart Decisions (the recommendation engine)

The dashboard's **Top-3 Decisions** card answers "what should I do *now*?".

Decisions are produced by a server-side rules engine that reads the driver's last 14 days plus current vehicle / maintenance / fuel state and emits ranked actions with **expected EGP impact**:

- *Switch to inDrive in Nasr City for the next 2 hours — historically + 38 EGP/hr over Uber here.*
- *Top up at 7 EGP/litre at Mobil Ring Rd — saves ~21 EGP vs your current avg.*
- *Service brake pads within 7 days — RED risk, deferring costs ~180 EGP in extra wear.*
- *You've driven 9.5h today. Stop now — fatigue cost ≈ −12% earnings per next hour.*

Each card can be dismissed; dismissal sticks for the day. Decisions live at `/smart-decisions` for the long list, but only the top three render on the dashboard so the driver sees what matters.

### 3.3 Driver Score

A single number (0–100) for "am I running this gig like a business?" rendered as an animated SVG ring with four sub-scores:

| Sub-score | What it measures |
|---|---|
| **Productivity** | Earnings per hour vs. your 30-day median, vs. peers in your city/vehicle class |
| **Discipline** | Consistency of work hours, regular maintenance, on-time vehicle servicing |
| **Health** | Vehicle health (empty-km %, fuel efficiency drift, overdue components) |
| **Smart choices** | How often the driver followed top-ranked recommendations (and the EGP impact) |

The score updates after every trip / expense write. A 14-day history chart at `/driver-score` shows the trajectory.

### 3.4 Best hours

Hour-of-day profitability over a 7 / 30 / 90-day window. Renders as a 24-bar Recharts chart where each bar is the *net* EGP/hr the driver earned during that hour. Hovering a bar shows the trip count and the leading app for that slot.

Use case: a delivery driver discovers their 11 PM – 1 AM window is twice as profitable as the rush hour they've been working — and shifts their schedule.

### 3.5 Profit Simulator

Client-side what-if. The driver enters a hypothetical:

- Hours/day
- Gross EGP/hr (or estimated trips/hr × avg fare)
- Fuel L/100km (pre-filled from their actual vehicle's last 30 days)
- Commission %, tolls, parking

The simulator returns daily + weekly + monthly net profit, with a "use my real vehicle costs" toggle that swaps the manual inputs for the driver's actual rolling averages.

No round trips to the server — fully client-side so the driver can iterate fast in the back seat.

### 3.6 Work Planner

Given a monthly **earnings goal**, the planner answers:

- *How many hours per day do I need to work?*
- *How many trips per day at my recent average per-trip net?*
- *How many EGP per hour do I need to hit?*

Adjusts for already-earned EGP in the current month and remaining days. A traffic-light strip warns when the required pace exceeds the driver's historic 95th percentile (i.e. "this is unrealistic without changing apps or areas").

### 3.7 Vehicle health

Aggregates fuel + maintenance + odometer history into:

| Card | What it shows |
|---|---|
| **True cost/km** | Fuel + maintenance + depreciation / total km driven, with a 30-day trend |
| **Completeness** | What share of the vehicle's lifecycle data we know about, per component category |
| **Component pie** | RAG-coloured breakdown — oil change, brakes, tires, battery, transmission, … |
| **Predictive alerts** | "Brakes likely due in 800 km based on current wear rate" |

### 3.8 Trips, expenses, maintenance, fuel

Standard CRUD + intelligent prefills.

- **Trips** — list with date-preset filters (today / 7d / 30d / this month / all), bulk-select + bulk-delete, infinite scroll on long ranges. Add via form *or* OCR. Edit any field. Delete with confirm.
- **Expenses** — month total + category breakdown chart, 9 categories (rent / insurance / fines / tolls / food / phone / wash / parking / other), CRUD with category-aware suggestions.
- **Maintenance** — risk overview ([GREEN / AMBER / RED / OVERDUE]), 30+ maintenance items in a localised catalogue, "log new service" form prefills the next-due km from the item's recommended interval, history table per component.
- **Fuel** — log fill-up with km, litres, price/L, station; computes L/100km rolling.

### 3.9 Analytics

A six-tab dashboard at `/analytics`:

| Tab | Lens |
|---|---|
| Daily | Net EGP per day, last 30 days |
| Weekly | ISO-week buckets, last 12 weeks |
| Monthly | Last 12 months, with forecast for current |
| Apps | Per-app gross, commission %, net contribution, share of total |
| Areas | Per-area heatmap with trip count and EGP/trip |
| Hours | Same as Best Hours but with a comparison overlay across two presets |

Every chart is responsive, locale-aware (Arabic digits for ar, Latin for en), and respects `prefers-reduced-motion`.

### 3.10 Community (read-only feed)

A small driver feed at `/community` for tips, fuel-price alerts, "watch out for this area" posts. Backend pagination + reactions. Read-only in v3 — posting requires moderation we haven't built yet.

### 3.11 Notifications

In-app inbox at `/notifications`. Used for:
- Daily summary at end of day
- Service-overdue reminders
- New recommendations
- App / vehicle updates

Bulk mark-as-read + per-item mark-as-read.

### 3.12 Reviews & support

`/reviews` collects driver-to-passenger ratings (when the source app exposes them) for the driver's own self-tracking; `/support` is a built-in ticket form that posts to the backend's mailer module.

### 3.13 PWA & offline

- Installable to Android home screen (manifest + valid icons).
- Workbox service worker: `NetworkFirst` for `/api/*` with 6 s timeout, `CacheFirst` for fonts, custom offline fallback page.
- TanStack Query cache persisted to `localStorage` — opening the app offline shows the last loaded data instantly.
- Auth refresh runs in background; expired sessions redirect to login without losing route state.

### 3.14 Internationalisation

- Arabic-first (RTL by default), full English mirror.
- All UI uses Tailwind's logical directional utilities (`ms-*`, `me-*`, `text-start`, `text-end`) — no `left/right` literals — so RTL/LTR switch is a single attribute flip.
- Cairo for Arabic, Inter for Latin. Loaded only as needed.
- Numbers stay in Latin even in Arabic UI (driver convention).

### 3.15 Theming

Light + dark, HSL CSS-var tokens, no flash-of-wrong-theme thanks to an inline bootstrap in `index.html`. The toggle in the layout cycles light / dark / system.

### 3.16 Security & idempotency

- Argon2id password hashing (memory-hard, current OWASP recommendation).
- JWT HS256 access tokens (15 min default), refresh tokens with **rotation** and **reuse detection** — if a refresh is replayed, the entire family is revoked and the user is logged out everywhere.
- Phone-based login (Egyptian numbers). Email-by-phone lookup for password recovery.
- Zod validates every endpoint input. Prisma errors are mapped to stable, codified responses (`DUPLICATE`, `FOREIGN_KEY`, `NOT_FOUND`, `PRISMA_VALIDATION`, …) with the Prisma metadata logged server-side for debugging.
- Idempotency on every driver-owned write via `clientMutationId` — a replay returns the original record, not a 409.

---

## 4 — A typical day, end to end

```
06:30  Driver opens the app on their phone — installs as PWA on first launch.
       Dashboard loads in <300 ms from cached data (TanStack persistence).

07:15  Smart Decisions card: "Start with inDrive in El-Maadi — top historical
       earnings for Wed AM in your area, expected +24 EGP/hr."

09:42  Driver finishes 4 trips. Doesn't enter anything yet.

12:10  At lunch break, driver opens the Uber app and screenshots the
       "ملخص الدخل" tab showing today's 4 trips.

       In Ehsbha → Add Trip → Extract → Uber + "عدة رحلات".
       Pipeline takes ~6 s end to end. 4 cards render, each editable,
       each with auto-detected datetime, income, distance, pickup, destination.

       Driver glances, fixes one wrong pickup, clicks "احفظ كل الرحلات (4)".
       One POST /trips/batch later, 4 trips exist, aggregates have moved.

12:11  Dashboard updates (TanStack invalidations cascade): today's net,
       Driver Score, Smart Decisions all reflect the new trips.

13:00  Driver logs a fuel fill-up — Vehicle Health updates true cost/km.

       Maintenance card flips brake pads from AMBER to RED because the
       odometer crossed the 28 000 km threshold. A notification fires.

16:30  Best Hours panel suggests stopping by 19:00 — fatigue model says the
       next hour's expected earnings drop ~12%.

20:45  Driver clicks Notifications, sees a daily summary:
       "Today: 12 trips · 487 EGP net · 1.6 EGP/km · best app inDrive."

22:00  Optional: open Profit Simulator to plan the weekend's hours against
       the monthly goal.
```

---

## 5 — Architecture in one diagram

```
┌──────────────────────────────────── Web (React 19 + Vite 6 PWA) ────────────────────────────────────┐
│                                                                                                       │
│  20 routes, lazy-loaded · TanStack Query persisted · Zustand for auth/theme/locale                    │
│  Workbox SW (NetworkFirst /api/*, CacheFirst fonts, offline.html)                                     │
│                                                                                                       │
│  Components / pages          Hooks / utilities                  PWA & system                          │
│  ───────────────────         ───────────────────                ───────────                           │
│  Dashboard, Trips, OCR       use-ocr-extract, use-trips         install-dialog                       │
│  Analytics, Score, Decisions axios client + JWT refresh         offline.html                          │
│  Planner, Simulator          parsedToFormValues                 manifest + icons                      │
│  Maintenance, Health         buildCreateTripFromOcr             SEO meta + JSON-LD                    │
│                                                                                                       │
└─────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                              │  HTTPS, JSON, Bearer access + rotating refresh
┌─────────────────────────────────────────────▼────────────────────────────────────────────────────────┐
│                            Backend (NestJS 11 · Prisma 6 · JWT)                                        │
│                                                                                                        │
│  HTTP layer (Controllers + ZodValidationPipe + JwtAuthGuard + GlobalExceptionFilter)                  │
│                                                                                                        │
│  Domain modules                       Engines                            Cross-cutting                 │
│  ───────────────                      ───────                            ──────────────                │
│  auth, users, drivers                 profit calculator                  PrismaService                 │
│  vehicles, apps, areas                fuel L/100km                       AggregatesService             │
│  trips (single + batch)               maintenance risk + RAG             AuthGuard                     │
│  expenses, fuel, maintenance          score (4 sub-components)           Idempotency (cmid)            │
│  goals, sessions, odometer            fatigue cost                       ZodValidationPipe             │
│  notifications, recommendations       recommendations (top-N)            GlobalExceptionFilter         │
│  reviews, support, community          OCR pipeline ↓                     CurrentDriverId decorator     │
│  health, sync                                                                                          │
│                                                                                                        │
│  OCR pipeline:                                                                                         │
│     SharpProcessor → AzureVisionClient + AzureDocumentIntelligence → ChromeFilter → SemanticNormalizer │
│     → PlatformDetector → {Uber|InDrive|Didi|Careem}Parser → MultiTripSplitter (Uber summary)           │
│     → ConfidenceScorer → TripValidator → DTO                                                           │
│                                                                                                        │
└─────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                              │  Prisma (PostgreSQL wire)
┌─────────────────────────────────────────────▼────────────────────────────────────────────────────────┐
│                                 PostgreSQL (Neon-hosted)                                               │
│                                                                                                        │
│  Domain tables                 Aggregates (write-time materialised)        System                      │
│  ─────────────                  ───────────────────────────────────         ──────                     │
│  drivers, vehicles              daily_aggregates (per driver, per day)      sessions (refresh tokens)  │
│  trips, expenses, fuel          weekly_aggregates                           notifications              │
│  maintenance_records            monthly_aggregates                          audit_logs                 │
│  driver_apps, areas             app_daily_aggregates                                                   │
│  goals, score_snapshots         area_daily_aggregates                                                  │
│  community_posts, reviews                                                                              │
│                                                                                                        │
│  Money as INT piastres, distance as INT meters, all timestamps UTC.                                    │
│                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                              ▲
                                              │
┌─────────────────────────────────────────────┴────────────────────────────────────────────────────────┐
│  External                                                                                              │
│    Azure AI Vision (Image Analysis 4.0 Read + Document Intelligence prebuilt-receipt) — OCR only       │
│    SMTP (Gmail or any) — transactional emails for password recovery + support                          │
│    Nightly cron 03:17 UTC re-derives yesterday's aggregates from raw rows (drift protection)           │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The full design rationale is in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 6 — Quick start

You need **two terminals** running simultaneously.

### One-time setup

```bash
# 1. install all workspaces
npm install --legacy-peer-deps

# 2. configure backend env (DO NOT overwrite an existing .env)
cd backend
[ -f .env ] || cp .env.example .env
# Then open backend/.env and set DATABASE_URL + JWT_ACCESS_SECRET + JWT_REFRESH_SECRET.
# For Neon: console.neon.tech → project → "Connection string" → "psql" tab.
# For OCR: set AZURE_VISION_ENDPOINT + AZURE_VISION_KEY (multi-service AI resource).

# 3. Prisma client (required on first install and after schema changes)
cd ..
npm run backend:prisma:generate

# 4. (fresh database only) migrate + seed
cd backend
npx prisma migrate status        # if "up to date" → skip the next line
npm run prisma:migrate
npm run seed                     # creates demo driver + 30 days of data (idempotent)
cd ..
```

### Run

```bash
# Terminal 1 — backend (start first; the web app expects it on 4000)
npm run backend:dev
# → "Ehsbha API listening on http://localhost:4000/api/v1"

# Terminal 2 — web
npm run web:dev
# → http://localhost:5173
```

Open **http://localhost:5173** and log in with phone `+201000000001` / password `demo1234`.

> Shortcut: with `npm-run-all` in root devDependencies, `npm run dev` boots both at once.

---

## 7 — Production build & verification

```bash
# Web
npm run web:typecheck            # strict TS, noUnused*, no implicit any
npm run web:build                # production bundle + Workbox service worker
npm run web:preview              # serve the production bundle on 5173

# Backend
cd backend
npx nest build                   # → dist/
docker build -t ehsbha-api .     # Dockerfile checked in; multi-stage

# OCR benchmark — replays 21 Arabic screenshots through Azure + the full pipeline
npm run benchmark:ocr            # expects 360/360 fields matched
# Full report → backend/test-fixtures/results/baseline-{ISO timestamp}.json

# End-to-end smoke (33 checks)
npm run smoke                    # walks every endpoint, asserts aggregate deltas
```

The web build emits a manifest, service worker (Workbox), and 40+ lazy-loaded chunks. Open the preview URL in Chrome and run Lighthouse to confirm Performance / PWA / Accessibility / SEO scores on the real production bundle.

---

## 8 — API reference (the endpoints that matter)

All routes are prefixed `/api/v1` and require a `Bearer` access token unless noted. Responses follow `{ data, meta }` on success and `{ error: { code, message, details? }, meta }` on failure.

### Auth (no token needed)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `{ phone, password, name }` | Argon2id; returns `{ access, refresh }` |
| POST | `/auth/login` | `{ phone, password }` | Returns rotating-refresh pair |
| POST | `/auth/refresh` | `{ refresh }` | Rotates; reuse detection invalidates the family |
| POST | `/auth/forgot-password` | `{ phone }` | Emails a reset token (looked up by phone) |
| POST | `/auth/reset-password` | `{ token, password }` | Verifies + sets new hash |

### Trips (driver-owned, idempotent)

| Method | Path | Notes |
|---|---|---|
| GET | `/trips?from=…&to=…&appId=…&areaId=…&cursor=…&limit=20` | Cursor-paginated, max 50/page |
| GET | `/trips/:id` | Single record |
| POST | `/trips` | Single create. `clientMutationId` makes it replay-safe |
| **POST** | **`/trips/batch`** | **Bulk create up to 20. Sequential per-item transactions; returns `{ created: TripItem[], errors: { index, code, message }[] }`** |
| PATCH | `/trips/:id` | Partial update; aggregates re-applied in same TX |
| DELETE | `/trips/:id` | Single delete; aggregates decremented |
| **POST** | **`/trips/batch-delete`** | **Bulk delete up to 200 ids; returns `{ deleted: string[], errors: { id, code, message }[] }`** |

### OCR

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/ocr/extract` | `multipart/form-data` with `images[]`, `mode`, `platform` | `mode` ∈ `single` \| `multi`; `platform` ∈ `UBER` \| `INDRIVE` \| `DIDI` \| `CAREEM`. Returns `{ parsed, trips, fieldConfidences, warnings, … }` |

### Other resources (standard REST)

| Resource | Operations |
|---|---|
| `/drivers/me`, `/drivers/me/apps` | Profile + connected apps CRUD |
| `/vehicles` | CRUD; default vehicle marker |
| `/apps` (catalog) | Read-only list of supported app sources |
| `/areas` | CRUD |
| `/expenses` | CRUD |
| `/fuel` | CRUD |
| `/maintenance` | CRUD + per-component RAG status |
| `/odometer` | Submit + history |
| `/goals` | Set monthly goals |
| `/sessions` | Refresh-token family management |
| `/notifications` | List, mark-read (per-item + bulk) |
| `/recommendations` | Top-N decisions + dismiss |
| `/score` | Driver Score with 14-day history |
| `/analytics` | Daily / weekly / monthly / apps / areas / hours |
| `/community` | Read-only feed + reactions |
| `/reviews` | CRUD |
| `/support` | Ticket form |
| `/health` | Public liveness + version |

A 33-check smoke script (`backend/scripts/smoke.ts`) exercises every endpoint plus auth flows, aggregate-delta correctness, and refresh-token reuse detection.

---

## 9 — Tech stack reference

**Backend**
- NestJS 11 — controllers + services, no over-engineered layers
- Prisma 6 + PostgreSQL 16 (Neon-hosted in dev)
- JWT HS256, rotating refresh + reuse detection
- Argon2id password hashing
- Zod for all input validation
- `@nestjs/schedule` for the nightly 03:17 UTC aggregate cron
- `@azure-rest/ai-vision-image-analysis` 1.0 (Read OCR)
- `@azure-rest/ai-document-intelligence` 1.1 (prebuilt-receipt model, optional)
- `sharp` for OCR preprocessing

**Web**
- React 19 + Vite 6 (manual chunks: react / query / forms / motion / charts)
- TypeScript 5.7 strict, `noUnusedLocals`, `noUnusedParameters`
- TailwindCSS 3 + `tailwindcss-animate` + HSL CSS-var theming
- Radix UI primitives (Slot, Label, Dropdown, Toast)
- TanStack Query 5 + persist-client (localStorage)
- Zustand 4 + persist (auth, theme, locale)
- React Hook Form 7 + Zod 3
- Framer Motion 11 — subtle, `prefers-reduced-motion` aware
- Recharts 2
- `vite-plugin-pwa` (Workbox autoUpdate)
- `lucide-react` icons + `class-variance-authority`

---

## 10 — Project layout

```
.
├── ARCHITECTURE.md              # design rationale (v3.0, web-only)
├── README.md                    # this file
├── package.json                 # workspaces (backend + web)
├── backend/
│   ├── prisma/                  # schema (piastres + meters + UTC), migrations, seed
│   ├── scripts/
│   │   ├── smoke.ts             # 33-check end-to-end smoke
│   │   ├── smoke-azure-ocr.ts   # one-shot Azure connectivity test
│   │   └── ocr-benchmark.ts     # 21-case OCR regression suite (100% expected)
│   ├── test-fixtures/           # OCR test screenshots + golden JSON answers
│   └── src/
│       ├── main.ts, app.module.ts
│       ├── common/              # filters, pipes, guards, decorators
│       ├── prisma/              # PrismaService
│       └── modules/
│           ├── auth/, users/, drivers/, vehicles/
│           ├── apps/, areas/, sessions/, odometer/
│           ├── trips/           # CRUD + /batch + /batch-delete
│           ├── expenses/, fuel/, maintenance/, goals/
│           ├── ocr/             # ← see below
│           ├── notifications/, recommendations/, score/
│           ├── reviews/, support/, community/
│           ├── analytics/, aggregates/
│           ├── mailer/, sync/, health/
│           └── …
│
│       └── modules/ocr/
│           ├── ocr.controller.ts, ocr.service.ts, ocr.module.ts
│           ├── dto/ocr.dto.ts
│           ├── azure/                       # AzureVisionClient + AzureDocumentIntelligenceClient
│           ├── image-processing/            # SharpProcessor + chrome-filter
│           ├── semantic/                    # SemanticNormalizer + digit-normalizer + dictionary
│           ├── detectors/                   # PlatformDetector (UBER/INDRIVE/DIDI/CAREEM signatures)
│           ├── parsers/                     # base + uber + indrive + didi + careem
│           ├── merge/                       # MultiScreenshotMerger + MultiTripSplitter
│           ├── confidence/                  # ConfidenceScorer
│           └── validation/                  # TripValidator
│
└── web/
    ├── index.html               # SEO meta, manifest link, no-flash theme/dir bootstrap
    ├── vite.config.ts           # PWA + manual chunks
    ├── tailwind.config.ts       # HSL tokens, animations
    ├── public/                  # icons, manifest assets, sitemap.xml, robots.txt, offline.html
    └── src/
        ├── main.tsx, App.tsx, router.tsx
        ├── styles/index.css
        ├── i18n/                # ar.json, en.json, Provider
        ├── providers/           # theme-provider, query-provider, i18n-provider
        ├── stores/              # auth.store, theme.store
        ├── hooks/               # use-ocr-extract, use-vehicle-selector, …
        ├── lib/
        │   ├── api/             # axios client (JWT refresh) + typed endpoints
        │   ├── ocr/             # parsed-to-form, ocr-to-trip helpers
        │   ├── format.ts        # money / km / duration / number / date (locale-aware)
        │   └── time.ts
        ├── components/
        │   ├── ui/              # button, input, dialog, card, …
        │   ├── controls/        # theme-toggle, lang-toggle
        │   ├── layout/          # auth-layout, app-layout, sidebar
        │   ├── ocr/             # upload-dialog, source-selector, review-form,
        │   │                    # multi-trip-review, dropzone, progress, confidence-badge
        │   └── pwa/             # install-dialog
        ├── routes/              # protected-route, guest-route
        └── pages/               # auth, dashboard, trips, expenses, maintenance,
                                 # vehicle-health, analytics, driver-score, decisions,
                                 # planner, best-hours, simulator, notifications,
                                 # community, reviews, support, guide, settings
```

---

## 11 — Conventions you'll see everywhere

- **Money is integer piastres** (EGP × 100). No floats anywhere in the data model.
- **Distance is integer meters**. UI formats to km with one decimal.
- **Time is UTC** in the DB, presented in the driver's local timezone in the UI.
- **Every driver-owned write upserts its `DailyAggregate`, `WeeklyAggregate`, `MonthlyAggregate`, `AppDailyAggregate`, and `AreaDailyAggregate` rows in the same transaction** → analytics reads are always O(1).
- **`clientMutationId`** on trips / fuel / expenses / sessions / OCR bulk-create makes replays safe — a duplicate returns the original record.
- **Nightly cron at 03:17 UTC** re-derives yesterday's aggregates from raw rows, protecting against any in-flight bug ever leaving the materialised counters drifted.
- **Bilingual content** lives in `web/src/i18n/{ar,en}.json` only. Source code carries keys (`trips.field.gross`), never strings.
- **All API errors carry a stable code** (`OCR_LOW_CONFIDENCE_grossEgp`, `OCR_PLATFORM_UNKNOWN`, `DUPLICATE`, `FOREIGN_KEY`, `TRIP_NOT_FOUND`, …) so the web translates them and the next backend version can change wording without breaking clients.

---

## 12 — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Site loads but login fails (DevTools: `ERR_CONNECTION_REFUSED localhost:4000`) | Backend isn't running | `npm run backend:dev` |
| `Prisma` errors on backend start | Generated client missing | `npm run backend:prisma:generate` |
| `P1000` / "trying localhost:5432" | `DATABASE_URL` is the placeholder | Set the real Postgres URL in `backend/.env` |
| First login is slow (~5 s) | Neon free-tier DB sleeping | One-time wake-up; later requests are fast |
| `OCR_AUTH` on extract | `AZURE_VISION_KEY` is missing or rotated | Update `backend/.env`, restart backend |
| `OCR_NO_PLATFORM` error in the upload dialog | The driver hasn't picked an app | Pick Uber / inDrive / DiDi / Careem; the Extract button enables |
| Multi-trip save returns `DB_ERROR` on every card | Out-of-date backend without `/trips/batch` endpoint | Pull latest backend; restart |
| Port 5173 already in use | Stale Vite process | `netstat -ano \| findstr :5173` then `taskkill /F /PID <pid>` — or let Vite pick the next port |
| CORS errors in dev | Wrong `CORS_ORIGINS` | Set `CORS_ORIGINS=*` in `backend/.env` for local; lock down for prod |

For anything weirder: check `backend/server.log` (Prisma error codes + meta are now logged) or rerun `npm run smoke` from `backend/` to bisect which endpoint regressed.

---

## License & credits

Proprietary — © 2026 Ehsbha. Built for Egyptian and MENA drivers, by drivers' friends.
Demo dataset is fictional; matches no real driver, vehicle, or trip.
