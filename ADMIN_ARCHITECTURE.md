# ADMIN_ARCHITECTURE.md

**Ehsbha Admin Platform — Official Architectural Blueprint**

> Status: Blueprint (not yet implemented). This document is the single source of truth for building a SaaS-grade admin platform on top of the existing Ehsbha driver platform. No code or schema changes have been made to the existing system; everything below is a forward-looking design.

> **Binding architectural decision (recorded 2026-05-29):** The Admin Dashboard is a **completely separate frontend application** from the user-facing web app. It is **not** a route-isolated section of the existing `web/` app. The monorepo is reorganized to `/apps/{web,admin,api}` with shared code lifted into `/packages/*`. See "Monorepo Architecture" section below for the locked-in structure.

---

## MONOREPO ARCHITECTURE (BINDING)

### Target Layout

```
ehsbha/
├── apps/
│   ├── api/          ← NestJS backend (renamed from `backend/`)
│   ├── web/          ← Driver-facing PWA (moved from `web/`)
│   └── admin/        ← Admin dashboard (NEW — completely separate React app)
├── packages/
│   ├── shared-types/      ← TS types + Zod schemas shared across apps
│   ├── api-contracts/     ← API DTO contracts (single source of truth)
│   ├── ui-tokens/         ← Tailwind preset, color tokens, font tokens
│   └── eslint-config/     ← Shared lint config
├── package.json     ← workspace root
└── tsconfig.base.json
```

### Hard Rules

| Rule | Why |
|---|---|
| **`apps/admin/` MUST NOT import from `apps/web/`** (and vice versa). | Prevents leakage of user pages/layouts into admin. Enforced via ESLint `no-restricted-imports`. |
| **Both `apps/web/` and `apps/admin/` MAY import from `packages/*`.** | Shared types and tokens are explicitly allowed; everything else is not. |
| **`apps/api/` is the only producer of authoritative DTOs.** | Avoid drift. Web and Admin consume types generated from `apps/api`'s Zod schemas via `packages/api-contracts`. |
| **No code from `apps/admin/` ships in the `apps/web/` bundle**, and vice versa. | Two independent Vite builds, two independent CDN deployments. |
| **Two independent build outputs.** | `npm --workspace apps/web run build` and `npm --workspace apps/admin run build` produce isolated `dist/` folders. |
| **Two independent deployments.** | `app.ehsbha.com` (web) and `admin.ehsbha.com` (admin) are deployed as separate hostnames behind the same API origin. |
| **Two independent authentication realms.** | Admin login lives on a different JWT secret, different cookie/storage namespace, different refresh-token table. See Step 2 and the verification document. |

### What Is Shared (Allowed)

Defined in `packages/`:
- **`packages/shared-types`**: TypeScript types that aren't tied to validation (utility types, branded primitives, enums mirroring Prisma enums).
- **`packages/api-contracts`**: Zod schemas for every endpoint's request & response, exported from `apps/api/src/contracts/*` and re-exported here. Web and Admin import these directly — no client-side schema duplication.
- **`packages/ui-tokens`**: Tailwind preset (colors, spacing, typography), CSS variables, design tokens. **Not components** — just primitives.
- **`packages/eslint-config`**: shared lint rules. Includes the `no-restricted-imports` rule that bans cross-app imports.

### What Is NOT Shared

- ❌ User-facing layouts (`apps/web/src/components/layout/*`).
- ❌ User-facing navigation (`apps/web/src/components/layout/sidebar.tsx`).
- ❌ User-facing pages (`apps/web/src/pages/**`).
- ❌ User flows (login, register, password reset use admin-specific copies — even if the form structure looks similar).
- ❌ User stores (`apps/web/src/stores/auth.store.ts` is web-only; admin has its own `apps/admin/src/stores/admin-auth.store.ts`).

### Migration Path (from current `backend/` + `web/`)

The current repo has `backend/` and `web/` at the root. Migration is a single PR done **before** any admin code is written:

1. Move `backend/` → `apps/api/` (preserves git history via `git mv`).
2. Move `web/` → `apps/web/` (same).
3. Update root `package.json` workspaces: `["apps/*", "packages/*"]`.
4. Update path aliases in `apps/web/tsconfig.json`, `apps/web/vite.config.ts`.
5. Update root scripts (`backend:dev` → `api:dev`, etc.).
6. Verify all existing CI, scripts, and dev commands still work.
7. **Only after that PR lands**, scaffold `apps/admin/` and `packages/*`.

This migration is non-functional — no app behavior changes. It is a pure restructure to unblock the admin app.

### Deployment Topology

```
                          ┌────────────────────────────────────┐
  app.ehsbha.com  ──→     │  CDN / static hosting (apps/web)   │
                          └────────────┬───────────────────────┘
                                       │
                                       ▼ HTTPS calls
                          ┌────────────────────────────────────┐
                          │  api.ehsbha.com (apps/api)         │
                          │  - /api/v1/*       (driver scope)  │
                          │  - /api/v1/admin/* (admin scope)   │
                          └────────────▲───────────────────────┘
                                       │
                          ┌────────────┴───────────────────────┐
  admin.ehsbha.com ──→    │  CDN / static hosting (apps/admin) │
                          └────────────────────────────────────┘
```

- **Two separate CDN origins**. Compromising one bundle does not compromise the other.
- **One API origin** with two authentication realms (driver JWT vs admin JWT) on separate paths.
- **Optional**: admin behind IP allowlist + Cloudflare Access (SuperAdmin only).

---

## TABLE OF CONTENTS

1. Admin System Overview
2. Role & Permission Architecture (RBAC)
3. Admin Sidebar Structure
4. Main Dashboard Design
5. User Management Module
6. Driver Management Module
7. Trip Management Module
8. Community Moderation System
9. Support Center
10. Notification Center (Admin Alerts)
11. Audit Log System
12. Revenue Analytics (Future-Ready)
13. Feature Usage Analytics
14. Platform Health Dashboard
15. Database Impact Analysis
16. API Impact Analysis
17. UI/UX Requirements
18. Execution Plan
19. Testing Plan
20. Final Review & Improvements

---

## CURRENT PLATFORM CONTEXT (REFERENCE)

This blueprint extends the existing platform; understanding the current state matters before adding anything.

**Stack**
- **Backend**: NestJS + Prisma ORM + PostgreSQL (Neon). Modules use a clean controller → service → Prisma layering with Zod DTOs.
- **Web**: React 19 + Vite + TypeScript + Tailwind + Radix UI + React Query + Zustand + React Router 7 + Recharts. Currently a **driver-facing** PWA. There is no admin web app yet.
- **Mobile**: Not present in this repo at the time of writing; future scope.
- **Auth**: JWT (access + refresh) via passport-jwt. JWT payload carries `{ sub, phone, driverId }` — **no `role` field exists**.
- **OCR**: Azure AI Vision (Computer Vision Read 4.0). Per [memory/azure-ocr-resource.md], Document Intelligence is disabled. OCR runs synchronously per request; no per-request persistence today.

**Existing Prisma models (driver-facing)**
- Identity: `User`, `RefreshToken`, `DeviceToken`, `PasswordResetToken`
- Driver/Vehicle: `Driver`, `Vehicle`, `AppSource`, `DriverApp`, `Area`, `DailyOdometer`
- Operations: `Trip`, `Session`, `FuelLog`, `Expense`, `MaintenanceItem`, `MaintenanceRecord`
- Intelligence: `Goal`, `Recommendation`, `Notification`, `ScoreSnapshot`
- Aggregates: `DailyAggregate`, `WeeklyAggregate`, `MonthlyAggregate`, `AppDailyAggregate`, `AreaDailyAggregate`
- Community: `CommunityPost`, `CommunityReaction`
- Reviews: `PlatformReview` (already supports `isApproved`/`isFeatured`)
- Support: `SupportTicket` (already supports lifecycle `OPEN → IN_REVIEW → PLANNED → RESOLVED → CLOSED`)

**Gaps the admin platform must close**
- No admin identity model (no roles, no admin accounts).
- No permission model (RBAC).
- No audit log infrastructure.
- No OCR usage telemetry persisted to the database.
- No subscription/revenue model.
- No platform metrics aggregation outside of per-driver aggregates.
- No moderation queue model.
- No admin-facing notification stream (existing `Notification` table is `driverId`-scoped).

These gaps drive the additive schema work described in Step 15.

---

## STEP 1 — ADMIN SYSTEM OVERVIEW

### Why the Admin Platform Exists

Ehsbha is a multi-tenant SaaS-grade product that helps independent rideshare and delivery drivers (Uber, Careem, inDrive, Didi, etc.) understand and optimize their earnings. As the platform grows, the operations team needs structured, safe, and auditable control over user identities, driver behavior, content moderation, support, and platform health. The Admin Platform is the operational nerve center for everything that is **not** a driver-facing surface.

### Business Goals
- **Trust at scale**: keep the platform clean, accurate, and credible — for both drivers and external stakeholders (partners, investors).
- **Operational leverage**: let a small ops team manage 10× the user base by surfacing the right work, in the right queue, at the right time.
- **Revenue readiness**: instrument the platform so that the day subscriptions/billing launches, revenue dashboards are already wired and historical.
- **Compliance & auditability**: every privileged action is logged, attributable, and reversible where possible.

