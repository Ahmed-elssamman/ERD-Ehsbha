# ADMIN_SEPARATION_VERIFICATION.md

**Pre-Implementation Verification Gate**

> Purpose: prove that the five architectural concerns the user raised are answered, mechanically enforceable, and free of hidden coupling — *before* a single line of admin code is written. This document is the gate. Implementation begins only after the user accepts each section.

> Companion to: [ADMIN_ARCHITECTURE.md](ADMIN_ARCHITECTURE.md) (feature blueprint).
> Date: 2026-05-29.

---

## CONTEXT SNAPSHOT (CURRENT STATE)

What exists today, observed from the repo:

| Item | Current location | Notes |
|---|---|---|
| Backend (NestJS + Prisma) | `backend/` | Will move to `apps/api/`. |
| Driver web app (React + Vite) | `web/` | Will move to `apps/web/`. Driver-facing only. |
| Workspace declaration | `package.json` → `"workspaces": ["backend", "web"]` | Will become `["apps/*", "packages/*"]`. |
| Auth | JWT for drivers only. Payload: `{ sub, phone, driverId }`. **No `role` field.** | Admin auth is additive — new endpoints, new guard, new secret, new refresh table. |
| Existing user-facing pages | `web/src/pages/**` (dashboard, trips, expenses, community, reviews, support, etc.) | None of these will be reused for admin. |

This snapshot is the baseline. Every verification claim below is grounded against it.

---

## VERIFICATION 1 — SEPARATION ARCHITECTURE

### Claim
The admin dashboard is a separate application that cannot accidentally import from, or be imported by, the user-facing web app. The separation is enforced at the toolchain level, not just by convention.

### Topology

```
ehsbha/
├── apps/
│   ├── api/           (NestJS — moved from backend/)
│   ├── web/           (Driver app — moved from web/)
│   └── admin/         (Admin app — NEW)
└── packages/
    ├── api-contracts/      (Zod schemas + DTO types, generated from api/)
    ├── shared-types/       (utility types, branded primitives, enums)
    ├── ui-tokens/          (Tailwind preset + design tokens)
    └── eslint-config/      (shared lint config incl. import-restriction rule)
```

### Enforcement Mechanisms

