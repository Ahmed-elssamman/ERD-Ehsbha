# Ehsbha — Project Architecture

**Version 3.0 · Web-First PWA · Status: Approved**
Date: 2026-05-17

> **What changed in v3.0:** Ehsbha is now a **web-only platform** delivered as an installable PWA. The native React Native / Expo client has been retired. The product principles below are unchanged — only the delivery surface (web instead of mobile-native) and the frontend tech stack have changed. The backend, database schema, business logic, calculations, and analytics engines are preserved as-is.
>
> Concrete details about the current web implementation (routes, pages, design system, PWA configuration, build commands) live in [`README.md`](./README.md) and [`web/README.md`](./web/README.md). The remainder of this document is preserved for historical reference and for the parts that remain valid (backend, schema, business rules).

---

## 0. Guiding Principles

1. **The web is the product.** The PWA serves drivers everywhere — installable on Android home screens, usable in any browser, accessible from desktop dashboards.
2. **Mobile-first responsive UX.** Every page is designed for a small phone first and scales up; large screens are an enhancement, not the primary target.
3. **Simple beats clever.** No microservices, no CQRS, no event buses, no worker fleets. One NestJS app, one Postgres, one Vite SPA, that's it.
4. **Fast and quiet on cheap phones.** Every page must feel instant on a 2GB Android 9 device on flaky 3G — small JS chunks, cached API, offline shell.
5. **Accurate calculations.** Profit math is correct to the piaster. Money is integers.
6. **Arabic first, RTL native.** Egyptian drivers are the primary user.
7. **Add features only when they earn their place.** The MVP is small on purpose.

---

## 1. Product Overview

### 1.1 What Ehsbha Is

A smart, lightweight mobile platform that helps any transportation or delivery driver understand **whether they're actually making money**, and **what to do next** to make more.

### 1.2 Who It Serves

- Car drivers (Uber, Careem, inDrive, Bolt, DiDi, private clients, anything else)
- Motorcycle drivers (food delivery, parcels, ride-share)
- Any driver who works across **multiple apps** and needs one number that tells them the truth

### 1.3 Core Promise

Open the app → see today's **real profit**, this week's **best app**, the **next action** to take. Add a trip in under 10 seconds. Trust the numbers.

### 1.4 Not in Scope

No maps. No live GPS. No AI chatbot. No accounting/VAT. No Google/Firebase/Supabase. No paid third-party services.

---

## 2. Tech Stack (Locked, v3.0 web-only)

**Web (PWA)**
- React 19 + TypeScript 5.7
- Vite 6 (manual chunks: react / query / forms / motion / charts)
- TailwindCSS 3 + `tailwindcss-animate` + HSL CSS-var theming (light + dark)
- Radix UI primitives (Label, Slot, Dropdown, Toast)
- TanStack Query 5 + persist-client (localStorage)
- Zustand 4 + persist (auth, theme, locale)
- React Hook Form 7 + Zod 3
- Framer Motion 11 (subtle, prefers-reduced-motion aware)
- Recharts 2 (responsive analytics)
- `vite-plugin-pwa` (Workbox autoUpdate, NetworkFirst API cache, offline fallback)
- Custom dotted-path i18n (AR RTL + EN LTR)

**Backend** (unchanged from v2.0)
- NestJS 11 (TypeScript)
- PostgreSQL 16 (Neon-hosted in dev)
- Prisma 6 ORM
- JWT (HS256) with rotating refresh + reuse detection
- Argon2id password hashing
- Zod validation everywhere
- `@nestjs/schedule` for nightly aggregate cron
- Zod for validation

That's everything. No Redis, no BullMQ, no message queue, no read replica, no Kafka — none of it. We add infrastructure only when measured pain forces us to.

---

## 3. System Architecture

```
┌────────────────────────────────────────────────────┐
│            Mobile App (Expo · TS · NW)             │
│  Zustand · TanStack Query · AsyncStorage Queue     │
└──────────────────────┬─────────────────────────────┘
                       │  HTTPS · JWT
┌──────────────────────▼─────────────────────────────┐
│                   NGINX (TLS, gzip)                │
└──────────────────────┬─────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────┐
│              NestJS API (single process)           │
│   Modules · Services · Prisma · Cron schedules     │
└──────────────────────┬─────────────────────────────┘
                       │
                ┌──────▼──────┐
                │ PostgreSQL  │
                └─────────────┘
```

One container for the API. One container for Postgres. One NGINX in front for TLS. That's the whole production setup.

---

## 4. Backend Structure (NestJS)

### 4.1 Style

**Plain, modular NestJS.** Each domain is a feature module containing:

```
module/
├── module.controller.ts
├── module.service.ts
├── module.repository.ts   (only when DB logic gets meaningful)
├── dto/                   (Zod schemas)
└── module.module.ts
```

No layers, no use-case classes, no orchestrators, no ports/adapters. Controllers stay thin, services hold business logic, Prisma is called directly from services (or a small repository if a service has lots of queries).

### 4.2 Modules