### Operational Goals
- Search and act on any user, driver, trip, or piece of content in **≤ 3 clicks**.
- Triage support, moderation, and incidents from a single inbox-style queue.
- Detect platform anomalies (OCR drop, traffic spike, error rate, queue backlog) before users report them.

### Moderation Goals
- Keep community posts and reviews aligned with the platform's tone and accuracy standards.
- Provide clear, layered actions: hide, edit, feature, remove, and (rarely) ban.
- Make every moderation action reversible from the audit log.

### Support Goals
- Convert the existing `SupportTicket` model into a real help-desk workflow: assignment, SLA timer, internal notes, status transitions, customer reply threads.
- Bucket by category (BUG / FEATURE_REQUEST / IMPROVEMENT / QUESTION / OTHER) for product feedback loops.

### Growth Goals
- Expose the metrics that prove and accelerate growth: WAU/MAU, new-driver onboarding funnel, retention cohorts, feature adoption, OCR success rates.
- Surface power-user behavior and at-risk drivers so the team can reach out proactively.
- Provide an experimentation surface (feature flags / A-B) — designed-for, even if launched later.

---

## STEP 2 — ROLE & PERMISSION ARCHITECTURE (RBAC)

### Design Principles
- **Separate admin identity from driver identity.** Admin accounts live in a new `AdminUser` table, distinct from `User`. Admins do not consume driver SKUs or pollute driver analytics.
- **Roles are sets of permissions** stored in DB (not hard-coded in app code), so SuperAdmin can mint custom roles later.
- **Permissions are fine-grained `scope.action` strings.** Examples: `users.read`, `users.suspend`, `drivers.blacklist`, `community.delete`, `audit.read`, `roles.manage`.
- **All admin requests are double-authenticated**: JWT (admin scope) + per-action permission check. The guard fails closed.
- **Every mutating admin call writes to `AdminAuditLog`** (Step 11). Read-only calls are optionally sampled.
- **MFA is mandatory for SuperAdmin and Admin** (TOTP at minimum). Sessions for admins have shorter TTLs than driver sessions (e.g., access 15 min, refresh 8 h).
- **Impersonation** ("view as driver") is allowed for Admin/SupportAgent with a banner, time-boxed, and audited end-to-end.

### Permission Catalog (initial)

Format: `<scope>.<action>`. `*` is a wildcard.

| Scope | Actions |
|---|---|
| `dashboard` | `read` |
| `users` | `read`, `update`, `suspend`, `activate`, `blacklist`, `restore`, `delete`, `impersonate` |
| `drivers` | `read`, `update`, `suspend`, `activate`, `blacklist`, `restore`, `recalc_score` |
| `trips` | `read`, `update`, `delete`, `restore`, `bulk_export` |
| `vehicles` | `read`, `update`, `delete` |
| `ocr` | `read`, `replay`, `tune` |
| `community` | `read`, `hide`, `unhide`, `feature`, `unfeature`, `delete`, `restore` |
| `reviews` | `read`, `approve`, `unapprove`, `feature`, `unfeature`, `delete` |
| `support` | `read`, `assign`, `reply`, `transition`, `close` |
| `notifications` | `read`, `compose`, `broadcast` |
| `revenue` | `read`, `export` |
| `analytics` | `read`, `export` |
| `audit` | `read`, `export` |
| `roles` | `read`, `manage` |
| `settings` | `read`, `update` |
| `platform_health` | `read` |
| `feature_usage` | `read` |

### Required Roles

#### 1) Super Admin
- **Responsibilities**: ultimate platform owner. Manages other admins, roles, billing, dangerous operations.
- **Permissions**: `*` (all).
- **Restrictions**: cannot be self-deleted; deletion of a SuperAdmin requires another SuperAdmin and is logged with reason.
- **Accessible pages**: all sidebar entries, plus a hidden `/admin/danger-zone`.
- **Notable actions**: create/delete admins, manage roles, hard-delete records, rotate keys, change platform-wide settings.

#### 2) Admin
- **Responsibilities**: day-to-day platform management. Cannot manage other admins or roles.
- **Permissions**: everything except `roles.manage`, `users.delete` (hard delete), `settings.update` (only on a safe subset).
- **Restrictions**: cannot create/delete admins; cannot edit roles; cannot hard-delete users.
- **Accessible pages**: all sidebar entries except Roles & Permissions (read-only).
- **Notable actions**: suspend/activate users + drivers, moderate content, manage support, broadcast notifications.

#### 3) Moderator
- **Responsibilities**: community moderation and review curation.
- **Permissions**: `community.*` (no `delete` hard), `reviews.*` (no hard `delete`), `users.read`, `drivers.read`, `audit.read` (own actions only).
- **Restrictions**: cannot touch trips, OCR, revenue, settings, or notifications broadcast. Cannot suspend users beyond a 24h cooldown.
- **Accessible pages**: Dashboard (limited), Community, Reviews, Users (read-only), Drivers (read-only), Audit Logs (own).

#### 4) Support Agent
- **Responsibilities**: respond to support tickets, soft-edit users/drivers when needed.
- **Permissions**: `support.*`, `users.read`, `users.update` (limited fields: locale, timezone), `drivers.read`, `notifications.read`, `notifications.compose` (per-user only, not broadcast), `audit.read` (own).
- **Restrictions**: no community moderation, no revenue, no role management, no broadcast notifications.
- **Accessible pages**: Dashboard (support-focused), Support, Users, Drivers (read-only), Notifications (per-user).

#### 5) Analyst
- **Responsibilities**: read-only insights, exports, reports.
- **Permissions**: `*.read` only (`dashboard.read`, `analytics.read`, `analytics.export`, `revenue.read`, `revenue.export`, `feature_usage.read`, `platform_health.read`, `users.read`, `drivers.read`, `trips.read`, `community.read`, `reviews.read`, `audit.read`).
- **Restrictions**: cannot mutate any data; cannot impersonate; cannot send notifications.
- **Accessible pages**: Dashboard, Analytics, Revenue, Feature Usage, Platform Health, Users (read), Drivers (read), Trips (read), Audit (read).

### Demo Accounts (for Testing)

> These are seed-only credentials. Each password is hashed with bcrypt (cost 12) at seed time. **Rotate before production.**

| Role | Email | Password | Notes |
|---|---|---|---|
| Super Admin | `admin@ehsbha.com` | `SuperAdmin#2026` | Full access. MFA enforced on first login. |
| Admin | `manager@ehsbha.com` | `Manager#2026` | Day-to-day ops. MFA enforced. |
| Moderator | `moderator@ehsbha.com` | `Moderator#2026` | Community/reviews only. |
| Support Agent | `support@ehsbha.com` | `Support#2026` | Tickets + per-user notifications. |
| Analyst | `analyst@ehsbha.com` | `Analyst#2026` | Read-only across all analytics. |

**Demo permissions** for each demo account match the role definitions above. A "Switch role for demo" toggle in `/admin/settings/profile` lets SuperAdmin demote themselves temporarily for QA, with the original role restored on logout.

### Permission Enforcement Architecture

- **Backend**: a `RolesGuard` decorator-driven layer (`@RequirePermissions('users.suspend')`) is added on every admin controller. Lookup is O(1) using a `permissions: string[]` array materialized into the JWT at login. Refresh-on-role-change is handled by versioning the admin's `permissionsVersion` field — when bumped, all existing tokens fail authz and force re-login.
- **Frontend**: a `<Can permission="users.suspend">` component and a `usePermission()` hook gate UI affordances. UI gating is for UX only; the backend is the source of truth.

---

## STEP 3 — ADMIN SIDEBAR STRUCTURE

The admin platform lives in `apps/admin/` as a **completely independent React application** (binding decision; see "Monorepo Architecture" section above). It does **not** share routing, layouts, navigation, pages, or auth flows with `apps/web/`.

```
┌──────────────────────────────────────────┐
│  EHSBHA ADMIN                            │
├──────────────────────────────────────────┤
│  Dashboard                  /            │
│                                          │
│  CORE                                    │
│  Users                      /users       │
│  Drivers                    /drivers     │
│  Trips                      /trips       │
│  Vehicles                   /vehicles    │
│                                          │
│  INTELLIGENCE                            │
│  OCR System                 /ocr         │
│  Analytics                  /analytics   │
│  Feature Usage              /feature-usage│
│  Revenue                    /revenue     │
│                                          │
│  COMMUNITY                               │
│  Community                  /community   │
│  Reviews                    /reviews     │
│  Feedback                   /feedback    │
│                                          │
│  OPERATIONS                              │
│  Support                    /support     │
│  Notifications              /notifications│
│  Audit Logs                 /audit       │
│  Platform Health            /health      │
│                                          │
│  SYSTEM                                  │
│  Roles & Permissions        /roles       │
│  Settings                   /settings    │
└──────────────────────────────────────────┘
```

### Sidebar Behavior
- **Section grouping**: visually separated headers (`CORE`, `INTELLIGENCE`, `COMMUNITY`, `OPERATIONS`, `SYSTEM`). Each entry hides itself when the current admin lacks `*.read` for that scope.
- **Counter badges**: on Support (open tickets), Community (queued items), Reviews (pending approval), Audit Logs (last-24h flagged events), Notifications (admin alerts unread).
- **Collapsible**: pinned by default; collapse-on-mobile.
- **Search-as-command**: `Cmd+K` opens a global palette ("Jump to user", "Jump to ticket #123", "Suspend driver +20...").

