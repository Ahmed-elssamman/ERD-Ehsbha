# Ehsbha

Smart driver management and analytics platform for transportation, ride-share, and delivery drivers in Egypt and MENA.

Workspace: **`backend/`** (NestJS 11 + Prisma 6 + PostgreSQL) · **`mobile/`** (Expo SDK 53 + React 19 + Reanimated 3 + NativeWind 4).

Full design: [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Status — verified working

| Layer | Stack | Verification |
|---|---|---|
| Backend | NestJS 11 + Prisma 6 + Neon Postgres | Boots clean · **33/33 endpoints smoke-passed** |
| Engines | Pure TS (profit, fuel, maintenance, score, fatigue, recommendations) | **36/36 unit tests pass** |
| Mobile | Expo SDK 53 + React 19 + Reanimated 3 + NativeWind 4 | Typecheck clean · Android + iOS bundle clean (3.32 MB Hermes) · `expo-doctor` 17/17 |
| Seed | Realistic 30-day Egyptian driver | ~250 trips · fuel · expenses · monthly goal |

---

## 1 — Run the backend

```bash
cd backend
cp .env.example .env             # then put your DATABASE_URL + JWT secrets

# install (from repo root is fine — workspaces handle it)
cd ..
npm install --workspaces --legacy-peer-deps

cd backend
npm run prisma:generate
npm run prisma:migrate           # first time only
npm run seed                     # populates demo driver + 30 days of data

# build + start
npx nest build
node dist/src/main.js
# → "Ehsbha API listening on http://localhost:4000/api/v1"
```

**Demo login**: phone `+201000000001`, password `demo1234`.

### Verify end-to-end (33 checks)

While the API is running, in another terminal:

```bash
cd backend
npm run smoke
```

The script exercises every endpoint, verifies refresh-token rotation, posts a trip and checks that the daily aggregate moved by the exact piastres expected, then deletes it and verifies the aggregate is restored.

---

## 2 — Run the mobile app

```bash
cd mobile
cp .env.example .env             # set EXPO_PUBLIC_API_URL if backend isn't local
npm run start                    # or: npm run start:clear to wipe metro cache
```

### Best ways to try it (in order of ease)

**Option A — Expo Go on physical phone (recommended)**
1. Install **Expo Go** from the App Store (iOS) or Play Store (Android) — latest version.
2. Make sure your phone and PC are on the **same Wi-Fi**.
3. Run `npm run start` from `mobile/`.
4. Scan the QR code with the Expo Go app (Android) or Camera (iOS).
5. On Android emulator: press `a` in the terminal.

If your phone is on a **different network** than your PC, set `EXPO_PUBLIC_API_URL` in `mobile/.env` to your PC's LAN IP, e.g. `http://192.168.1.6:4000/api/v1`.

**Option B — Web preview (fastest sanity check)**

```bash
cd mobile
npm run web
```
Opens at `http://localhost:8081`. Some native modules (`expo-secure-store`) gracefully degrade on web but most screens render correctly.

**Option C — Android emulator (needs Android Studio)**

```bash
# In Android Studio: Tools → Device Manager → create + start an emulator
cd mobile
npm run android
```

**Option D — iOS Simulator (requires macOS + Xcode)**
```bash
npm run ios
```

### Demo login on the app

- Phone: `+201000000001`
- Password: `demo1234`

After login you land on Home — populated with KPIs, daily decisions, recent trips. Analytics tab has apps/areas/hours breakdowns. Add a trip via the `+` button.

---

## 3 — Testing & verification

```bash
# Backend
cd backend
npm test                         # 36 engine unit tests
npm run smoke                    # 33 HTTP end-to-end checks (API must be running)

# Mobile
cd mobile
npm run typecheck                # full TypeScript check
npx expo-doctor                  # 17 Expo health checks
npx expo export --platform android  # full bundle compile
```

---

## 4 — Production build

```bash
# Backend
cd backend
npx nest build
docker build -t ehsbha-api .

# Mobile
cd mobile
npx eas-cli build --platform android --profile production
```

---

## 5 — Project layout

```
.
├── ARCHITECTURE.md
├── README.md
├── package.json                 # workspaces
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # 25+ models, money in piastres, distance in meters
│   │   ├── migrations/
│   │   └── seed.ts              # realistic Egyptian driver pattern
│   ├── scripts/
│   │   └── smoke.ts             # 33-check end-to-end test
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/              # zod pipe, exception filter, decorators, utils
│   │   ├── config/              # zod-validated env
│   │   ├── prisma/
│   │   └── modules/             # 19 feature modules
│   │       ├── auth/            # JWT (HS256) + rotating refresh + Argon2id
│   │       ├── drivers/
│   │       ├── vehicles/        # multi-vehicle
│   │       ├── apps/            # AppSource catalog + DriverApp per-driver config + custom apps
│   │       ├── areas/           # driver-defined zone tags
│   │       ├── trips/           # CRUD with aggregate accounting in tx
│   │       ├── sessions/
│   │       ├── fuel/
│   │       ├── expenses/
│   │       ├── maintenance/     # + risk engine
│   │       ├── goals/           # + progress + forecast
│   │       ├── aggregates/      # shared aggregate write service
│   │       ├── analytics/       # KPI endpoints + 5 pure engines + nightly cron
│   │       │   └── engines/     # profit, fuel, maintenance, score, recommendations
│   │       ├── recommendations/ # rule-based + 3-card daily decisions
│   │       ├── score/           # 0–100 daily snapshot
│   │       ├── notifications/
│   │       ├── sync/            # idempotent /sync/pull + /sync/push
│   │       └── health/
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── package.json
└── mobile/
    ├── app/                     # Expo Router file-based
    │   ├── _layout.tsx          # providers, RTL bootstrap, query persistence, sync
    │   ├── index.tsx            # auth-state redirect
    │   ├── (auth)/              # welcome, login, register
    │   ├── (tabs)/              # home, trips, analytics, profile
    │   ├── trips/               # new, [id]
    │   ├── fuel/new.tsx
    │   └── expenses/new.tsx
    ├── src/
    │   ├── api/                 # axios client + typed endpoints
    │   ├── stores/              # Zustand: auth, settings, network, session
    │   ├── offline/             # AsyncStorage mutation queue + sync engine
    │   ├── i18n/                # ar.json + en.json (Arabic default, RTL)
    │   ├── lib/                 # format, theme, helpers
    │   └── ui/                  # 10 reusable primitives + composed components
    ├── app.json
    ├── babel.config.js          # inline plugin: monorepo expo-router fix
    ├── metro.config.js
    ├── tailwind.config.js
    └── package.json
```

---

## 6 — Tech stack reference

**Backend**
- NestJS 11 (controllers + services, no over-engineered layers)
- Prisma 6 + PostgreSQL 16 (Neon-hosted in dev)
- JWT (HS256) with rotating refresh + reuse detection
- Argon2id password hashing
- Zod for all input validation (no class-validator)
- `@nestjs/schedule` for the nightly aggregate cron

**Mobile**
- Expo SDK 53 (Expo Go-compatible)
- React 19, React Native 0.79.6
- Expo Router 5
- Zustand (UI/session state)
- TanStack Query 5 (server cache + AsyncStorage persistence)
- NativeWind 4 (Tailwind for RN)
- React Hook Form + Zod (forms)
- Reanimated 3 (animations)
- Axios (HTTP)

**Why SDK 53 not 54+**: SDK 54+ Bridgeless mode caused a `PlatformConstants` TurboModule mismatch with Expo Go on iOS. SDK 53 is rock-solid with Expo Go and has every feature we need.

---

## 7 — Conventions

- Money is integer **piastres** (EGP × 100) everywhere.
- Distance is integer **meters**.
- Time stored UTC, presented in driver's timezone.
- Every driver-owned write upserts the affected `DailyAggregate`, `WeeklyAggregate`, `MonthlyAggregate`, `AppDailyAggregate`, and `AreaDailyAggregate` rows **in the same transaction** → reads are always O(1).
- Idempotency via `clientMutationId` UUID on trips/fuel/expenses/sessions.
- A nightly cron at 03:17 UTC re-derives yesterday's aggregates from raw rows.