| Module | Owns |
|---|---|
| `auth` | Register, login, refresh, password, JWT |
| `users` | Account + identity |
| `drivers` | Profile, preferences, locale |
| `vehicles` | Vehicles (one or more per driver) |
| `apps` | App sources catalog + driver's enabled apps + commission % |
| `trips` | Trips CRUD + per-app, per-area tagging |
| `sessions` | Online shift tracking |
| `fuel` | Fuel logs |
| `expenses` | Expenses (categorized) |
| `maintenance` | Maintenance items + service records |
| `goals` | Goals + progress |
| `analytics` | KPIs, app comparison, area comparison |
| `recommendations` | Rule-based recommendations + daily decisions |
| `score` | Driver score |
| `notifications` | Push (Expo Push) + in-app inbox |
| `sync` | Lightweight offline mutation reconciliation |
| `health` | `/health` + `/ready` |
| `common` | Pipes, filters, decorators, zod validation pipe |

### 4.3 Backend Folder Structure

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── dto/
│   │   │       ├── register.dto.ts
│   │   │       ├── login.dto.ts
│   │   │       └── refresh.dto.ts
│   │   ├── drivers/
│   │   ├── vehicles/
│   │   ├── apps/
│   │   ├── trips/
│   │   ├── sessions/
│   │   ├── fuel/
│   │   ├── expenses/
│   │   ├── maintenance/
│   │   ├── goals/
│   │   ├── analytics/
│   │   │   ├── analytics.controller.ts
│   │   │   ├── analytics.service.ts
│   │   │   ├── engines/
│   │   │   │   ├── profit.engine.ts
│   │   │   │   ├── fuel.engine.ts
│   │   │   │   ├── score.engine.ts
│   │   │   │   ├── maintenance.engine.ts
│   │   │   │   └── recommendation.engine.ts
│   │   │   └── analytics.module.ts
│   │   ├── recommendations/
│   │   ├── score/
│   │   ├── notifications/
│   │   ├── sync/
│   │   └── health/
│   ├── common/
│   │   ├── pipes/zod.pipe.ts
│   │   ├── filters/exception.filter.ts
│   │   ├── interceptors/logging.interceptor.ts
│   │   ├── guards/owns.guard.ts
│   │   ├── decorators/current-user.ts
│   │   └── errors/
│   ├── prisma/
│   │   └── prisma.service.ts
│   └── config/
│       └── env.ts            # zod-validated env
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### 4.4 Conventions

- **Money** = `Int` in **piastres** (EGP × 100). Field name suffix `Piastres`.
- **Distance** = `Int` in **meters**. Field name suffix `Meters`.
- **Time** in UTC; driver's timezone stored on profile and used to compute "day boundaries".
- **camelCase** in code, **snake_case** in DB via Prisma mapping.
- **Zod everywhere** for input validation. No class-validator.
- **All driver-owned queries include `driverId`** — enforced by a tiny `withDriver()` helper in services.

---

## 5. Database Design

### 5.1 Schema Overview

```
User           (id, phone, email?, passwordHash, locale, timezone, createdAt)
RefreshToken   (id, userId, tokenHash, expiresAt, deviceId)
Driver         (id, userId, displayName, photoUrl?, baseCity?)
Vehicle        (id, driverId, type[CAR|BIKE], make?, model?, year?, fuelType,
                tankLiters, baselineKmPerLiter, odometerMeters, isActive)
AppSource      (id, code, name, defaultCommissionPct)         -- system catalog
DriverApp      (id, driverId, appSourceId, commissionPct, enabled, color?)
Area           (id, driverId, name, color)                     -- driver-defined tags
Trip           (id, driverId, vehicleId, driverAppId, areaId?,
                startedAt, endedAt,
                grossPiastres, tipPiastres, commissionPiastres,
                totalKmMeters, paidKmMeters, emptyKmMeters,
                notes?, createdAt, updatedAt, clientMutationId UNIQUE)
Session        (id, driverId, driverAppId, startedAt, endedAt?, activeMinutes)
FuelLog        (id, driverId, vehicleId, dateTime, liters, pricePerLiterPiastres,
                totalPiastres, odometerMeters, isFullTank, clientMutationId UNIQUE)
Expense        (id, driverId, vehicleId?, category, amountPiastres, dateTime,
                isRecurring, recurrenceRule?, clientMutationId UNIQUE)
MaintenanceItem(id, code, name, defaultIntervalKm, defaultIntervalDays)
MaintenanceRecord
               (id, driverId, vehicleId, maintenanceItemId,
                performedAt, odometerMeters, costPiastres, notes?)
Goal           (id, driverId, period[DAILY|WEEKLY|MONTHLY],
                targetPiastres, startsOn, endsOn, isActive)
DailyAggregate (driverId, date, tripCount, totalKm, paidKm, emptyKm,
                onlineMinutes, grossPiastres, fuelPiastres, expensePiastres,
                maintAmortPiastres, netProfitPiastres,
                profitPerKm, profitPerHour, emptyRatio, fuelKmPerLiter)
                                                              -- UNIQUE(driverId, date)
WeeklyAggregate / MonthlyAggregate (same shape, keyed by week/month)
AppDailyAggregate (driverId, driverAppId, date, gross, net, km, minutes)
AreaDailyAggregate(driverId, areaId, date, gross, net, km, minutes)
Recommendation (id, driverId, type, title, body, score, payloadJson,
                generatedAt, expiresAt, dismissedAt?)
Notification   (id, driverId, channel, title, body, dataJson, sentAt, readAt?)
ScoreSnapshot  (id, driverId, date, overall, efficiency, profit, safety,
                consistency)
DeviceToken    (id, driverId, token, platform, lastUsedAt)
```