### Accessibility & Localization
- **RTL**: Arabic is the default driver locale; the admin is **English-primary** with Arabic optional. Sidebar mirrors correctly under `dir="rtl"`.
- **Keyboard nav**: every sidebar item must be tab-focusable; cmd palette is fully keyboard-driven.

---

## STEP 4 — MAIN DASHBOARD DESIGN

The dashboard is the admin's "morning coffee" view: 60 seconds to know if the platform is healthy and what needs attention.

### Layout (top to bottom)

```
┌────────────────────────────────────────────────────────────────┐
│  Greeting + date + filter (Today | 7d | 30d | 90d | Custom)   │
├────────────────────────────────────────────────────────────────┤
│  TOP STRIP — 4 hero KPIs (Total Users, MAU, Drivers, Trips)   │
├────────────────────────────────────────────────────────────────┤
│  ROW 2 — User Metrics (5 small cards)                          │
├────────────────────────────────────────────────────────────────┤
│  ROW 3 — Driver Metrics (4 small cards)                        │
├────────────────────────────────────────────────────────────────┤
│  ROW 4 — Trip Metrics (4 small cards) + Trips chart            │
├────────────────────────────────────────────────────────────────┤
│  ROW 5 — OCR Metrics (4 small cards) + OCR success trend       │
├────────────────────────────────────────────────────────────────┤
│  ROW 6 — Business Metrics (4 small cards)                      │
├────────────────────────────────────────────────────────────────┤
│  ROW 7 — Action Queues (Support / Community / Reviews / Alerts)│
├────────────────────────────────────────────────────────────────┤
│  ROW 8 — Live Activity Feed (recent trips, signups, errors)   │
└────────────────────────────────────────────────────────────────┘
```

### Widgets

#### USER METRICS
| Card | Definition | Source |
|---|---|---|
| **Total Users** | Count of `User` (any status). | `SELECT count(*) FROM users` |
| **Active Users (MAU)** | Distinct users with any write event (trip, session, fuel, expense, login) in last 30d. | `materialized view mau_30d` |
| **New Users Today** | `User.createdAt >= today_start` in admin TZ. | `users` table |
| **New Users This Week** | `User.createdAt >= week_start` (ISO week, admin TZ). | `users` table |
| **New Users This Month** | `User.createdAt >= month_start` (admin TZ). | `users` table |

Each card shows **value + delta vs previous period + sparkline**.

#### DRIVER METRICS
| Card | Definition |
|---|---|
| **Total Drivers** | Count of `Driver`. |
| **Active Drivers** | Drivers with ≥ 1 trip in last 30d. |
| **Inactive Drivers** | Drivers with **0** trips in last 30d but `User.status = ACTIVE`. |
| **Driver Retention** | Of drivers who logged a trip in month N, % who logged ≥ 1 trip in month N+1 (cohort table beneath). |

#### TRIP METRICS
| Card | Definition |
|---|---|
| **Total Trips** | `count(trips)`. |
| **Trips Today** | `Trip.startedAt >= today_start`. |
| **Trips Weekly** | Last 7 days rolling. |
| **Trips Monthly** | Last 30 days rolling. |

Plus a **stacked area chart**: trips per day, segmented by `driverAppId` (Uber / Careem / inDrive / Didi / Other).

#### OCR METRICS
| Card | Definition |
|---|---|
| **OCR Requests** | `count(ocr_extraction_log)` in period. |
| **OCR Success Rate** | % where `confidence ≥ threshold` AND validator passed AND user accepted parsed fields. |
| **OCR Failure Rate** | 100% – success rate. Breakdown: detection-fail / parse-fail / validation-fail / user-rejected. |
| **Detection Accuracy** | Per-platform accuracy from labeled samples + driver feedback ("Was this correct?"). |

Plus a **per-platform success-rate sparkline** (UBER / CAREEM / INDRIVE / DIDI).

> Note: `ocr_extraction_log` does not exist today — see Step 15.

#### BUSINESS METRICS
| Card | Definition |
|---|---|
| **Growth Rate** | (new users this period − new users previous period) / previous period. |
| **Engagement Rate** | DAU / MAU. |
| **Retention Rate** | 30-day rolling cohort retention. |
| **Conversion Rate** | Signup → first trip recorded; signup → 5th trip (proxy for activation). When billing exists: free → paid conversion. |

### Action Queues (Row 7)
Each is a compact card with a count and a "view all" link:
- **Open Support Tickets** (by SLA breach proximity).
- **Pending Reviews** (`isApproved = false`).
- **Flagged Community Posts** (reported by users OR auto-flagged).
- **Admin Alerts** (Step 10 — OCR drop, error spike, etc.).

### Live Activity Feed (Row 8)
Server-side paginated stream (newest first, 30s polling or SSE). Each row:
`[timestamp] [icon] [verb] [subject] → [object]`
Examples:
- `09:12 · 🛵 · driver +201… recorded trip 1,250 EGP`
- `09:11 · 👤 · new signup +201…`
- `09:10 · ⚠️ · OCR failed for image hash abc… (CAREEM detector)`
- `09:08 · 💬 · post #42 flagged by 2 drivers`

Filter chips: All / Trips / Signups / OCR / Errors / Moderation.

---

## STEP 5 — USER MANAGEMENT MODULE

### User List
- **Route**: `/users`
- **Columns**: phone, email, status badge, locale, signup date, last activity, driver?, # trips, account flags.
- **Filters**: status (ACTIVE/SUSPENDED/DELETED), locale, has-driver, signup-range, last-activity-range, blacklist-flag, has-open-ticket.
- **Search**: phone (partial match with E.164 normalization), email, internal id.
- **Sorting**: by createdAt, last activity, # trips.
- **Bulk actions**: export CSV (admin+), suspend (admin+ with confirm modal), bulk-message (admin+).

### User Details
- **Route**: `/users/:id`
- **Tabs**:
  1. **Overview**: identity card, status timeline, account flags, recent logins (with IP / device).
  2. **Driver** (if linked): driver profile snapshot + jump to `/drivers/:id`.
  3. **Activity**: trips, sessions, fuel, expenses (read-only timeline).
  4. **Notifications** (sent to this user): list + delivery status.
  5. **Tickets**: all support tickets, current + historical.
  6. **Devices**: registered `DeviceToken` entries, last used, platform.
  7. **Audit**: all admin actions affecting this user (audit log filtered).

### User Activity
- A timeline view stitching trips, sessions, fuel logs, expenses, maintenance records, score snapshots, ticket events, and admin actions into a single chronological stream.
- Color coded by source; expandable rows show payload.

### User Status

Existing enum: `ACTIVE | SUSPENDED | DELETED`. Admin platform extends behavior on top:

| Action | Effect | Reversible? | Required permission |
|---|---|---|---|
| **Edit** | Update locale, timezone, email (with re-verification). | Yes | `users.update` |
| **Disable / Suspend** | `status = SUSPENDED`. Login blocked. Refresh tokens revoked. | Yes (Activate). | `users.suspend` |
| **Activate** | `status = ACTIVE`. | Yes | `users.activate` |
| **Blacklist** | Sets `is_blacklisted = true` (new column) AND `status = SUSPENDED`. Phone added to a `BlocklistedIdentifier` table to prevent re-signup. | Yes (Restore). | `users.blacklist` |
| **Restore** | Removes blacklist + sets `status = ACTIVE`. | Yes | `users.restore` |
| **Hard Delete** | Anonymize + cascade delete. SuperAdmin only. Audit-locked. | No | `users.delete` |

All status changes require a **reason** (free text + select-from-list) and produce an audit log entry.

---

## STEP 6 — DRIVER MANAGEMENT MODULE

### Driver Profiles
- **Route**: `/drivers/:id`
- **Header**: photo, display name, base city, linked phone, joined date, role chips (e.g., "Top 10% earner", "OCR power user").
- **Tabs**:
  1. **Overview**: KPI cards (trips/d avg, gross/d avg, profit/d avg, score current, retention metric).
  2. **Vehicles**: list with active flag, fuel type, odometer, cost-intelligence (existing fields like `fuelTankCostPiastres`).
  3. **Apps**: `DriverApp` rows with commission %, color, enabled flag.
  4. **Areas**: `Area` rows.
  5. **Trips**: paginated trip list, deep-linkable.
  6. **Earnings**: from `DailyAggregate` / `WeeklyAggregate` / `MonthlyAggregate`.
  7. **Score**: time series chart of `ScoreSnapshot` (overall, efficiency, profit, safety, consistency).
  8. **Goals**: current + historical `Goal` rows.
  9. **Recommendations**: served + dismissed.
  10. **Audit**: admin actions touching this driver.

### Driver Statistics
Driver-level analytics view:
- Daily/Weekly/Monthly profit progression.
- Per-app contribution (using `AppDailyAggregate`).
- Per-area contribution (using `AreaDailyAggregate`).
- Fuel efficiency over time (`fuelKmPerLiterCenti`).
- Empty-ratio over time (`emptyRatioBp`).

### Driver Scores
Pulled from `ScoreSnapshot`. Admins can:
- **Recalculate** a driver's score on demand (`drivers.recalc_score`) — useful after data correction.
- **Inspect inputs** to the score (calls the existing `analytics/engines/score.engine.ts` in read-only mode and displays inputs/outputs).

