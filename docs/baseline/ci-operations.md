# CI Operations

## Workflow Triggers

- Push to `main`
- Pull request to `main`
- Manual dispatch via `workflow_dispatch`

## Required CI Variables

- `DATABASE_URL` — set to disposable PostgreSQL connection string
- `JWT_DRIVER_SECRET` — non-production secret
- `JWT_ADMIN_SECRET` — non-production secret

## Disposable Database Behavior

A PostgreSQL service container is started for each CI run with a disposable database name matching the `ehsbha_test_` prefix. The database is automatically destroyed when the job completes.

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
