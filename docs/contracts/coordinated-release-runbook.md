# Coordinated Release Runbook

## Overview

This runbook documents the coordinated release process for the shared platform contracts.
API, web (driver), and admin artifacts must be deployed together within the same window to
ensure contract major version consistency across all consumers.

---

## Prerequisites

Before initiating a coordinated release, confirm the following:

- [ ] All verification gates pass: `npm run verify`
- [ ] CI pipeline is green on the target revision
- [ ] `npm run contracts:generate` produces identical output on consecutive runs
- [ ] `npm run verify:contracts` reports zero failures
- [ ] `npm run packages:build` completes without errors (CJS + ESM)
- [ ] `npm run lint` reports no errors
- [ ] No competing local response definitions remain
- [ ] All operation IDs are unique and deterministic
- [ ] Contract compatibility is `additive-compatible` for all active operations
- [ ] Database migrations are backward-compatible (additive only)
- [ ] Rollback plan is reviewed and approved
- [ ] Release notes are drafted and communicated to stakeholders

---

## Build Order

Artifacts must be built in dependency order. Shared packages must compile before any
application references them.

```text
1. shared-types     → packages/shared-types
2. api-contracts    → packages/api-contracts
3. api              → apps/api
4. web              → apps/web
5. admin            → apps/admin
```

### Build Commands

```bash
# Step 1: Build shared packages
npm run packages:build

# Step 2: Build API
npm run api:build

# Step 3: Build driver web
npm run web:build

# Step 4: Build admin
npm run admin:build
```

### Build Verification

After each build step, run:

```bash
npm run packages:typecheck
npm run packages:test
```

After all builds complete, run the full verification suite:

```bash
npm run verify
```

---

## Deployment Order

Deploy artifacts in the following sequence. Each step must complete and pass health
checks before proceeding to the next.

```text
1. API         → Deploy first (provides new contract endpoints)
2. web         → Deploy second (consumes new API contracts)
3. admin       → Deploy third (consumes new API contracts)
```

### Deployment Steps

#### 1. Deploy API

- Deploy the built `apps/api` artifact to the target environment
- Run database migrations (must be backward-compatible)
- Verify API health endpoint returns 200
- Proceed to web deployment only after API passes health checks

#### 2. Deploy Web (Driver)

- Deploy the built `apps/web` artifact
- Verify web application loads and authenticates
- Verify key driver flows (login, trip list, profile)

#### 3. Deploy Admin

- Deploy the built `apps/admin` artifact
- Verify admin application loads and authenticates
- Verify key admin flows (login, user list, driver list)

---

## Verification Steps After Deployment

### API Verification

```bash
# Health check
curl -f https://<api-host>/api/v1/health

# Verify contract version header
curl -sI https://<api-host>/api/v1/driver/trips | grep -i x-contract-version

# Verify API version header
curl -sI https://<api-host>/api/v1/driver/trips | grep -i x-api-version

# Verify request-id header present
curl -sI https://<api-host>/api/v1/driver/trips | grep -i x-request-id
```

### Web Verification

- [ ] Login flow succeeds (driver realm)
- [ ] Trip list loads and displays paginated results
- [ ] Profile page loads with user data
- [ ] No console errors related to contract parsing
- [ ] Error states display governed error messages

### Admin Verification

- [ ] Login flow succeeds (admin realm)
- [ ] User list loads and displays paginated results
- [ ] Driver list loads and displays paginated results
- [ ] No console errors related to contract parsing
- [ ] Admin-specific error codes surface correctly (FORBIDDEN, SESSION_EXPIRED, etc.)

### Contract Verification

```bash
# Regenerate and verify contracts against deployed API
npm run contracts:generate
npm run verify:contracts

# Verify coordinated release (checks artifact version consistency)
node scripts/verification/verify-coordinated-release.mjs
```

---

## Rollback Procedure

If verification fails or a critical issue is discovered, rollback all three artifacts
together. **Do not rollback individual artifacts** — this would create a contract
version mismatch.

### Rollback Steps

```text
1. Halt further traffic to the affected environment
2. Rollback database migrations if deployed (additive migrations only — no data loss)
3. Rollback API artifact to the previous stable revision
4. Rollback web artifact to the previous stable revision
5. Rollback admin artifact to the previous stable revision
6. Verify health and contract version consistency
7. Resume traffic
```

### Rollback Commands

```bash
# Step 1: Rollback database (if migration was additive and reversible)
# <deployment-specific database rollback command>

# Steps 2-4: Deploy previous stable artifacts
# <deployment-specific rollback commands for API, web, admin>

# Step 5: Verify rollback
curl -f https://<api-host>/api/v1/health
npm run contracts:generate
npm run verify:contracts
```

### Rollback Criteria

Initiate rollback if any of the following occur:

- API health check fails
- Contract version header is missing or incorrect
- Web or admin application fails to load
- Verified flows produce contract mismatch errors
- Error rate increases beyond baseline by 5% or more
- P95 latency regresses beyond 10% on verified operations

---

## Key Contacts

| Role | Contact |
|---|---|
| Release Manager | <assignee> |
| API Team Lead | <assignee> |
| Web (Driver) Lead | <assignee> |
| Admin Lead | <assignee> |
| QA / Verification | <assignee> |
| Infrastructure / Ops | <assignee> |

---

## Emergency Exceptions

Any deviation from this runbook requires approval from the release manager and must
be documented in the release notes. Incompatible changes within contract major version 1
are not permitted without an approved compatibility transition.