### Driver Analytics
Cross-driver views:
- Top 100 earners (by `MonthlyAggregate.netProfitPiastres`).
- Most active drivers (by trip count).
- At-risk drivers (active 30d ago, inactive 7d).
- Per-app driver leaderboards.

### Actions

| Action | Effect | Reversible? | Permission |
|---|---|---|---|
| **Suspend** | Driver hidden from community + reviews; user still functional unless paired with user suspend. | Yes | `drivers.suspend` |
| **Activate** | Restore visibility. | Yes | `drivers.activate` |
| **Blacklist** | Same as user blacklist but driver-scoped; also cascades to community/reviews removal. | Yes | `drivers.blacklist` |
| **Restore** | Reverse blacklist. | Yes | `drivers.restore` |
| **Edit profile** | display name, photo URL, base city. | Yes | `drivers.update` |
| **Recalc score** | Rebuild today's `ScoreSnapshot`. | No (idempotent overwrite). | `drivers.recalc_score` |

---

## STEP 7 — TRIP MANAGEMENT MODULE

### All Trips
- **Route**: `/trips`
- **Columns**: started/ended, driver (phone/name link), app, area, gross EGP, net EGP, km, paid km, empty km, source (manual / OCR), client mutation id.
- **Filters**: driver id, app, area, date range, gross range, has-OCR-origin, has-anomaly flag, deleted.
- **Search**: by trip id, by driver phone, by client mutation id (for OCR debugging).
- **Bulk**: export CSV, soft-delete (with reason), restore.

### Trip Details
- **Route**: `/trips/:id`
- Sections: timing, financials (gross / received / tip / commission / toll / parking, all rendered in EGP from piastres), distances (total/paid/empty), driver/app/area links, original OCR payload (if any), audit history.

### Filters
The trip list filters should mirror the existing `TripsListPage` plus admin-only filters:
- `originAdmin = true` (admin-edited).
- `softDeleted = true` (only deleted).
- `appCode = "UBER"`, etc.

### Search
Global cmd-K search supports trip lookup by `id`, `clientMutationId`, and driver phone.

### Actions

| Action | Effect | Reversible? | Permission |
|---|---|---|---|
| **Edit** | Mutate any field (with confirm modal showing diff). Original snapshot stored in audit log. Aggregates recomputed for affected day(s). | Yes (revert from audit) | `trips.update` |
| **Soft Delete** | Sets `deletedAt = now()` (new column). Excluded from driver views and aggregates. | Yes | `trips.delete` |
| **Restore** | Clears `deletedAt`. Re-runs aggregates. | Yes | `trips.restore` |
| **Bulk Export** | CSV of filtered list. | n/a | `trips.bulk_export` |

> Note: `deletedAt` and `originAdmin` columns do not exist today on `Trip` — see Step 15.

---

## STEP 8 — COMMUNITY MODERATION SYSTEM

The existing `CommunityPost` model already has `isHidden`. We extend it with: a moderation queue, report tracking, and a moderation history.

### Routes
- `/community` — overview + queue.
- `/community/posts` — all posts table.
- `/community/posts/:id` — single post drilldown.
- `/community/reports` — reports queue.

### Moderation Targets
- **Reviews** (`PlatformReview`): `isApproved`, `isFeatured` already exist.
- **Community Posts** (`CommunityPost`): `isHidden`, `trendingScore` exist.
- **Suggestions**: today maps to `SupportTicket` with category `FEATURE_REQUEST`/`IMPROVEMENT`. Stays in Support module but is mirrored here as the public-facing voice.
- **Reports**: a new `CommunityReport` model (Step 15) capturing who reported what and why.

### Moderation Queue
Inbox-style list of items needing decision:
- All new `PlatformReview` rows with `isApproved = false`.
- All `CommunityPost` rows with `report_count >= threshold` (e.g., 2) and `isHidden = false`.
- All `CommunityPost` rows auto-flagged (profanity dict / sentiment heuristic).
- Sorted by severity then time.

Each row shows: snippet, author, category, report reasons aggregated, and quick-action buttons.

### Actions

| Action | Subject | Effect | Reversible? | Permission |
|---|---|---|---|---|
| **Approve** | Review | `isApproved = true`. | Yes (Unapprove). | `reviews.approve` |
| **Reject** | Review | `isApproved = false` + hide. Optionally send rejection notification. | Yes | `reviews.unapprove` |
| **Hide** | Community post | `isHidden = true`. Author informed via notification (configurable). | Yes (Unhide). | `community.hide` |
| **Feature** | Review or Post | `isFeatured = true` (on reviews; new column on posts). | Yes (Unfeature). | `community.feature` / `reviews.feature` |
| **Blacklist (author)** | Community / Reviews | Triggers driver-level blacklist flow (Step 6). | Yes (Restore). | `drivers.blacklist` |
| **Hard Delete** | Post or review | Removes from DB. SuperAdmin only. Audit-locked. | No | `community.delete` / `reviews.delete` |

### Auto-Moderation (Phase 3)
- Profanity dictionary (Arabic + English) — flags but doesn't auto-hide.
- Sentiment-based ranking (existing `trendingScore`).
- Rate-limit detection (same author posts >N/min) — auto-throttles, alerts admin.

---

## STEP 9 — SUPPORT CENTER

Extends the existing `SupportTicket` model with assignment, internal notes, and threaded replies.

### Routes
- `/support` — queue.
- `/support/:id` — single ticket.

### Queue Buckets
- **Mine** (assigned to current admin).
- **Unassigned**.
- **Open / In Review / Planned / Resolved / Closed** (uses existing `TicketStatus` enum).
- **Filter chips**: category (BUG / FEATURE_REQUEST / IMPROVEMENT / QUESTION / OTHER).

### Ticket Detail
Layout: left = ticket history thread, right = metadata sidebar.
- **Metadata**: requester (user link), assignee (admin), category, status, SLA timer, related driver, related trip (if linked), creation date.
- **Thread**: original message → admin replies → internal notes (admin-only). Each reply can attach images/screenshots.
- **Quick actions**: assign to me, change status, link to driver, link to trip, add internal note, escalate.

### Lifecycle

```
       ┌──────┐
       │ OPEN │
       └──┬───┘
          │ (admin reads / assigns)
       ┌──▼────────┐
       │ IN_REVIEW │
       └──┬────────┘
          │ (waiting on product / engineering)
       ┌──▼──────┐
       │ PLANNED │
       └──┬──────┘
          │ (ship)
       ┌──▼───────┐
       │ RESOLVED │
       └──┬───────┘
          │ (after 7d auto, or admin)
       ┌──▼───────┐
       │  CLOSED  │
       └──────────┘
```

Any state can transition to any other state by an admin with `support.transition`, with a required reason.

### SLA
- Default: respond within 24h.
- Visual indicator on queue: green (<50% SLA), amber (50-90%), red (>90% / breached).
- SLA stops while in `PLANNED` (engineering ball).

### Auto-routing (Phase 3)
- BUG → engineering rotation.
- FEATURE_REQUEST → product rotation.
- QUESTION → first available support agent.

---

## STEP 10 — NOTIFICATION CENTER

Two distinct surfaces share this module name:

### A) Admin Alerts (inbound, system → admin)

A new `AdminAlert` table (Step 15) captures platform events that need admin awareness.

**Alert types (initial catalog)**
| Code | Trigger | Severity |
|---|---|---|
| `OCR_ACCURACY_DROP` | OCR success rate over last 1h < threshold (e.g., 85%). | High |
| `OCR_AZURE_ERROR_SPIKE` | Azure error rate > 5% in 15m. | High |
| `USER_GROWTH_SPIKE` | New signups in last 1h > 3× moving avg. | Info |
| `USER_DROPOFF` | DAU drops >20% week-over-week. | High |
| `UNUSUAL_USER_ACTIVITY` | Single user > N trips/min OR > N logins/min. | Medium |
| `MODERATION_BACKLOG` | Moderation queue > 50 items. | Medium |
| `SUPPORT_BACKLOG` | > N open tickets older than SLA. | High |
| `BACKEND_ERROR_RATE` | Server 5xx rate > threshold. | High |
| `DB_HEALTH` | Slow queries OR replication lag. | Critical |

**Delivery channels**
- In-app (admin sidebar badge + `/notifications` page).
- Email (configurable per admin in `/settings/profile`).
- Slack / webhook (configurable system-wide in `/settings/integrations`).

### B) Admin → User/Driver Notifications (outbound)

Three flavors:
1. **Per-user**: support agent sends a message to a specific user (creates `Notification` row via existing `notifications.service`).
2. **Targeted broadcast**: send to a filtered driver cohort (e.g., "All Cairo-based UBER drivers with 0 trips in 7d"). Cohort is defined via the same filter UI as `/users` and `/drivers`.
3. **Platform broadcast**: send to all drivers. SuperAdmin/Admin only. Confirmation modal shows recipient count + sample preview.

All outbound notifications support a preview, scheduling, A/B variants (Phase 4), and post-send delivery analytics (sent / delivered / read).

---

## STEP 11 — AUDIT LOG SYSTEM

### Goals
- Attribute every privileged action to a human.
- Make every change reversible OR at least diff-readable.
- Be queryable, exportable, and tamper-evident.

