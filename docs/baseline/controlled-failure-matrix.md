# Controlled Failure Matrix

| Step ID | Group | Test Mutation | Expected Local Exit | Expected CI Result | Expected Artifact |
|---|---|---|---|---|---|
| prerequisites | generation | Set DATABASE_URL to empty string | non-zero | non-zero | Prerequisite failure report |
| prerequisites | generation | Set NODE_ENV=production | non-zero | non-zero | Prerequisite failure report |
| prisma-generate | generation | Delete prisma/schema.prisma | non-zero | non-zero | Generation error |
| lint | lint | Introduce lint error in src/ | non-zero | non-zero | Lint output |
| typecheck | typecheck | Introduce type error in src/ | non-zero | non-zero | Typecheck output |
| unit | unit | Break a unit test assertion | non-zero | non-zero | Test report (JUnit) |
| integration | integration | Break integration test | non-zero | non-zero | Integration test output |
| contract | contract | Remove contract test script | non-zero | non-zero | Contract output |
| smoke | smoke | Break a smoke test assertion | non-zero | non-zero | Smoke test output |
| e2e | e2e | Change allowed group name | non-zero | non-zero | E2E not_applicable output |
| api-build | build | Introduce syntax error in API source | non-zero | non-zero | Build error output |
| web-build | build | Break a web component import | non-zero | non-zero | Web build error |
| admin-build | build | Break an admin component import | non-zero | non-zero | Admin build error |
| route-audit | audit | Remove router.tsx | non-zero | non-zero | Route audit failure |
| measurement | measurement | Delete build output | non-zero | non-zero | Measurement output |
| adr-format | audit | Create malformed ADR file | non-zero | non-zero | ADR format failure |
| security-artifacts | audit | Add fake secret to docs/ | non-zero | non-zero | Security scan output |
| report-validation | measurement | Corrupt baseline-report.json | non-zero | non-zero | Schema validation error |

## Local Test Results (automated)

Evidence source: `scripts/verification/tests/controlled-failure.test.mjs` — tests use temporary fixtures, injected environment values, and `runStep` with simulated failures. No files were destructively modified.

| Step ID | Reversible Mutation | Actual Exit Code | Stable Step ID | Test Evidence |
|---|---|---|---|---|
| prerequisites | Set DATABASE_URL to empty string | non-zero | prerequisites | `controlled-failure.test.mjs` — injected env with empty DATABASE_URL |
| prerequisites | Set NODE_ENV=production | non-zero | prerequisites | `controlled-failure.test.mjs` — injected env with NODE_ENV=production |
| lint | Introduce lint error in src/ | non-zero | lint | `controlled-failure.test.mjs` — eslint on file with type error exits non-zero |
| typecheck | Force typecheck command to fail | non-zero | typecheck | `controlled-failure.test.mjs` — simulated typecheck via exit 1 |
| unit | Force unit step to fail | non-zero | unit | `controlled-failure.test.mjs` — simulated unit via exit 1 |
| api-build | Force build step to fail | non-zero | api-build | `controlled-failure.test.mjs` — simulated build via exit 1 |
| evidence-test | Print secret then fail | non-zero (redacted) | evidence-test | `controlled-failure.test.mjs` — secret value is redacted in summary |

## CI Results

CI controlled-failure runs are **not yet executed**. The results above are from local automated tests only. CI evidence will be recorded after the first real CI workflow run.