**1. NPM Workspaces boundary**
- Root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`.
- Each app/package has its own `package.json` with its own dependencies.
- `apps/admin` does not list `apps/web` as a dependency, and vice versa.

**2. TypeScript project references**
- Root `tsconfig.base.json` defines path aliases:
  - `@ehsbha/api-contracts/*` → `packages/api-contracts/src/*`
  - `@ehsbha/shared-types/*` → `packages/shared-types/src/*`
  - `@ehsbha/ui-tokens/*` → `packages/ui-tokens/src/*`
- Apps reference only the packages they need; no path alias bridges `apps/web` ↔ `apps/admin`.
- `apps/admin/tsconfig.json` has no `references` to `apps/web/tsconfig.json` (and vice versa).

**3. ESLint guardrail (the real teeth)**
A shared config in `packages/eslint-config/index.js` enforces:

```
"no-restricted-imports": ["error", {
  "patterns": [
    { "group": ["**/apps/web/**", "@ehsbha/web/**"], "message": "apps/admin cannot import from apps/web" },
    { "group": ["**/apps/admin/**", "@ehsbha/admin/**"], "message": "apps/web cannot import from apps/admin" }
  ]
}]
```

- The rule lives in the shared config and is applied in CI.
- A pre-commit hook (husky + lint-staged) runs lint locally so violations are caught before push.
- CI fails the PR if either rule fires.

**4. Build-level isolation**
- Vite is configured separately per app. `apps/admin/vite.config.ts` resolves only `apps/admin/src` + the shared `packages/*` aliases.
- `npm --workspace apps/web run build` produces `apps/web/dist/`.
- `npm --workspace apps/admin run build` produces `apps/admin/dist/`.
- Bundle analyzer (`vite-bundle-visualizer`) is wired in CI for both apps; a regression test asserts that no module ID from the other app appears in the bundle.

**5. Deployment-level isolation**
- Two separate static-hosting origins (`app.ehsbha.com`, `admin.ehsbha.com`).
- Two separate CI deployment workflows.
- A compromised admin bundle cannot serve to driver users (different origin, different CSP, different cache).

### What This Buys Us
- **No accidental leakage**: a developer cannot, without explicit and reviewable action, pull a user-facing component into the admin app.
- **No build-time coupling**: changes in `apps/web` cannot break the admin build (and vice versa).
- **No deployment-time coupling**: shipping an admin hotfix doesn't require rebuilding `apps/web`.
- **No runtime coupling**: bugs in one app don't reach the other's users.

### Counter-Examples (What This Does NOT Mean)
- Admin and web can still consume the **same** Zod schema from `packages/api-contracts` — that's the desired path.
- Admin and web can still use the **same** Tailwind tokens — visual consistency, not code coupling.
- Admin and web can still call the **same** API endpoints — but admin calls admin endpoints, web calls driver endpoints; they don't share auth realms.

### Status: ✅ Verifiable
The four enforcement layers (workspaces, tsconfig, eslint, build separation) collectively make the separation testable in CI on every PR.

---

## VERIFICATION 2 — ROUTING ARCHITECTURE

### Claim
The admin app has its own router instance, its own route table, its own guards, its own layouts — fully independent from the user app. No route, layout, or guard is shared.

### Per-App Routing

**`apps/web/` (existing, unchanged in this section)**
- Router: `createBrowserRouter` in `apps/web/src/router.tsx`.
- Auth gate: `<ProtectedRoute>` from `apps/web/src/routes/protected-route.tsx`.
- Layout: `<AppLayout>` from `apps/web/src/components/layout/app-layout.tsx`.
- Routes are driver-scoped (`/`, `/trips`, `/expenses`, etc.).

**`apps/admin/` (NEW)**
- Router: `createBrowserRouter` in `apps/admin/src/router.tsx` — **new file, separate instance**.
- Auth gate: `<AdminProtectedRoute>` from `apps/admin/src/routes/admin-protected-route.tsx` — different store, different cookie/storage namespace, different refresh logic.
- Permission gate: `<RequirePermission scope="users" action="suspend">` HOC + `useRequirePermission()` hook.
- Layout: `<AdminLayout>` from `apps/admin/src/components/layout/admin-layout.tsx` — sidebar (Step 3 of architecture doc), top bar, breadcrumbs, cmd-k palette.
- Route table per the sidebar IA in ADMIN_ARCHITECTURE.md Step 3.

### Route Surface

**`apps/web` (unchanged)**
```
/                      (driver home)
/login, /register, /forgot-password, /reset-password
/trips, /trips/:id, /trips/new
/expenses, /maintenance, /vehicle-health, /analytics
/driver-score, /smart-decisions, /work-planner, /best-hours
/profit-simulator, /community, /reviews, /support
/notifications, /settings, /guide
```

**`apps/admin` (new — see ADMIN_ARCHITECTURE.md Step 3)**
```
/                          (dashboard)
/login, /mfa-setup, /mfa-verify
/users, /users/:id
/drivers, /drivers/:id
/trips, /trips/:id
/vehicles, /vehicles/:id
/ocr, /ocr/log/:id
/analytics, /feature-usage, /revenue, /revenue/subscriptions, ...
/community, /community/posts/:id, /community/reports
/reviews, /reviews/:id
/feedback
/support, /support/:id
/notifications, /alerts
/audit, /audit/by-target/:type/:id
/roles, /roles/:id
/settings, /settings/profile, /settings/integrations
/health, /health/api, /health/db, /health/ocr
```

### Layout Independence

| Concern | `apps/web/` | `apps/admin/` |
|---|---|---|
| Top bar | Driver greeting, theme toggle, lang toggle, notifications bell. | Cmd-K, role chip, environment badge (dev/staging/prod), admin avatar dropdown. |
| Sidebar | Driver feature list. | Admin feature list (5 sections: CORE, INTELLIGENCE, COMMUNITY, OPERATIONS, SYSTEM). |
| Breadcrumbs | Minimal. | Rich, deep-linkable. |
| Footer | None. | Version + build SHA + uptime indicator. |
| Empty / loading / error states | Driver-toned. | Admin-toned (data-dense, calmer). |

No layout component crosses the apps/ boundary.

### Route Guards

| Guard | App | Behavior |
|---|---|---|
| `<ProtectedRoute>` | web | Redirects to `/login` if no driver session. |
| `<GuestRoute>` | web | Redirects to `/` if a driver session exists. |
| `<AdminProtectedRoute>` | admin | Redirects to admin `/login` if no admin session. Different storage namespace; a driver token cannot satisfy this guard even if both apps were ever served from the same origin. |
| `<AdminGuestRoute>` | admin | Redirects to admin `/` if an admin session exists. |
| `<RequirePermission>` | admin | Per-route permission gate that hides the entire route (404) if the permission is missing. UI only — backend enforces too. |

### Status: ✅ Verifiable
Each app's router is a separate module, with separate guards and separate layouts. The lint rule prevents accidental cross-imports.

---

## VERIFICATION 3 — AUTHENTICATION ARCHITECTURE

### Claim
Admin authentication is a **separate realm** from driver authentication: separate JWT secrets, separate refresh-token table, separate guard, separate storage namespace, separate session lifetimes, and MFA support — with no possible token interchange between the two realms.

### Two Independent Realms

| Aspect | Driver realm (existing) | Admin realm (new) |
|---|---|---|
| JWT access secret | `JWT_ACCESS_SECRET` | `ADMIN_JWT_ACCESS_SECRET` (distinct env var) |
| JWT refresh secret | `JWT_REFRESH_SECRET` | `ADMIN_JWT_REFRESH_SECRET` |
| Access TTL | 15 min (current) | 15 min (matches; tightened by MFA / IP allowlist) |
| Refresh TTL | 30 days (current) | 8 hours (much shorter — admin sessions are higher-risk) |
| Refresh token store | `refresh_tokens` | `admin_refresh_tokens` (new table) |
| Strategy class | `JwtStrategy` (`backend/src/modules/auth/jwt.strategy.ts`) | `AdminJwtStrategy` (new) |
| Guard | `JwtAuthGuard` | `AdminJwtAuthGuard` |
| Login endpoint | `POST /api/v1/auth/login` | `POST /api/v1/admin/auth/login` |
| Logout endpoint | `POST /api/v1/auth/logout` | `POST /api/v1/admin/auth/logout` |
| Refresh endpoint | `POST /api/v1/auth/refresh` | `POST /api/v1/admin/auth/refresh` |
| MFA | Not required for drivers. | TOTP **mandatory** for SuperAdmin + Admin; opt-in for other roles. Backup codes supported. |
| Frontend storage | `localStorage` key `ehsbha.driver.auth` | `localStorage` key `ehsbha.admin.auth` (different namespace) |
| Frontend store | `apps/web/src/stores/auth.store.ts` (existing) | `apps/admin/src/stores/admin-auth.store.ts` (new) |
| HTTP client | `apps/web/src/lib/api/client.ts` | `apps/admin/src/lib/api/admin-client.ts` (new, separate Axios instance, separate interceptors) |

### Token Confusion Impossibility

A driver token is structurally cryptographically incompatible with the admin guard:

- Different signing secrets → signature verification fails.
- Different `iss` claim (`ehsbha.driver` vs `ehsbha.admin`) → claim check fails.
- Different `aud` claim (`driver-app` vs `admin-app`) → audience check fails.
- Admin payload includes `adminUserId` and `permissionsVersion`; driver payload does not. Admin strategy fails closed on missing claims.

These checks are layered (defense in depth). Any single check failing rejects the token.

### Admin JWT Payload

```ts
interface AdminJwtPayload {
  iss: 'ehsbha.admin';
  aud: 'admin-app';
  sub: string;                  // admin_user_id
  email: string;
  roles: string[];              // e.g., ['super_admin'] or ['moderator', 'support']
  permissions: string[];        // e.g., ['users.read', 'users.suspend', ...]
  permissionsVersion: number;   // bumped on role change to invalidate live tokens
  mfaPassed: boolean;           // true only if MFA was completed this session
  jti: string;                  // for revocation
  iat: number;
  exp: number;
}
```

### Live Revocation

When SuperAdmin changes another admin's role, `permissions_version` on the affected `admin_users` row is incremented. The next request from that admin's existing token will be rejected because the JWT-encoded `permissionsVersion` no longer matches the DB. The admin is forced to re-authenticate, and their new token will carry the updated permissions.

### MFA Flow

1. First login with email + password.
2. If `mfa_enabled = true`: response is `{ mfaRequired: true, challengeId }` (no access token issued yet).
3. Client submits TOTP code to `POST /admin/auth/mfa/verify`.
4. Server validates code, issues full access + refresh tokens with `mfaPassed: true`.
5. Sensitive endpoints (suspend, blacklist, delete, role change) check `mfaPassed === true`.

### Defense Against Common Attacks

| Attack | Mitigation |
|---|---|
| Token replay | Short access TTL (15m), refresh token hashed in DB, refresh rotation. |
| Token theft via XSS | Admin app sets a strict CSP, no inline scripts, dependencies pinned. Admin tokens stored with rotation on each refresh; an old refresh token used twice triggers an "account compromise" alert and revokes all sessions. |
| Brute force login | Rate limit 5 attempts / 15 min / IP + 5 attempts / 15 min / email. Lockout after 10 failures. |
| Stolen DB / RT replay | Refresh tokens stored as hash (existing pattern in `RefreshToken.token_hash`). |
| Cross-realm token confusion | Layered claim checks (issuer + audience + secret + payload shape). |
| Privilege escalation via stale token | `permissionsVersion` bump invalidates live tokens. |
| Stolen admin laptop | Optional IP allowlist for SuperAdmin (per `admin_users.ip_allowlist` jsonb field). |

### Status: ✅ Verifiable
- A driver token presented to an admin endpoint is rejected at the signature level (no second-stage check needed).
- An admin token presented to a driver endpoint is rejected at the signature level.
- This is testable by writing one integration test per direction and asserting `401`.

---

## VERIFICATION 4 — RBAC INTEGRATION

### Claim
The RBAC model from ADMIN_ARCHITECTURE.md Step 2 wires cleanly into the new admin app at both the backend (authoritative) and frontend (UX gating) layers, with the backend always being the source of truth.

### Authoritative Layer (Backend, NestJS)

**1. Permission catalog** — seeded into `admin_permissions` (see ADMIN_ARCHITECTURE.md Step 15).

**2. Role definitions** — seeded into `admin_roles` + `admin_role_permissions`. Five system roles cannot be deleted (`is_system = true`).

**3. Guards** — every admin controller is decorated:

```ts
@Controller('admin/users')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminUsersController {
  @Post(':id/suspend')
  @RequirePermissions('users.suspend')
  @RequireMfa()  // sensitive action
  suspend(...) { ... }
}
```

The guard does:
1. JWT signature + claim checks (handled by `AdminJwtAuthGuard`).
2. `permissionsVersion` freshness check against DB.
3. Permission match: every permission in `@RequirePermissions(...)` must be in `user.permissions`.
4. MFA check if `@RequireMfa()` is present.

Failure modes:
- `401 ADMIN_UNAUTHENTICATED` — bad/missing token.
- `403 ADMIN_FORBIDDEN` — token valid, permission missing.
- `403 ADMIN_MFA_REQUIRED` — permission present, MFA not completed this session.
- `401 ADMIN_PERMISSIONS_STALE` — token's `permissionsVersion` < DB.

**4. Audit binding** — `AdminPermissionsGuard` annotates the request with the matched permissions for the audit logger to capture.

### Convenience Layer (Frontend, `apps/admin/`)

**1. Permission state** — on login, the access token's `permissions` array is decoded and stored alongside the token in `admin-auth.store.ts`. A `usePermissions()` hook exposes it.

**2. Declarative gate** — `<Can permission="users.suspend">` and `<Can anyOf={['users.suspend', 'drivers.suspend']}>`:

```tsx
<Can permission="users.suspend">
  <Button onClick={...}>Suspend user</Button>
</Can>
```

When the permission is missing, the component renders nothing (or an optional `fallback`).

**3. Route gate** — `<RequirePermission scope="users" action="read">` wraps an entire route. If missing, the user sees a 403 page with "You don't have permission to view this".

**4. Sidebar gating** — sidebar items declare a `requires` field; entries are hidden when the permission isn't present:

```ts
{ label: 'Audit Logs', to: '/audit', requires: 'audit.read' }
```

**5. UI vs source of truth** — every button or link that triggers a privileged action is gated in the UI for UX (don't dangle a button that 403s on click), but the **backend** is authoritative. The UI gate is only a hint; bypassing it does not unlock anything because the API guard re-enforces.

### Mapping Demo Accounts to Permissions

Verified against ADMIN_ARCHITECTURE.md Step 2:

| Demo account | Role | Sidebar items visible | Sample API matrix |
|---|---|---|---|
| `admin@ehsbha.com` | super_admin | All | All endpoints |
| `manager@ehsbha.com` | admin | All except Roles & Permissions write | Can suspend, cannot manage roles |
| `moderator@ehsbha.com` | moderator | Dashboard (limited), Community, Reviews, Users (read), Drivers (read), Audit (own) | `POST /admin/community/:id/hide` ✅ ; `POST /admin/users/:id/blacklist` ❌ |
| `support@ehsbha.com` | support | Dashboard (support-focused), Support, Users, Drivers (read), Notifications (per-user) | `POST /admin/support/:id/messages` ✅ ; `POST /admin/community/:id/hide` ❌ |
| `analyst@ehsbha.com` | analyst | Dashboard, Analytics, Revenue, Feature Usage, Health, Users (read), Drivers (read), Trips (read), Audit (read) | All `GET` ✅ ; any `POST/PATCH/DELETE` ❌ |

Each row is testable as an E2E scenario (ADMIN_ARCHITECTURE.md Step 19).

### Custom Roles (Phase 4)

The schema (`admin_roles` + `admin_role_permissions`) already supports custom roles. UI for managing them is part of `/admin/roles` page (Roles & Permissions). System roles cannot be deleted; custom roles can.

### Status: ✅ Verifiable
- Permission catalog is a finite list and can be enumerated in tests.
- Each demo account's permission set is deterministically derived from their role(s).
- Every controller is testable with each demo account → expected status code.

---

## VERIFICATION 5 — SHARED TYPES STRATEGY

### Claim
DTOs, validation schemas, and primitive types are shared between `apps/api`, `apps/web`, and `apps/admin` via a small set of well-defined packages — with the backend as the single source of truth. Layouts, pages, navigation, and stores are **not** shared.

### Source of Truth: `apps/api`

Each backend module already defines its DTOs as Zod schemas (current pattern, e.g. `backend/src/modules/notifications/notifications.service.ts` defines `RegisterDeviceSchema`). This pattern continues. The schemas live in `apps/api/src/modules/<module>/dto/*.ts` and are re-exported through a stable contract surface.

### `packages/api-contracts`

This package re-exports all DTOs from `apps/api` in a stable, frontend-safe form:

```
packages/api-contracts/
├── src/
│   ├── auth/
│   │   ├── driver.ts        ← LoginRequestSchema, LoginResponseSchema, ...
│   │   └── admin.ts         ← AdminLoginRequestSchema, ...
│   ├── users.ts
│   ├── drivers.ts
│   ├── trips.ts
│   ├── ocr.ts
│   ├── community.ts
│   ├── reviews.ts
│   ├── support.ts
│   ├── notifications.ts
│   ├── admin/
│   │   ├── audit.ts
│   │   ├── alerts.ts
│   │   ├── campaigns.ts
│   │   ├── feature-usage.ts
│   │   └── health.ts
│   └── index.ts
└── package.json
```

Each file exports:
- Zod schema (`UpsertReviewSchema`).
- TypeScript type (`type UpsertReviewDto = z.infer<typeof UpsertReviewSchema>`).
- (Optional) endpoint metadata (`UpsertReviewEndpoint = { method: 'PUT', path: '/reviews/me' }`).

Backend imports its own schemas (since they live in `apps/api` originally). Frontend apps import via `@ehsbha/api-contracts`.

### How DTOs Cross the Boundary

Two options were considered:

**Option A — symlink / file-mirror.** Rejected. Fragile across OSes (Windows symlink permissions).

**Option B — explicit re-export package.** Adopted. `packages/api-contracts/src/users.ts` does:
```
export * from '@ehsbha/api/dist/contracts/users';
```
…where `@ehsbha/api` is the workspace alias for `apps/api`'s public contract surface. This works because the Zod schemas are pure data — no Nest decorators, no `Injectable`, no Prisma client imports.

Build order:
1. `apps/api` exports its DTO modules in `src/contracts/index.ts` (a deliberate, curated surface — not all internal code).
2. `packages/api-contracts` depends on `@ehsbha/api` workspace and re-exports.
3. `apps/web` and `apps/admin` depend on `@ehsbha/api-contracts`.

The backend never imports from `packages/api-contracts` (avoids a circular dependency).

### `packages/shared-types`

Hand-written utility types that are **not** API-derived:

```
packages/shared-types/
└── src/
    ├── branded.ts        ← branded primitives like Piastres, Meters, Cuid
    ├── enums.ts          ← string unions mirroring Prisma enums (UserStatus, etc.)
    ├── pagination.ts     ← Cursor<T>, OffsetPage<T>
    └── error.ts          ← ApiError<TCode = string> shape
```

Used by both apps for cross-cutting type safety.

### `packages/ui-tokens`

Design primitives — **not components**:

```
packages/ui-tokens/
└── src/
    ├── colors.ts         ← brand + semantic palette
    ├── tailwind-preset.js ← imported in apps/{web,admin}/tailwind.config.ts
    ├── typography.ts
    └── motion.ts
```

`apps/web/tailwind.config.ts`:
```
import preset from '@ehsbha/ui-tokens/tailwind-preset';
export default { presets: [preset], content: ['./src/**/*.{ts,tsx}'] };
```

`apps/admin/tailwind.config.ts` does the same. They render with the same color tokens and spacing scale — but they do **not** share React components. Visual consistency without code coupling.

### What Stays Out of Packages

Explicitly forbidden in `packages/`:

| Item | Reason |
|---|---|
| React components | Either app-specific (then keep it in the app) or genuinely cross-cutting design system primitives (out of scope for this initial blueprint — revisit later as `packages/ui` only if a real shared component emerges). |
| Stores (`auth.store.ts`, etc.) | Auth realms are different. Sharing would invite confusion. |
| Layouts / pages | By contract, never. |
| Navigation config | App-specific. |
| Test utilities specific to one app | Stay in the app. |

A general-purpose `packages/ui` may emerge later if a shared component (e.g., a money input formatted to EGP) proves to be identical in both apps. The blueprint defers that decision; nothing forces it now.

### Versioning Strategy

`packages/*` are internal (not published). They follow the workspace's monorepo version. A breaking change in `api-contracts` is rolled out by:
1. Updating the schema in `apps/api`.
2. Re-exporting through `packages/api-contracts`.
3. Updating consumers (`apps/web`, `apps/admin`) in the same PR.

CI runs the full monorepo typecheck on every PR, so a contract change that breaks either app blocks the merge.

### Status: ✅ Verifiable
- Backend remains the single source of truth for DTOs.
- Two apps consume contracts via one stable path (`@ehsbha/api-contracts`).
- Pages, layouts, and navigation are never shared (enforced by lint).
- Visual consistency comes from shared tokens, not shared components.

---

## VERIFICATION SUMMARY

| # | Verification Point | Status | Mechanism |
|---|---|---|---|
| 1 | Separation Architecture | ✅ | Workspaces + tsconfig + ESLint `no-restricted-imports` + separate Vite builds + separate deploys |
| 2 | Routing Architecture | ✅ | Per-app router instance, per-app guards, per-app layouts; ADMIN_ARCHITECTURE.md Step 3 defines admin route table |
| 3 | Authentication Architecture | ✅ | Distinct JWT secrets, separate refresh-token table, separate guard, separate storage namespace, MFA mandatory for SuperAdmin/Admin |
| 4 | RBAC Integration | ✅ | Permission catalog + role definitions (ADMIN_ARCHITECTURE.md Step 2), backend `@RequirePermissions` guard, frontend `<Can>` + `<RequirePermission>` + sidebar gating |
| 5 | Shared Types Strategy | ✅ | `packages/api-contracts` (DTOs/Zod), `packages/shared-types` (utility types), `packages/ui-tokens` (design primitives); no shared layouts/pages/stores |

---

## OPEN QUESTIONS FOR THE USER (PRE-IMPLEMENTATION)

Before scaffolding begins, the following decisions need explicit confirmation. Defaults are proposed.

1. **Migration sequencing.** Do you want the `backend/` → `apps/api/` and `web/` → `apps/web/` move done as **one PR**, separate from any admin scaffolding? *(Default: yes — keep the move surgical and reversible.)*

2. **Hosting domains.** Are `app.ehsbha.com` and `admin.ehsbha.com` the right hostnames, or should the admin live at a less guessable URL (`ops.ehsbha.internal`, behind Cloudflare Access)? *(Default: `admin.ehsbha.com` for now; tighten later.)*

3. **MFA library.** Default to `otplib` (TOTP) + QR code via `qrcode`? *(Default: yes.)*

4. **Admin token storage.** `localStorage` (current driver app pattern) or HttpOnly cookies (more secure, requires CORS + SameSite config)? *(Default: HttpOnly cookies for admin — admin is higher-risk; driver app stays as-is.)*

5. **IP allowlist.** Enabled for SuperAdmin from day one, or deferred to Phase 4? *(Default: ship the schema field from day one; UI to manage it in Phase 4.)*

6. **Admin language.** English-only at launch, or English + Arabic? *(Default: English-only at launch; localize after Phase 2.)*

7. **Production CI/CD targets.** Confirm: separate GitHub Actions workflows for `apps/web` and `apps/admin`, deploying to separate static-hosting buckets/CDNs. *(Default: yes.)*

---

## GO / NO-GO CHECKLIST (BEFORE IMPLEMENTATION)

Implementation may proceed once **all** boxes are checked.

- [ ] User has read this document.
- [ ] User has read ADMIN_ARCHITECTURE.md (the feature blueprint).
- [ ] User has answered the 7 open questions above (or accepted the defaults).
- [ ] User has confirmed the migration sequencing.
- [ ] User explicitly says "proceed with Phase 1 implementation".

Until all boxes are checked, no code is written and no files are moved.