### Data Model
A single `AdminAuditLog` table (full schema in Step 15) that captures, per action:
- `id`
- `actorAdminId` (FK to AdminUser)
- `actorRole` (snapshot at time of action)
- `action` (e.g., `users.suspend`, `trips.update`, `community.hide`)
- `targetType` (e.g., `User`, `Driver`, `Trip`, `CommunityPost`)
- `targetId`
- `before` (JSONB snapshot — null for create)
- `after` (JSONB snapshot — null for delete)
- `reason` (free text + categorized chip)
- `ip`, `userAgent`, `deviceId`
- `occurredAt` (timestamp)
- `requestId` (correlation id to API logs)

### Views

#### `/audit` — Global Log
- Filters: actor, action, targetType, targetId, date range, severity, ip.
- Each row expandable to show before/after diff (JSON pretty-diff component).
- Export to CSV / JSONL.

#### `/audit/by-target/:targetType/:targetId`
- Filter pre-applied. Used from "Audit" tab inside user / driver / trip / post pages.

### Tamper Evidence
- `AdminAuditLog` rows are **append-only**: a trigger forbids `UPDATE` and `DELETE` at the DB level.
- An `hmac_chain` column stores `hmac(prev_row_hmac || serialized_row, secret)`. Periodic verifier confirms chain integrity. (Phase 4 if time-constrained.)

### Retention
- Default: 2 years online, 5 years archived to S3/Glacier (or equivalent). Configurable in `/settings/retention`.

---

## STEP 12 — REVENUE ANALYTICS (FUTURE-READY)

Subscriptions are not implemented today. The Admin Platform ships **revenue dashboards from day one** so that when billing launches, history exists.

### Future Data Model (Step 15)
- `SubscriptionPlan` (id, code, name, priceCents, currency, billingPeriod, features[], isActive)
- `Subscription` (id, userId, planId, status, startedAt, endsAt, cancelledAt, providerRef)
- `Invoice` (id, subscriptionId, amountCents, currency, status, paidAt, providerRef)
- `Coupon` (id, code, type, value, validFrom, validTo, maxRedemptions)

### Routes
- `/revenue` — overview.
- `/revenue/subscriptions` — subscription list.
- `/revenue/invoices` — invoice list.
- `/revenue/cohorts` — cohort retention by plan.
- `/revenue/plans` — plan catalog (SuperAdmin only).

### Metrics
| Metric | Definition |
|---|---|
| **MRR** | Σ active subscription monthly-normalized prices. |
| **ARR** | MRR × 12. |
| **Revenue (period)** | Σ paid invoice amounts. |
| **Subscription Plans** | Active count per plan; conversion paths between plans. |
| **Conversion Rate** | Free → paid in given period. |
| **Churn Rate** | Subs cancelled / subs at start of period. |
| **Lifetime Value (LTV)** | Avg revenue per user × avg user lifespan. |
| **Avg Revenue Per User (ARPU)** | MRR / active subscribers. |

### Visualization
- MRR trend (12 months).
- New MRR vs Churned MRR (waterfall).
- Plan distribution (donut).
- Cohort retention heatmap.

### Pre-launch Behavior
Before subscriptions exist, every metric shows `—` with a tooltip "Available once billing is enabled." The page exists and the schema is in place.

---

## STEP 13 — FEATURE USAGE ANALYTICS

Tracks how drivers use each major platform capability.

### Tracked Features (initial)
| Feature | Source |
|---|---|
| **OCR Extraction** | `OcrExtractionLog` (new — Step 15). |
| **Smart Decisions** | Existing `recommendations` service + new `FeatureEvent` (Step 15). |
| **Profit Simulator** | Frontend pageview events → `FeatureEvent`. |
| **Trip Management** | Counts from `Trip` table grouped by driver/period. |
| **Maintenance** | Counts from `MaintenanceRecord` + `MaintenanceItem`. |
| **Work Planner** | `FeatureEvent`. |
| **Best Hours** | `FeatureEvent`. |
| **Driver Score** | View counts + score recalc requests. |
| **Vehicle Health** | `FeatureEvent`. |
| **Community** | Posts created + reactions. |
| **Reviews** | Submitted reviews. |

### Per-Feature View
- Usage count (period).
- Unique drivers (period).
- Adoption rate = unique drivers using feature / unique active drivers.
- Trend chart (90-day default).
- Retention curve (week-1 / week-2 / week-4 of using the feature).

### Cross-Feature View
- Feature heatmap: rows = features, columns = weeks, color = adoption.
- Funnel: signup → first trip → first OCR → first community post → first review.

### Eventing
A lightweight `FeatureEvent` table (Step 15) stores: `driverId`, `feature`, `event` (`view` / `use` / `success` / `fail`), `payload`, `occurredAt`. Buffered batch insert from the frontend (1 req / 30s / driver).

---

## STEP 14 — PLATFORM HEALTH DASHBOARD

A real-time monitoring view scoped to **what the admin can act on**, distinct from low-level APM (which lives in Sentry/Grafana).

### Modules

#### API Health
- Per-route p50 / p95 / p99 latencies (rolling 5m / 1h / 24h).
- Error rate per route.
- Throughput (req/min).
- Auth failures (rolling).
- Top-5 slowest endpoints.

#### Database Health
- Active connections / max connections.
- Slow query log (top 20 last hour).
- Lock wait time.
- Replication lag (Neon dual endpoint awareness).
- Index hit rate (cache).

#### OCR Service Health
- Azure Vision availability (last 100 calls).
- Per-platform parser success rates.
- Mean/median confidence.
- Image processing latency (`sharp` step).
- Queue depth (Phase 2 — once OCR moves async).

#### Queue Health
- For each background job (`nightly-aggregates.job.ts`, future OCR queue, future notification dispatch): lag, in-flight, failures last hour, last successful run.

#### Storage Health
- S3 / object storage usage (image uploads).
- DB disk usage.
- Backup status (last backup timestamp + size).

### Data Source
- Backend exports a `/admin/health/snapshot` endpoint that aggregates from: Prisma metrics, NestJS instrumentation, Azure Vision client telemetry, scheduled job heartbeat table (new — Step 15).
- Refresh: 30s polling (or SSE in Phase 3).

### Alerting
Health degradations write `AdminAlert` rows (Step 10) so they appear in the admin notification feed.

---

## STEP 15 — DATABASE IMPACT ANALYSIS

For every admin module, the schema additions, relationships, and indexes required. **No existing tables are dropped or breaking-changed.** All migrations are additive.

### A) RBAC Tables

#### `admin_users`
```
admin_users
  id              cuid pk
  email           text unique
  password_hash   text
  display_name    text
  is_active       boolean default true
  permissions_version int default 1
  mfa_enabled     boolean default false
  mfa_secret      text nullable
  last_login_at   timestamptz nullable
  last_login_ip   text nullable
  created_at      timestamptz
  updated_at      timestamptz
  created_by      cuid nullable (fk → admin_users.id)
```
Indexes: `email`, `is_active`.

#### `admin_roles`
```
admin_roles
  id            cuid pk
  code          text unique  // 'super_admin', 'admin', 'moderator', 'support', 'analyst', or custom
  name          text
  description   text
  is_system     boolean default false  // built-in roles cannot be deleted
  created_at    timestamptz
  updated_at    timestamptz
```

#### `admin_permissions`
```
admin_permissions
  id           serial pk
  scope        text   // 'users', 'drivers', ...
  action       text   // 'read', 'update', ...
  description  text
  unique(scope, action)
```

#### `admin_role_permissions`
```
admin_role_permissions
  role_id        cuid (fk → admin_roles.id, on delete cascade)
  permission_id  int  (fk → admin_permissions.id)
  pk(role_id, permission_id)
```

#### `admin_user_roles`
```
admin_user_roles
  admin_user_id cuid (fk → admin_users.id, on delete cascade)
  role_id       cuid (fk → admin_roles.id)
  granted_at    timestamptz
  granted_by    cuid (fk → admin_users.id)
  pk(admin_user_id, role_id)
```

#### `admin_refresh_tokens`
Same shape as existing `refresh_tokens`, scoped to admins. Short TTL.

#### `admin_mfa_backup_codes`
```
admin_mfa_backup_codes
  id             cuid pk
  admin_user_id  cuid (fk → admin_users.id)
  code_hash      text
  used_at        timestamptz nullable
  created_at     timestamptz
```

### B) Audit Tables

#### `admin_audit_logs`
```
admin_audit_logs
  id              cuid pk
  actor_admin_id  cuid (fk → admin_users.id)
  actor_role      text
  action          text   // 'users.suspend', 'trips.update', ...
  target_type     text   // 'User', 'Driver', ...
  target_id       text
  before          jsonb nullable
  after           jsonb nullable
  reason          text nullable
  reason_code     text nullable    // categorized chip
  ip              text nullable
  user_agent      text nullable
  device_id       text nullable
  request_id      text nullable
  hmac_chain      text nullable    // phase 4 tamper-evident
  occurred_at     timestamptz default now()
```
Indexes: `(target_type, target_id, occurred_at desc)`, `(actor_admin_id, occurred_at desc)`, `(action, occurred_at desc)`, `(occurred_at desc)`.
DB constraint: trigger blocks UPDATE/DELETE.