### 5.2 Key Indexes

- `Trip(driverId, startedAt DESC)`
- `Trip(driverId, driverAppId, startedAt)`
- `FuelLog(driverId, dateTime DESC)`
- `Session(driverId, startedAt DESC)`
- `Expense(driverId, dateTime DESC)`
- `DailyAggregate(driverId, date)` unique
- `Trip(clientMutationId)` unique (and on FuelLog, Expense)

### 5.3 Notes

- **Multiple vehicles per driver** supported from day one — drivers swap bikes/cars.
- **Multiple apps** supported via `DriverApp` (driver enables apps from the `AppSource` catalog and overrides commission %).
- **Aggregates** are precomputed and stored, never computed at read time.
- **`clientMutationId`** is the idempotency anchor for offline writes.

---

## 6. API Structure

### 6.1 Conventions

- Versioned base: `/api/v1`.
- JSON, camelCase, ISO-8601 timestamps in UTC, money in piastres, distance in meters.
- JWT in `Authorization: Bearer …`.
- Response envelope:

```json
{ "data": ..., "meta": { "requestId": "...", "serverTime": "..." } }
```

- Error envelope:

```json
{ "error": { "code": "TRIP_OVERLAP", "message": "...", "details": {...} } }
```

### 6.2 Routes

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/password/forgot
POST   /auth/password/reset

GET    /me
PATCH  /me

GET    /drivers/me
PATCH  /drivers/me

GET    /vehicles
POST   /vehicles
GET    /vehicles/:id
PATCH  /vehicles/:id
DELETE /vehicles/:id

GET    /apps                        # full catalog
GET    /drivers/me/apps             # driver's enabled apps
POST   /drivers/me/apps             # add custom app
PATCH  /drivers/me/apps/:id
DELETE /drivers/me/apps/:id

GET    /areas
POST   /areas
PATCH  /areas/:id
DELETE /areas/:id

GET    /trips?from=&to=&appId=&cursor=
POST   /trips
GET    /trips/:id
PATCH  /trips/:id
DELETE /trips/:id

GET    /sessions?from=&to=
POST   /sessions/start
POST   /sessions/end

GET    /fuel?from=&to=
POST   /fuel
PATCH  /fuel/:id
DELETE /fuel/:id

GET    /expenses?from=&to=&category=
POST   /expenses
PATCH  /expenses/:id
DELETE /expenses/:id

GET    /maintenance/items
GET    /vehicles/:id/maintenance/records
POST   /vehicles/:id/maintenance/records
GET    /vehicles/:id/maintenance/risk

GET    /goals
POST   /goals
PATCH  /goals/:id
DELETE /goals/:id
GET    /goals/:id/progress

GET    /analytics/today
GET    /analytics/daily?date=
GET    /analytics/weekly?isoWeek=
GET    /analytics/monthly?year=&month=
GET    /analytics/apps?window=7d
GET    /analytics/areas?window=7d
GET    /analytics/hours?window=7d
GET    /analytics/forecast/monthly

GET    /recommendations
POST   /recommendations/:id/dismiss
GET    /decisions/today

GET    /score/today
GET    /score/history?from=&to=

GET    /notifications?cursor=
POST   /notifications/:id/read
POST   /notifications/devices       # register Expo push token

POST   /sync/pull                   # delta entities since cursor
POST   /sync/push                   # mutation batch
```

### 6.3 Idempotency

Every mutating endpoint accepts `Idempotency-Key` header (or, for sync, the `clientMutationId` in the body). Server stores keys for 24h and returns the prior response on retry.

### 6.4 Pagination

Cursor-based for timelines. Page size cap 50.

---

## 7. Authentication Flow

### 7.1 Tokens

- **Access token**: JWT, 15 min, HS256 (single-app deployment — symmetric key is fine).
- **Refresh token**: 30 days, opaque random string stored hashed in `RefreshToken`.
- **Rotation**: every refresh issues a new refresh token and revokes the old one. Reuse of an old refresh → revoke the user's whole device chain.

### 7.2 Storage on Device

- Access token: in-memory only (Zustand store, cleared on app close).
- Refresh token: `expo-secure-store` (Keychain / EncryptedSharedPreferences).

### 7.3 Flow

```
1. Register   →  201 + { user, accessToken, refreshToken }
2. Login      →  200 + { user, accessToken, refreshToken }
3. API call   →  axios attaches Authorization: Bearer <access>
4. 401        →  axios interceptor calls /auth/refresh
                 → on success: retry original
                 → on failure: clear tokens, redirect to login
