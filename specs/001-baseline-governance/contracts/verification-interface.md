# Verification Interface Contract

## Root Commands

The root package exposes these stable command names:

| Command | Required behavior |
|---|---|
| `npm run lint` | Check all applicable workspaces and fail on violations |
| `npm test` | Run existing unit and regression tests |
| `npm run test:integration` | Verify clean database setup, API startup, liveness, and readiness |
| `npm run test:contract` | Run existing contract checks or report the group as absent |
| `npm run test:smoke` | Run deterministic API smoke checks |
| `npm run test:coverage` | Produce coverage output for tested workspaces |
| `npm run test:e2e` | Run Phase 0 E2E tests or explicitly return `not_applicable` |
| `npm run build` | Produce API, web, and admin production builds |
| `npm run verify` | Execute every blocking Phase 0 gate and write the baseline report |

## Exit Semantics

- Exit `0`: all blocking steps passed; allowed groups may be `not_applicable`.
- Non-zero: at least one blocking step failed or the report could not be completed safely.
- A missing command, missing required integration test, or skipped blocking step is a failure.
- Output must identify the failed stable step ID.

## Safety Contract

- Verification rejects production-mode credentials and databases.
- Destructive database setup requires an explicit test database name/prefix.
- Logs and reports redact secrets, tokens, passwords, connection strings, private images, and
  personal data.
- External OCR and mail services are replaced by deterministic fixtures/substitutes unless a
  separately named non-blocking live smoke command is invoked.

## Local/CI Parity

CI invokes `npm run verify`; it does not reimplement acceptance logic in workflow YAML.
Environment preparation may differ, but stable step IDs and blocking semantics remain identical.

## Evidence

The command writes a report conforming to
[`baseline-report.schema.json`](./baseline-report.schema.json). Transient logs and build outputs
are CI artifacts or ignored local outputs, not committed source.