### C) User / Driver / Trip Additive Columns

Add to `users`:
- `is_blacklisted boolean default false`
- `blacklist_reason text nullable`
- `blacklisted_at timestamptz nullable`

Add to `drivers`:
- `is_blacklisted boolean default false`
- `is_suspended boolean default false`  (orthogonal to user-level)
- `notes text nullable` (admin notes, not visible to driver)

Add to `trips`:
- `deleted_at timestamptz nullable`
- `origin text default 'driver'`   // 'driver' | 'admin' | 'ocr'
- `last_edited_by_admin_id cuid nullable`

New table:
- `blocklisted_identifiers` — phones / emails / device ids that cannot register.

```
blocklisted_identifiers
  id          cuid pk
  kind        text   // 'phone' | 'email' | 'device'
  value       text
  reason      text
  created_by  cuid (fk → admin_users.id)
  created_at  timestamptz
  unique(kind, value)
```

### D) OCR Telemetry

#### `ocr_extraction_log`
```
ocr_extraction_log
  id                 cuid pk
  driver_id          cuid nullable (fk → drivers.id)
  request_id         text
  image_hashes       text[]
  platform_hint      text nullable
  detected_platform  text nullable
  trip_count         int
  mean_confidence    decimal(4,3) nullable
  status             text   // 'success' | 'partial' | 'failure'
  failure_reason     text nullable
  duration_ms        int
  azure_duration_ms  int nullable
  user_accepted      boolean nullable   // updated post-acceptance
  created_at         timestamptz default now()
```
Indexes: `(driver_id, created_at desc)`, `(detected_platform, created_at desc)`, `(status, created_at desc)`.

### E) Community / Reviews Additive

Add to `community_posts`:
- `is_featured boolean default false`
- `report_count int default 0`
- `auto_flag_score float default 0`
- `moderation_status text default 'clean'`  // 'clean' | 'flagged' | 'hidden' | 'removed'

#### `community_reports`
```
community_reports
  id             cuid pk
  post_id        cuid (fk → community_posts.id)
  reporter_driver_id cuid (fk → drivers.id)
  reason_code    text
  notes          text nullable
  status         text default 'open'  // 'open' | 'reviewed' | 'dismissed' | 'actioned'
  reviewed_by    cuid nullable (fk → admin_users.id)
  reviewed_at    timestamptz nullable
  created_at     timestamptz default now()
  unique(post_id, reporter_driver_id)
```

### F) Support Extension

Add to `support_tickets`:
- `assignee_admin_id cuid nullable (fk → admin_users.id)`
- `priority text default 'normal'`
- `sla_breach_at timestamptz nullable`
- `linked_trip_id cuid nullable (fk → trips.id)`
- `linked_driver_id cuid nullable (fk → drivers.id)`

#### `support_messages`
```
support_messages
  id              cuid pk
  ticket_id       cuid (fk → support_tickets.id, on delete cascade)
  author_kind     text  // 'user' | 'admin'
  author_user_id  cuid nullable
  author_admin_id cuid nullable
  body            text
  is_internal     boolean default false
  attachments     jsonb nullable
  created_at      timestamptz default now()
```
Index: `(ticket_id, created_at)`.

### G) Notifications Extension

Add to `notifications`:
- `created_by_admin_id cuid nullable`
- `campaign_id cuid nullable`

#### `admin_alerts`
```
admin_alerts
  id           cuid pk
  code         text   // 'OCR_ACCURACY_DROP', ...
  severity     text   // 'info' | 'medium' | 'high' | 'critical'
  title        text
  body         text
  payload      jsonb
  read_by      jsonb default '[]'  // array of admin ids who read
  resolved_at  timestamptz nullable
  resolved_by  cuid nullable (fk → admin_users.id)
  created_at   timestamptz default now()
```
Index: `(severity, created_at desc)`, `(code, created_at desc)`.

#### `notification_campaigns`
```
notification_campaigns
  id               cuid pk
  created_by       cuid (fk → admin_users.id)
  name             text
  cohort_filter    jsonb   // serialized filter used to compute audience
  channel          text    // 'push' | 'inapp' | 'both'
  title            text
  body             text
  data             jsonb
  scheduled_for    timestamptz nullable
  sent_at          timestamptz nullable
  recipient_count  int default 0
  delivered_count  int default 0
  read_count       int default 0
  status           text default 'draft'  // 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled'
```

### H) Revenue (Future)

Tables as described in Step 12: `subscription_plans`, `subscriptions`, `invoices`, `coupons`, `coupon_redemptions`.

### I) Feature Usage

#### `feature_events`
```
feature_events
  id           cuid pk
  driver_id    cuid (fk → drivers.id)
  feature      text   // 'ocr', 'decisions', 'simulator', ...
  event        text   // 'view' | 'use' | 'success' | 'fail'
  payload      jsonb nullable
  occurred_at  timestamptz default now()
```
Index: `(driver_id, feature, occurred_at desc)`, `(feature, occurred_at desc)`.

### J) Platform Health

#### `job_heartbeats`
```
job_heartbeats
  job_code       text pk
  last_started_at  timestamptz
  last_finished_at timestamptz
  last_status      text
  last_error       text nullable
  in_flight        boolean default false
  updated_at       timestamptz
```

### K) Settings

#### `admin_settings` (key-value)
```
admin_settings
  key         text pk
  value       jsonb
  updated_by  cuid (fk → admin_users.id)
  updated_at  timestamptz
```
Keys: `moderation.report_threshold`, `support.sla_hours`, `ocr.success_threshold`, `notifications.email_enabled`, `audit.retention_days`, etc.

### Index Strategy Summary
- All time-series tables: `(scope_key, created_at desc)`.
- All target-keyed audit/event tables: `(target_type, target_id, occurred_at desc)`.
- All status-bucketed admin tables: partial indexes where appropriate (e.g., `where status = 'open'`).
- All foreign keys: indexed.

---

## STEP 16 — API IMPACT ANALYSIS

All admin endpoints live under `/api/v1/admin/...` and are gated by `AdminJwtAuthGuard` + `@RequirePermissions(...)`.

### Conventions
- **Pagination**: cursor-based for high-volume endpoints (trips, audit, feature_events), offset for finite lists (admins, roles).
- **Validation**: every body/query validated via Zod (same pattern as existing modules).
- **Errors**: stable `code` strings (existing pattern, e.g., `OCR_INVALID_HINTS`). Admin errors prefixed `ADMIN_...`.
- **Audit hook**: every controller that mutates state injects `AuditService.record(...)` in the service layer.

### Endpoints by Module

#### Auth (admin)
- `POST /admin/auth/login` — email + password (+ MFA token if enabled). Returns access + refresh.
- `POST /admin/auth/refresh`
- `POST /admin/auth/logout`
- `POST /admin/auth/mfa/setup` — generate secret + QR.
- `POST /admin/auth/mfa/verify` — confirm setup.
- `POST /admin/auth/mfa/disable` — requires re-auth.

Validation: standard zod. MFA enforced for SuperAdmin + Admin roles.

#### Dashboard
- `GET /admin/dashboard/overview?range=7d` — returns all KPI cards in one payload.

Permissions: `dashboard.read`.

#### Users
- `GET /admin/users` — filters, search, pagination.
- `GET /admin/users/:id` — full profile (overview tab).
- `GET /admin/users/:id/activity?type=...`
- `PATCH /admin/users/:id` — limited fields per role.
- `POST /admin/users/:id/suspend` (reason required).
- `POST /admin/users/:id/activate`.
- `POST /admin/users/:id/blacklist`.
- `POST /admin/users/:id/restore`.
- `DELETE /admin/users/:id` (SuperAdmin only, hard delete).
- `POST /admin/users/:id/impersonate` — returns short-lived impersonation token.

Permissions per route as defined in Step 2.

#### Drivers
- `GET /admin/drivers`, `GET /admin/drivers/:id`, plus tabs.
- `POST /admin/drivers/:id/suspend|activate|blacklist|restore|recalc-score`.

#### Trips
- `GET /admin/trips` — wide filter set + cursor.
- `GET /admin/trips/:id`.
- `PATCH /admin/trips/:id` — full diff stored to audit.
- `DELETE /admin/trips/:id` (soft).
- `POST /admin/trips/:id/restore`.
- `GET /admin/trips/export.csv?...`.

#### Vehicles
- `GET /admin/vehicles`, `GET /admin/vehicles/:id`.
- `PATCH /admin/vehicles/:id`, `DELETE /admin/vehicles/:id`.

#### OCR
- `GET /admin/ocr/log` — extraction log list.
- `GET /admin/ocr/log/:id` — full payload.
- `POST /admin/ocr/replay` — re-runs OCR on a stored image hash (Phase 3 — requires image retention).
- `GET /admin/ocr/metrics?range=...`.
- `PATCH /admin/ocr/settings` — tweak confidence thresholds (SuperAdmin).

#### Community / Reviews / Feedback
- `GET /admin/community/posts` and `/admin/community/reports`.
- `POST /admin/community/posts/:id/hide|unhide|feature|unfeature|delete`.
- `POST /admin/community/reports/:id/dismiss|action`.
- `GET /admin/reviews`, `POST /admin/reviews/:id/approve|unapprove|feature|delete`.