5. Logout     →  /auth/logout (revokes refresh)
```

### 7.4 Phone-First Optional OTP

OTP via any SMS provider is supported through a single adapter interface in `auth.service.ts`. MVP can ship with password-only and add OTP later without API changes — just a new `/auth/otp/*` endpoint.

---

## 8. Frontend Structure (Mobile)

### 8.1 Folder Structure

```
mobile/
├── app/                              # Expo Router
│   ├── _layout.tsx                   # providers, theme, i18n, query client
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (onboarding)/
│   │   ├── _layout.tsx
│   │   ├── vehicle.tsx
│   │   ├── apps.tsx
│   │   └── goal.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx               # bottom tabs
│   │   ├── home.tsx                  # KPIs + decisions
│   │   ├── trips.tsx                 # timeline
│   │   ├── add.tsx                   # center FAB → modal
│   │   ├── analytics.tsx             # charts + comparisons
│   │   └── profile.tsx
│   ├── trips/
│   │   ├── new.tsx                   # modal
│   │   └── [id].tsx
│   ├── fuel/new.tsx                  # modal
│   ├── expenses/new.tsx              # modal
│   ├── maintenance/new.tsx           # modal
│   └── +not-found.tsx
├── src/
│   ├── api/
│   │   ├── client.ts                 # axios + interceptors
│   │   ├── endpoints.ts
│   │   └── modules/                  # one file per backend module
│   ├── stores/                       # zustand slices
│   │   ├── auth.ts
│   │   ├── session.ts
│   │   ├── network.ts
│   │   ├── theme.ts
│   │   └── ui.ts
│   ├── queries/                      # TanStack Query hooks
│   ├── mutations/                    # mutation hooks (with offline queue)
│   ├── offline/
│   │   ├── queue.ts                  # AsyncStorage-backed mutation queue
│   │   └── sync.ts                   # flush + reconcile
│   ├── ui/
│   │   ├── tokens.ts
│   │   ├── theme.ts
│   │   ├── primitives/               # Button, Input, Card, Sheet, …
│   │   ├── composed/                 # KpiTile, TripRow, DecisionCard
│   │   ├── charts/                   # tiny SVG bar + line + donut
│   │   └── icons/
│   ├── i18n/
│   │   ├── ar.json
│   │   ├── en.json
│   │   └── index.ts
│   ├── lib/
│   │   ├── format.ts                 # money, distance, time
│   │   ├── time.ts
│   │   └── id.ts
│   └── features/
│       ├── trips/
│       ├── fuel/
│       ├── expenses/
│       ├── analytics/
│       └── recommendations/
└── app.json
```

### 8.2 Navigation Shape

Five bottom tabs, with **Add** as the center FAB that opens a modal sheet for the three most common entries (Trip, Fuel, Expense). Everything else is one tap from Profile.

---

## 9. State Management Flow

Three small responsibilities, three small tools:

| Concern | Tool | What lives there |
|---|---|---|
| Server data | **TanStack Query** | trips, KPIs, recommendations, vehicles, fuel, expenses, score |
| Client/UI state | **Zustand** | auth tokens, current driver, theme, locale, network status, active shift overlay |
| Offline writes | **AsyncStorage mutation queue** | pending creates/updates/deletes when offline |

### 9.1 Rules

- Server data never gets copied into Zustand.
- Each Zustand store is a single slice with a single purpose.
- TanStack Query is the source of truth for cache, invalidations, and optimistic updates.
- The mutation queue is the source of truth for *pending* writes when offline.

### 9.2 Query Keys

```
['trips','list',{from,to,appId}]
['trips','detail',id]
['analytics','today']
['analytics','daily',date]
['analytics','weekly',isoWeek]
['analytics','monthly',y,m]
['analytics','apps',window]
['recommendations']
['decisions','today']
['score','today']
['vehicles']
['apps','me']
```

### 9.3 Optimistic Mutations

For Trip / Fuel / Expense creates:
1. Generate `clientMutationId` (UUID).
2. Update TanStack cache optimistically.
3. Try POST; on network failure → enqueue to AsyncStorage queue.
4. Background sync replays the queue on reconnect.
5. Server returns canonical row → cache reconciles by `clientMutationId`.

---

## 10. UI/UX System

### 10.1 Visual Direction

- **Premium, calm, minimal.** Big readable typography, generous spacing, soft shadows, one accent color.
- **Dark mode is default**; drivers use the app at night. Light mode supported.
- **Surfaces over chrome**: cards do the visual work, not borders and dividers.

### 10.2 Design Tokens

```
Colors (dark)
  bg:        #0B0F14
  surface:   #131922
  surface2:  #1B2330
  text:      #E8ECF1
  textMuted: #8B95A7
  accent:    #34D399        # green for profit/positive
  accentAlt: #60A5FA        # blue for neutral analytics
  warn:      #F59E0B
  danger:    #F87171
  border:    #232C3B

Spacing (4-pt scale):
  0, 4, 8, 12, 16, 20, 24, 32, 40, 56

Radii:
  sm 8 · md 12 · lg 16 · xl 24 · pill 999

Typography (Cairo / IBM Plex Sans Arabic):
  12, 14, 16, 18, 22, 28, 36
  weights: 400, 600, 700

Motion:
  120ms · 180ms · 240ms · spring (mass 1, damping 18, stiffness 220)
```

### 10.3 Layout Patterns

- **Home**: header (greeting + active shift pill) → 3 KPI tiles (Today profit, Today hours, Today km) → "Decisions of today" cards → recent trips strip.
- **Trips**: timeline with date headers, virtualized.
- **Analytics**: tabs (Daily / Weekly / Monthly) + sub-tabs (Apps / Areas / Hours).
- **Add modal**: full-screen sheet, single column, numeric pad opens by default.
- **Profile**: clean list rows with single accent icon per row.

### 10.4 Arabic RTL

- Arabic is the default locale; `I18nManager.forceRTL(true)` on language switch.
- All copy in `ar.json` and `en.json`. No hardcoded strings.
- Numbers stay Western numerals by default (drivers prefer them for currency); user-switchable.
- Currency formatted with the symbol on the proper side per locale.
- Direction-sensitive icons (arrows, back) flip via mirrored variants.

---

## 11. Reusable Component Strategy

Two layers only.

**Primitives** (`ui/primitives`)
- `Button` · `IconButton` · `Input` · `NumberInput` · `CurrencyInput` · `Select` · `Switch` · `Checkbox` · `Pill` · `Badge` · `Card` · `Sheet` · `Modal` · `Skeleton` · `EmptyState` · `Toast`

**Composed** (`ui/composed`)
- `KpiTile` · `KpiTrend` · `TripRow` · `DecisionCard` · `AppPicker` · `AreaPicker` · `VehiclePicker` · `DateRangePicker` · `ChartBar` · `ChartLine` · `ChartDonut`

Screens compose from these. **No screen-level CSS sprawl.** Primitives accept semantic props (`tone="danger"`, `size="lg"`), never raw color strings.

---

## 12. Analytics Engine Structure

### 12.1 How Reads Work

Reads **always hit precomputed aggregates**. The mobile app never asks the server to compute over raw trips.

```
GET /analytics/today     →  SELECT from DailyAggregate WHERE driverId, date=today
GET /analytics/weekly    →  SELECT from WeeklyAggregate
GET /analytics/monthly   →  SELECT from MonthlyAggregate
GET /analytics/apps      →  SELECT from AppDailyAggregate aggregated over window
```

This makes every KPI read **O(1)** at any scale.

### 12.2 How Aggregates Stay Fresh

Two simple paths — no queue:

1. **Synchronous "upsert on write."** When a Trip / Fuel / Expense is created or updated, the service immediately upserts the affected `(driverId, date)`, `(driverId, isoWeek)`, `(driverId, year-month)`, `(driverId, appId, date)`, and `(driverId, areaId, date)` aggregates inside the same transaction. This is bounded work (a handful of upserts per write).
2. **Nightly cron** (`@Cron('CRON_AT_0330')`) re-derives yesterday's aggregates from scratch for every active driver, healing any drift. Cheap because it processes only one day per driver per night.

That's the entire pipeline. No Redis, no BullMQ, no event bus.

### 12.3 Engines (Pure Functions)

Each engine is a TypeScript module that takes data and returns numbers — no side effects, easy to unit-test.

**Profit engine**
```
gross       = Σ trip.gross + Σ trip.tip − Σ trip.commission
fuel        = Σ fuel.totalPiastres in period
expenses    = Σ amortize(expense, period)         # rent spread over days
maintAmort  = Σ amortize(maint, period)            # straight-line over interval
net         = gross − fuel − expenses − maintAmort
perKm       = net / totalKm
perHour     = net / onlineHours
emptyRatio  = (totalKm − paidKm) / totalKm
```

**Fuel engine**
- Prefer **tank-to-tank** when the driver flags "full tank": `km / liters`.
- Else **rolling 14-day estimate**: `Σ km / Σ liters`.
- Trigger `FUEL_EFFICIENCY_DROP` when 14-day kpl drops >10% vs trailing 90-day.

**Maintenance engine** (per vehicle, per item)
```
kmUsage   = (currentOdo − lastServiceOdo) / item.intervalKm
timeUsage = daysSinceLast / item.intervalDays
risk      = max(kmUsage, timeUsage)
status    = GREEN < 0.7 · AMBER 0.7..0.95 · RED ≥ 0.95 · OVERDUE > 1
```

**Score engine** (0–100, daily)
```
efficiency  = z(profitPerKm vs trailing 14-day median)
profit      = z(net vs trailing 14-day median)
safety      = score from fatigue ceiling + late-night share
consistency = inverse of online-hour variance over 14d
overall     = 0.35 efficiency + 0.25 profit + 0.25 safety + 0.15 consistency
```

**Fatigue (lightweight, no sensors)**
```
fatigue = w1·(continuousDriveMin/120)
        + w2·(dailyOnlineMin/600)
        + w3·(weeklyOnlineMin/3600)
        + w4·nightShare
        + w5·((24 − sleepGapHours)/24)
level = SAFE < 0.4 · TIRED 0.4..0.7 · HIGH ≥ 0.7
```

---

## 13. Smart Recommendations Structure

A small **rule library**. Each rule is a function that, given the latest aggregates + driver state, returns 0 or 1 recommendation card.

```ts
type Recommendation = {
  type: string
  title: string
  body: string
  score: number       // 0..1 ranking weight
  payload?: any
  ttlMinutes: number
}
```

### 13.1 MVP Rules

| Rule | Triggers when |
|---|---|
| `empty_km_high` | 7-day empty-km ratio > personal baseline × 1.15 |
| `fuel_efficiency_drop` | 14-day kpl < 0.9 × 90-day kpl |
| `maintenance_imminent` | Any item RED |
| `best_app_window` | App A's profit/hr > App B's by 15% in a given time-of-day bucket over 7d |
| `goal_lag` | Monthly forecast < 0.9 × monthly goal |
| `fatigue_high` | Fatigue level ≥ HIGH while session is open |
| `best_day_of_week` | One weekday outperforms the rest by > 20% on profit/hr over 30d |

### 13.2 Decision Feed

A second tiny engine picks **3 cards per day** for the Home screen, balancing one "earn", one "save/protect", and one "goal" card. If a category has nothing, it's silently dropped.

### 13.3 Generation

The nightly cron generates and persists recommendations and the daily decisions; rules with short TTL (fatigue) are also computed on demand within the API request.

---

## 14. Driver Score Structure

(See §12.3 — the score engine.)

- Stored as a `ScoreSnapshot` per day for trend rendering.
- Home shows today's score + sparkline of last 7 days.
- A short paragraph explains the score in plain Arabic ("شغلك النهارده أكفأ من المتوسط بـ ١٢٪").

---

## 15. Maintenance Engine

- Driver picks from a small catalog: oil, oil filter, air filter, brakes, tires, chain (motorcycle), battery, coolant.
- Each item ships with a default `intervalKm` and `intervalDays`. Driver can override.
- After each service record, risk for that item resets to 0.
- A vehicle's "maintenance health" page shows the top-3 risk items with progress bars + days/km remaining.

---

## 16. Goals System

- One **active monthly goal** per driver (other periods optional).
- Progress = `currentNet / target`.
- Forecast = `currentNet × totalMonthDays / elapsedDays`, weekday-mix corrected.
- Status: `ON_TRACK · LAGGING · AT_RISK · ACHIEVED`.
- The decision feed includes a `goal_lag` card that translates the gap into concrete hours/trips.

---

## 17. Offline Strategy (Lightweight)

The driver might be in a tunnel, in a basement parking lot, or on a dead 3G corner. The app cannot stop.

### 17.1 What's Cached

- **TanStack Query** persists its cache to AsyncStorage on app background. On cold start, cached entities are visible immediately while a background refetch runs.
- **No SQLite.** We keep persistence simple to ship fast and stay light on weak phones.

### 17.2 Offline Writes — Mutation Queue

A small AsyncStorage-backed queue stores pending writes:

```ts
type QueuedMutation = {
  id: string                 // = clientMutationId
  endpoint: string           // POST /trips
  method: 'POST'|'PATCH'|'DELETE'
  body: unknown
  createdAt: number
  attempts: number
  lastError?: string
  status: 'PENDING'|'IN_FLIGHT'|'FAILED'
}
```

Flow:
1. Mutation hook tries the network with a short timeout (3s).
2. On failure → enqueue and resolve optimistically.
3. A sync engine flushes the queue when:
   - Network goes from offline to online.
   - App returns to foreground.
   - Every 30s while there are pending items.
4. Server idempotency on `clientMutationId` makes retries safe.
5. Header pill shows `Syncing 3…` while items pend.

### 17.3 Conflict Policy

Driver data is single-writer in practice. If a conflict ever appears (multi-device edits): **server's `updatedAt` wins**, the client's losing version is shown as a toast with an "Undo" option that re-submits.

---

## 18. Performance Optimization Strategy

### 18.1 Backend

- Aggregates precomputed (§12) → reads are constant-time.
- Prisma `select` only the fields each endpoint needs.
- Indexes (§5.2) on every hot query.
- HTTP gzip via NGINX.
- Process-local LRU cache for hot, mostly-static data (app catalog, maintenance items) — no Redis needed.
- Pagination caps (50) + cursor pagination.

### 18.2 Mobile

(See §19 for cheap-Android specifics.)

- TanStack Query staleTime tuned per query: KPIs 2 min, lists 30s, catalogs 1h.
- Aggressive query invalidation on mutations.
- Persisted query cache → cold start shows real data immediately.
- Image caching via `expo-image`.

---

## 19. Mobile Optimization Strategy (Cheap Android)

### 19.1 Render Budget

| Target | Number |
|---|---|
| Cold start to first interactive frame | ≤ 1.8s on 2GB Android 9 |
| JS bundle (Hermes) | ≤ 4 MB |
| List scroll | 60fps with 500+ trips |
| Average screen RAM | < 150 MB |

### 19.2 Techniques

- **Hermes** engine on Android.
- **FlatList** with `windowSize`, `removeClippedSubviews`, `getItemLayout`, memoized row components — never `map()` over big arrays.
- **No inline functions or styles in hot rows.**
- **Pre-binned chart data from server** (charts plot ≤ 30 points, never thousands).
- **Reanimated worklets** for animations; no JS-thread animations.
- **Lazy tab content**: each tab mounts its detail only on entry.
- **Selectors over Context**: theme/locale/network status read via Zustand selectors.
- **No background polling**, no location services.
- **Image sizes**: WebP, multiple densities, lazy load below the fold.
- **Splash + first paint**: ship a tiny shell with cached KPIs, then refetch.

### 19.3 Bundle Hygiene

- No moment.js — use `date-fns` (tree-shaken) or native `Intl`.
- No lodash whole-package — import per function.
- No icon font that bundles thousands of glyphs — ship only the icons we use.
- Reanimated babel plugin enabled; remove `console.log` in prod build.

---

## 20. Animation Guidelines

- **Purposeful, never decorative.** Animations confirm state, not entertain.
- Use Reanimated layout animations only for: tab transitions, sheet open/close, KPI count-up, button press scale, card enter.
- **Forbidden**: animated gradients, particle effects, parallax on lists, blur on scroll.
- **Durations**: 120ms (taps), 180ms (transitions), 240ms (sheets). Springs damped tight.
- **Reduced-motion respected.** If the OS reduces motion, switch to instant transitions.

---

## 21. Testing Strategy

Pragmatic, minimum-viable.

**Backend**
- **Engines**: 90% unit coverage (pure functions, table-driven).
- **Controllers / services**: integration tests against ephemeral Postgres (testcontainers) for happy paths + critical edge cases.
- **Migrations**: applied on a clean DB in CI; basic smoke.
- **Auth**: thorough — register, login, refresh rotation, token reuse, password reset.

**Mobile**
- **Pure logic** (formatters, engines, mutation queue): Jest unit.
- **Components**: a handful of snapshot/RTL tests on primitives.
- **E2E**: optional Maestro flow for `login → add trip offline → reconnect → trip visible`.

CI runs typecheck + lint + unit on every PR; integration on merges to `main`.

---

## 22. Deployment Strategy

### 22.1 Infrastructure

- **One VPS** for MVP (Hetzner / Lightsail / any) running Docker Compose:
  - `api` (NestJS)
  - `postgres` (with daily logical backup to S3-compatible storage of your choice — or local rsync to start)
  - `nginx` (TLS via Let's Encrypt)
- **Staging** = same compose on a smaller VPS.
- Domain + DNS managed via your registrar; nothing fancy.

### 22.2 Backend Dockerfile (concept)

- Multi-stage: builder (deps, prisma generate, nest build) → runtime (`node:20-alpine`, non-root user).
- `CMD ["node", "dist/main.js"]`.
- Healthcheck hits `/health`.

### 22.3 CI/CD

- Push to `main` → GitHub Actions builds image → pushes to registry → SSH to VPS → `docker compose pull && up -d`.
- Prisma migrations run as a one-shot container *before* the API rolls.

### 22.4 Mobile

- **EAS Build** for AAB/IPA.
- **EAS Update** for JS-only OTA updates (with a server contract-version guard).
- Staged rollout: 10% → 50% → 100% over 48h.

### 22.5 Monitoring

- pino logs to stdout, shipped wherever you like (Loki / CloudWatch / nothing fancy).
- A `/metrics` endpoint with basic counters (requests, errors, queue depth, cron last-run).
- Uptime ping (UptimeRobot free tier) for `/health`.

---

## 23. MVP Scope

### 23.1 In (v1.0)

- Auth (register, login, refresh, password reset)
- Driver profile + locale + timezone
- Vehicles (one or more, switch active)
- Apps: pick from catalog + add custom + set commission
- Trips (create / edit / delete, with app, area, paid/empty km)
- Sessions (start/end, per app)
- Fuel logs (with full-tank flag)
- Expenses (categorized, optional recurring)
- Maintenance (catalog + manual service records + risk)
- Goals (monthly target + progress)
- Analytics: today / daily / weekly / monthly + apps + areas + hours
- Forecast (monthly)
- Recommendations (7 rules from §13.1) + 3-card daily decisions
- Driver score
- Push notifications + in-app inbox
- Offline: cached reads + mutation queue
- Arabic + English with RTL
- Dark + Light themes

### 23.2 Out (MVP)

- Maps / GPS
- AI / chatbot
- Tax / VAT
- Fleet/team accounts
- Bank connections
- Cohort benchmarks
- Web admin (use Prisma Studio / SQL scripts to start)

---

## 24. Future Scaling Roadmap

| Phase | Theme | What lands |
|---|---|---|
| v1.1 | Polish | Recurring expense improvements, custom maintenance intervals, CSV export |
| v1.2 | Insights | Best-time-of-day surface, hotspot area suggestions, more recommendation rules |
| v1.3 | Health | Optional motion-sensor-based fatigue, scheduled rest reminders |
| v1.4 | Fleet | Optional fleet-owner account view for drivers with rented vehicles |
| v2.0 | Performance | If load demands it: add Redis cache + a read replica + BullMQ for nightly jobs. Carved cleanly because aggregates are already the read surface. |
| v2.x | ML | Replace deterministic forecasting with a small server-side model. The interface (`/forecast`) stays the same. |

---

## 25. Validation & Simplifications Applied

| Risk in v1 (enterprise) | Decision in v2 |
|---|---|
| BullMQ + Redis from day one | **Dropped.** Synchronous aggregate upsert + nightly `@Cron` covers MVP load. Re-introduce only if measured. |
| Clean Architecture with 4 layers per module | **Dropped.** Plain NestJS modules with controller/service/repo. Engines stay pure for testability. |
| Read replica + worker process | **Dropped.** One API process, one DB. Add a replica only when read p99 > target. |
| SQLite on device + custom ORM | **Dropped.** AsyncStorage for cached cache + mutation queue. Lighter on RAM, faster to ship. |
| FlashList | **Dropped.** FlatList tuned correctly meets the 60fps target on cheap Android; one fewer native dependency. |
| Heavy chart libraries | **Dropped.** Tiny SVG charts on pre-binned server data. |
| Microservice carve-out plan | **Deferred to v2.0** — not designed for it now. The codebase stays a single NestJS app until pain forces otherwise. |

### What stayed strong from v1

- Money as integer piastres, distance as meters.
- Precomputed aggregates as the read surface.
- Idempotency by `clientMutationId`.
- Pure-function engines (profit, fuel, maintenance, score, recommendations).
- Arabic RTL as default with proper token system.
- Mobile perf budgets enforced on cheap Android.

---

## 26. Production Readiness Checklist

**Backend**
- [ ] Zod env validation at boot
- [ ] Zod input validation on every route
- [ ] Global exception filter + error envelope
- [ ] JWT access + rotating refresh + reuse detection
- [ ] Ownership enforced on every driver-scoped query
- [ ] Idempotency-Key / clientMutationId honored on mutations
- [ ] Money in piastres, distance in meters — everywhere
- [ ] Aggregate upsert in same transaction as the underlying write
- [ ] Nightly cron runs and is monitored
- [ ] Daily Postgres backup tested by restoring in staging

**Mobile**
- [ ] Hermes enabled, bundle ≤ 4 MB
- [ ] FlatList tuned (windowSize, getItemLayout, memoized rows) on all long lists
- [ ] RTL audit per screen
- [ ] Cold start < 1.8s on 2GB Android verified
- [ ] Offline shift test: 8h offline → reconnect → 0 lost trips
- [ ] Push opt-in + frequency cap (max 5/day)
- [ ] Min 48dp tap targets, contrast AA
- [ ] expo-secure-store used for refresh tokens

**Cross**
- [ ] Privacy policy + ToS (AR + EN)
- [ ] Data export + delete endpoints
- [ ] Force-update path validated

---

## 27. Implementation Sequencing (8 weeks)

| Week | Backend | Mobile |
|---|---|---|
| 1 | Bootstrap, Docker, Postgres, Prisma schema, auth | Bootstrap, Expo Router, theme, i18n + RTL, primitives |
| 2 | Auth (register/login/refresh), users, drivers, vehicles, apps | Auth flow, onboarding, vehicle + apps screens |
| 3 | Trips, sessions, fuel, expenses, maintenance | Add modals, trip detail, fuel + expense screens |
| 4 | Aggregates: synchronous upsert + nightly cron, analytics endpoints | Home (KPI tiles), trips timeline, basic analytics tabs |
| 5 | Engines (profit, fuel, maintenance, score) + recommendations rules + decisions | Analytics charts, apps + areas comparison screens |
| 6 | Goals, forecast, notifications (Expo Push + inbox), sync endpoints | Goals, score, notifications inbox, offline queue |
| 7 | Hardening, indexes, rate limit, exception filter, audit basics | Perf pass on 2GB device, RTL audit, polish |
| 8 | Load test, backup/restore drill, deploy | EAS build, staged rollout, store assets (AR + EN) |

---

## 28. Final Approval

This is the **final architecture for Ehsbha v1.0**: mobile-first, frontend-led, backend deliberately simple. Every piece exists because the product needs it; nothing is here to look impressive. It is ready to build starting at Week 1 above.

— End of document.
