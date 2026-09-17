# CI Operations

## Workflow Triggers

- Push to `main`
- Pull request to `main`
- Manual dispatch via `workflow_dispatch`

## Required CI Variables

- `NEON_DATABASE_URL_CI` — pooled Neon connection string for the disposable CI database
- `NEON_DIRECT_URL_CI` — direct Neon connection string for Prisma CLI
- `JWT_ACCESS_SECRET` — non-production driver auth secret
- `JWT_REFRESH_SECRET` — non-production driver refresh secret
- `ADMIN_JWT_ACCESS_SECRET` — non-production admin auth secret
- `ADMIN_JWT_REFRESH_SECRET` — non-production admin refresh secret

## Disposable Database Behavior

CI connects to a dedicated Neon test database or branch whose database name starts with the
`ehsbha_test_` prefix. Prisma runtime uses the pooled URL, while migrations use the direct URL.

## Artifact Retention

Failure artifacts are retained for 7 days. They include:
- Verification baseline report
- Test coverage output
- Route audit output

## Rerun Procedure

1. Navigate to the Actions tab in GitHub
2. Select the failed workflow run
3. Click "Re-run jobs" → "Re-run failed jobs"

## Diagnostics

Each stable step ID maps to a specific verification command:
- `prerequisites` → `scripts/verification/check-prerequisites.mjs`
- `lint` → `npm run lint`
- `typecheck` → `npm run typecheck`
- `unit` → `npm run test -- --runInBand`
- `integration` → `npm run test:integration`
- `build` → `npm run build`
- `route-audit` → `npm run verify:routes`
- `measurement` → `npm run verify:measure`