#### Support
- `GET /admin/support/tickets` — queue filters.
- `GET /admin/support/tickets/:id` — includes messages.
- `POST /admin/support/tickets/:id/assign` (admin id).
- `POST /admin/support/tickets/:id/messages` (with `is_internal` flag).
- `POST /admin/support/tickets/:id/transition` (new status + reason).
- `POST /admin/support/tickets/:id/link` (trip or driver).

#### Notifications
- `GET /admin/alerts` — admin alert feed.
- `POST /admin/alerts/:id/resolve`.
- `GET /admin/campaigns`, `POST /admin/campaigns` (compose), `POST /admin/campaigns/:id/send`, `POST /admin/campaigns/:id/cancel`.
- `POST /admin/notifications/per-user` — single-recipient send.

#### Revenue (future)
- `GET /admin/revenue/overview`, `GET /admin/revenue/subscriptions`, `GET /admin/revenue/invoices`, `GET /admin/revenue/cohorts`.
- `POST /admin/revenue/plans` (SuperAdmin).

#### Analytics / Feature Usage
- `GET /admin/analytics/...` — endpoint family for each chart.
- `GET /admin/feature-usage?feature=ocr&range=30d`.

#### Audit
- `GET /admin/audit` — global filter+search.
- `GET /admin/audit/by-target/:type/:id`.
- `GET /admin/audit/export.csv?...`.

#### Roles & Permissions
- `GET /admin/roles`, `POST /admin/roles`, `PATCH /admin/roles/:id`, `DELETE /admin/roles/:id`.
- `GET /admin/permissions`.
- `POST /admin/admins`, `PATCH /admin/admins/:id/roles`, `DELETE /admin/admins/:id`.

All require `roles.manage`.

#### Settings
- `GET /admin/settings`, `PATCH /admin/settings`.

#### Health
- `GET /admin/health/snapshot` — composite payload (API / DB / OCR / Queue / Storage).
- `GET /admin/health/api`, `/db`, `/ocr`, `/queue`, `/storage` — per-domain detail.

### Validation Rules (universal)
- Body limits: 1MB by default; image-bearing endpoints follow OCR's existing 5MB/5-file rule.
- Rate limits: per-admin token, 600 req/min. Sensitive endpoints (`/suspend`, `/blacklist`, `/delete`) are throttled to 60/min and require a fresh password challenge if from a new IP.
- CSRF: tokens for any cookie-based session; if header bearer, the existing JWT pattern remains.

---

## STEP 17 — UI/UX REQUIREMENTS

### Design Language
- **Minimal, data-dense, calm.** Admin panels exist to be *read*, not impressed.
- **Mode**: light + dark. Light is default (matches existing `web/`).
- **Type**: same font family as `web/` (whatever the existing Tailwind config uses).
- **Color**:
  - Neutral base (slate/zinc).
  - Primary accent identical to driver app (visual continuity).
  - **Semantic palette**: `success` (green), `warning` (amber), `danger` (red), `info` (blue). Used consistently across status pills, alert chips, and trend deltas.
- **Spacing**: 4px grid. Card padding 16–24px. Page max-width 1440px.
- **Iconography**: `lucide-react` (already in `web/`).

### Card Systems
- **KPI Card**: title, value (big, ~32px), delta vs previous period (with arrow + color), sparkline, "View" link. Used in dashboard + module overviews.
- **List Card**: header + count + see-all link + 3-5 row preview. Used for action queues.
- **Stat Group Card**: 2x2 or 3x1 mini-stats inside one card (e.g., per-platform OCR success rates).
- **Action Card**: confirm-action surface — title, body, danger button. Used in detail pages for destructive actions.

### Table Systems
- **Single primary table component** with: cursor pagination, server-side sort, server-side filter, column visibility toggle, sticky header, density toggle (comfy / compact), row click → detail, bulk select (where allowed), CSV export button.
- **Empty state**: clear copy + a primary action (e.g., "No tickets in this view — change the filter").
- **Loading state**: skeleton rows (reuse `web/components/ui/skeleton`).
- **Error state**: inline retry + link to status page.

### Filter Systems
- **Filter bar** above each table: chips for active filters, "Save view" to persist a named filter combo (e.g., "EG Cairo Uber drivers, 0 trips 7d").
- **Saved views** live in `admin_settings.value` per admin.
- **Cmd-K palette** allows jumping to any filtered view by name.

### Animations
- **Subtle**. Use `framer-motion` (already in `web/`) for:
  - Page transitions (12-15ms fade only).
  - Card delta animations (KPI numbers count up on load).
  - Toast notifications slide in.
- **No** parallax, no large-scale entrance animations. Admin work is sustained focus; visual noise hurts.

### Responsive Behavior
- **Primary target**: 1280px+ (admin workstations).
- **Tablet (768–1280)**: sidebar collapses to icon-rail; tables become horizontally scrollable with sticky first column.
- **Mobile (<768)**: read-only. Mutating actions are hidden with an explanatory toast ("Open on a larger screen to make this change"). Critical alerts and support replies remain available.

### Form System
- React Hook Form + Zod (matches `web/`).
- Inline validation, no toasts for field-level errors.
- Confirm modals required for destructive actions, with the action's verb as the confirm button text (e.g., "Suspend driver" not "OK").

### Accessibility
- WCAG 2.1 AA.
- Every interactive control reachable by keyboard; all icons have `aria-label`.
- Focus states are always visible (no `:focus { outline: none }` without `:focus-visible` replacement).
- Color is never the sole carrier of meaning (success/danger always paired with an icon/label).

---

## STEP 18 — EXECUTION PLAN

Four phases, each shippable on its own. Estimates assume one full-stack engineer with PM/design support.

### Phase 1 — Foundations (2–3 weeks)

**Goal**: Admins can log in, see a dashboard, and manage users/drivers safely. No moderation, no revenue, no advanced analytics.

**Backend tasks**
- Add Prisma models: `AdminUser`, `AdminRole`, `AdminPermission`, `AdminRolePermission`, `AdminUserRole`, `AdminRefreshToken`, `AdminAuditLog`, `BlocklistedIdentifier`.
- Add additive columns to `users`, `drivers`, `trips`.
- Build `AdminAuthModule`, `AdminJwtStrategy`, `AdminJwtAuthGuard`, `@RequirePermissions` decorator, `RolesGuard`.
- Build `AuditService` (record / query / export).
- Build admin endpoints for Auth, Users, Drivers, Trips (CRUD + status actions).
- Seed: 5 demo admin accounts + 5 system roles + permission catalog.

**Frontend tasks**
- Scaffold `apps/admin/` workspace (Vite + React 19 + TS, parallel structure to `apps/web/` but independent code).
- Scaffold `packages/shared-types`, `packages/api-contracts`, `packages/ui-tokens`, `packages/eslint-config`.
- Auth flow (login + MFA setup + refresh + logout).
- App shell: sidebar, header, cmd-k, breadcrumbs, layout.
- Pages: Dashboard (KPI cards stub), Users (list + detail), Drivers (list + detail), Trips (list + detail), Audit (list).
- `<Can>` component + `usePermission()` hook.

**Testing tasks**
- Unit: AuditService, RolesGuard, permission matcher.
- Integration: each admin endpoint with realistic JWT and permission combinations.
- E2E: log in as each demo admin → confirm sidebar visibility matches role.

**Exit criteria**
- Demo admin can log in, suspend a user, see the audit log entry, and have the suspended user's refresh tokens revoked.
- All 5 demo roles can log in and see exactly the sidebar items they should.

---

### Phase 2 — Operations (3–4 weeks)

**Goal**: Real ops work — moderation, support, OCR oversight, admin notifications.

**Backend tasks**
- Models: `CommunityReport`, `SupportMessage`, `OcrExtractionLog`, `AdminAlert`, `NotificationCampaign`, `JobHeartbeat`, `AdminSettings`.
- OCR pipeline writes to `ocr_extraction_log` (with image-hash dedup).
- Alert generator service (cron + reactive): writes `AdminAlert` rows.
- Notification dispatch service: per-user, targeted, broadcast.
- Endpoints for Community, Reviews, Support, Notifications, OCR, Health.
- Hook every controller mutation to AuditService.

**Frontend tasks**
- Pages: Community, Reviews, Feedback, Support, Notifications, OCR System, Platform Health.
- Cohort builder UI for targeted broadcasts.
- Audit drilldown integrated into every detail page.
- Saved views.

**Testing tasks**
- Permission tests: moderator can hide a post, cannot delete it; support can reply but not blacklist.
- Integration: OCR call → log row → admin sees it; report on post → moderation queue → action → driver notified.
- E2E: end-to-end ticket lifecycle.

**Exit criteria**
- Moderation queue is the daily landing surface for moderators.
- Every OCR call is observable in the admin within 5s of completion.
- Support agents can take a ticket from open to closed entirely in-app.

---

### Phase 3 — Intelligence (3–4 weeks)

**Goal**: Analytics, feature usage, growth tools, automation.

**Backend tasks**
- Models: `FeatureEvent`.
- Materialized views for: MAU/DAU, cohort retention, signup funnel, per-feature adoption.
- Endpoints: Analytics family, Feature Usage family.
- Automated alert tuning + ML-light auto-moderation flags (profanity + sentiment).
- OCR replay endpoint (if image retention enabled).

**Frontend tasks**
- Pages: Analytics, Feature Usage.
- Charts: trend, cohort heatmap, funnel, distribution.
- Export everywhere.

**Testing tasks**
- Snapshot test all chart payloads against known fixtures.
- Load test analytics endpoints (target: p95 < 800ms for 100k drivers).

**Exit criteria**
- Analyst role can answer "how is the platform doing?" without leaving the admin.
- Feature owners can see adoption curves for their feature.

---

### Phase 4 — Revenue & Hardening (3 weeks)

**Goal**: Subscriptions, billing dashboards, security hardening, polish.

**Backend tasks**
- Models: `SubscriptionPlan`, `Subscription`, `Invoice`, `Coupon`, `CouponRedemption`.
- Stripe (or equivalent) webhook ingestion → Invoice rows.
- Revenue analytics endpoints.
- Audit log HMAC chaining + verifier job.
- Admin SSO (SAML/OIDC) wiring (optional).
- Rate limiting + IP allowlisting for SuperAdmin.

**Frontend tasks**
- Pages: Revenue family, Roles & Permissions admin UI, Settings.
- Roles editor (drag permissions into custom roles).

**Testing tasks**
- Security review: pen test on admin endpoints.
- Audit-log tamper test (simulated row mutation should fail).
- Plan migration test: switch a fake user between plans, verify MRR delta.

**Exit criteria**
- Day-one revenue dashboards work the moment a real payment is processed.
- Audit log is provably tamper-evident.

---

## STEP 19 — TESTING PLAN

### Unit Tests
- **Permission matcher**: every (role, action) cell against the matrix.
- **AuditService**: serialization, hmac chain (Phase 4), retention pruning.
- **Cohort filter compiler**: filter JSON → SQL safely (no injection).
- **OCR success-rate calculator**: edge cases (no data, all-fail, partial).
- **Money formatting**: piastres ↔ EGP with rounding (reuse existing `common/utils/money.ts`).

### Integration Tests
- Each admin controller exercised with:
  - Anonymous token → 401.
  - Wrong-role token → 403.
  - Right-role token → 200/204.
- Audit log entries created for every mutating call.
- Database constraints fire (e.g., audit row UPDATE rejected).

### E2E Tests (Playwright)
- **Per-role login walk**: log in as each demo admin, confirm sidebar.
- **Lifecycle**: suspend user → activate → confirm trail.
- **Moderation**: report post → moderator hides → original author receives notification → admin sees audit.
- **Support**: user submits ticket on driver app → support agent receives in queue → replies → resolves → driver sees reply.
- **Impersonation**: admin impersonates driver → banner visible → audit entry written → impersonation ends.

### Permission Tests
- Negative tests for every permission: each forbidden action returns 403 with `code: 'ADMIN_FORBIDDEN'` and writes nothing.
- Cross-tenant guard: an admin cannot read another tenant's data (when multi-tenant arrives).

### Role Tests
- Role membership change immediately revokes old token (via `permissions_version` bump → next request 401 → re-login).

### Security Tests
- OWASP Top 10 sweep, focused on:
  - SQL injection through filter JSON.
  - Mass assignment in PATCH endpoints.
  - JWT confusion (driver token must not be accepted by admin guard).
  - Rate limiting on auth, suspend, blacklist, delete.
  - Audit-log immutability.
  - Impersonation token boundaries (cannot grant more than the impersonator's perms).

### Performance Tests
- **Targets**:
  - Dashboard overview: p95 < 600ms with 1M users, 10M trips.
  - Trip list with filters: p95 < 800ms.
  - Audit log query (filtered): p95 < 500ms.
  - Bulk CSV export: streaming, < 2s to first byte for 100k rows.
- Tooling: k6 or Artillery, scenarios scripted in repo.

### Test Data
- A `seed:admin-fixtures` script generates a representative dataset: 10k users, 5k drivers, 200k trips spread over 12 months, 5k community posts, 500 reviews (mixed approval states), 200 tickets in various states, OCR logs across all platforms.

---

## STEP 20 — FINAL REVIEW & IMPROVEMENTS

A reread of the full document, surfacing gaps and tightening areas.

### Identified Gaps & Resolutions

**1. Missing module — App Sources management.**
The platform has system-managed `AppSource` rows (Uber, Careem, etc.). Admins need a UI to add new app sources, edit names, adjust default commission. **Resolved**: add `/admin/app-sources` route under Settings, with CRUD endpoints `GET/POST/PATCH/DELETE /admin/app-sources`. Permission: `settings.update`.

**2. Missing module — Maintenance Items management.**
`MaintenanceItem` is platform-level (oil, tires, brakes, etc.). Should be admin-managed. **Resolved**: add `/admin/maintenance-items` under Settings, parallel to App Sources.

**3. Missing permission — Bulk operations.**
Step 5/7 list bulk export but bulk **mutations** (e.g., bulk-suspend 50 users) aren't explicit. **Resolved**: introduce `users.bulk_mutate`, `trips.bulk_mutate`, `community.bulk_mutate`. Limited to Admin+. Each bulk action records one audit row per target plus one "bulk envelope" row.

**4. Missing analytics — Geographic distribution.**
Drivers have `base_city` but no map view in admin. **Resolved**: add a "Geography" tab to Analytics with city-level KPIs (signups, trips, retention, MRR-future). Phase 3.

**5. Missing moderation — Trust & Safety hard cases.**
What if a driver posts illegal content? Need: an "Emergency Remove" path that hides everywhere immediately + locks the user account in <30s. **Resolved**: `community.emergency_remove` permission, single click flow, Admin+, audit-locked, optional law-enforcement export package.

**6. Missing tool — Data export for GDPR-style requests.**
Drivers can request a full export of their data. **Resolved**: `POST /admin/users/:id/export-package` generates a ZIP with all the user's data, signed URL valid 24h. Permission: `users.export`.

**7. Missing tool — Account merge.**
Same physical driver sometimes creates two accounts (e.g., new phone). **Resolved**: `POST /admin/users/:srcId/merge-into/:dstId` flow with a preview of what merges and what conflicts. SuperAdmin only.

**8. Missing observability — Admin login anomalies.**
A SuperAdmin login from a new country should alert all other SuperAdmins. **Resolved**: a new alert code `ADMIN_LOGIN_ANOMALY`, computed from `last_login_ip` + GeoIP + device fingerprint. Goes to admin alert feed.

**9. Missing UX — Mobile read-only is too restrictive for on-call.**
Support agents on-call may need to reply to a P0 ticket from a phone. **Resolved**: allow `support.reply` + `community.hide` + `notifications.compose` (per-user) on mobile. Other actions remain desktop-only.

**10. Missing testing — Audit log search at scale.**
Logs grow indefinitely. **Resolved**: ship `audit_logs` partitioning by month from day one (Postgres declarative partitioning). Tests must include a 10M-row audit table.

**11. Missing — Internationalization of admin UI.**
Even though English-primary, error messages reach drivers in Arabic. **Resolved**: notification campaign composer enforces both Arabic + English bodies for any platform broadcast (or explicit "single-language" toggle with confirm).

**12. Missing — Soft vs hard delete strategy for drivers.**
Driver Cascade-delete on `User` deletion could nuke aggregates. **Resolved**: hard-delete becomes "anonymize" — `phone` → `+xxx...redacted-<cuid>`, `email` → null, `passwordHash` → null, `Driver.displayName` → "Deleted Driver". Trips and aggregates stay (they're already attributed to a `driverId` cuid). True hard delete restricted to internal compliance flow with extra signoff.

### Cross-Cutting Improvements

- **Single audit format**: every audit row uses identical schema. Don't allow per-module ad-hoc fields — push extras into `before`/`after` JSON.
- **Single permission format**: `scope.action`. No nested or hierarchical permissions yet. Add only if necessary.
- **Single error format**: `{ code, message, details? }` everywhere. Drivers and admins consume the same shape.
- **Single pagination format**: `{ items, nextCursor }` for cursor; `{ items, total, page, pageSize }` for offset. Don't mix on the same endpoint.
- **Single time format**: ISO-8601 UTC across the wire; render in admin's selected TZ.

### Operational Readiness Checklist (pre-launch)

- [ ] All 5 demo accounts seeded and rotated to real credentials.
- [ ] MFA enforced for SuperAdmin + Admin.
- [ ] IP allowlisting available for SuperAdmin.
- [ ] Audit log tamper-evident (HMAC chain online).
- [ ] Audit retention policy configured.
- [ ] Backup + restore tested for new tables.
- [ ] Penetration test passed.
- [ ] Runbooks written for: OCR outage, DB lag, admin-login anomaly, mass moderation event.
- [ ] On-call rotation defined for `AdminAlert` severity high/critical.

---

## CLOSING NOTES

This blueprint is intentionally **additive**: it doesn't touch existing driver-facing surfaces, doesn't break the current Prisma schema, and doesn't require backfilling. The admin platform layers cleanly on top of the existing NestJS modules and reuses their services where it makes sense (e.g., `NotificationsService.create`, `AnalyticsService` engines, `ReviewsService.featured`).

Implementation can begin against Phase 1 with full architectural certainty:
- The schema is specified.
- The permissions catalog is fixed.
- The role matrix is decided.
- The UI patterns are committed.
- The testing strategy is explicit.

The remaining decisions are tactical, not architectural.
