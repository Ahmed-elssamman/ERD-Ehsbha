# Data Model: Baseline Evidence

Phase 0 does not add product database entities. The following repository artifacts model
verification and governance evidence.

## Verification Baseline

Represents one authoritative verification result for a repository revision.

| Field | Type | Rules |
|---|---|---|
| `schemaVersion` | string | Required; semantic version of the report contract |
| `revision` | string | Required Git commit SHA or explicit working-tree marker |
| `branch` | string | Required |
| `startedAt` / `completedAt` | UTC timestamp | Required; completion must not precede start |
| `environment` | Support Matrix reference | Required; Windows must be authoritative |
| `overallStatus` | enum | `passed` or `failed` |
| `steps` | Verification Step Result[] | Required; unique step IDs |
| `knownLimitations` | string[] | Required, may be empty |
| `artifactMeasurements` | Artifact Measurement[] | Required for web/admin builds |
| `coverageRecords` | Coverage Record[] | Required for route/service audits |

### State Transition

`started -> passed | failed`

An interrupted run is not an authoritative baseline and must be reported separately from a pass.

## Verification Step Result

| Field | Type | Rules |
|---|---|---|
| `id` | string | Stable unique identifier such as `typecheck` or `db-clean-migrate` |
| `group` | enum | generation, lint, typecheck, unit, integration, contract, smoke, e2e, migration, build, audit, measurement |
| `status` | enum | `passed`, `failed`, `not_applicable` |
| `startedAt` / `completedAt` | UTC timestamp | Required |
| `durationMs` | non-negative integer | Required |
| `summary` | string | Sanitized, bounded description |
| `artifactPaths` | string[] | Repository-relative or CI artifact-relative |

`not_applicable` is permitted only when the contract explicitly allows it, including the Phase 0
browser E2E group.

## Coverage Record

Represents evidence for one route, page, backing service, or permission expectation.

| Field | Type | Rules |
|---|---|---|
| `surface` | enum | `web`, `admin`, `api` |
| `kind` | enum | `route`, `page`, `endpoint`, `permission`, `translation`, `empty-state`, `service-worker` |
| `identifier` | string | Unique within surface and kind |
| `activity` | enum | `active`, `obsolete`, `scaffold` |
| `status` | enum | `passed`, `failed`, `known_gap` |
| `evidence` | string | Reproducible check or named review action |
| `blocking` | boolean | Must be true for failed active routes/pages/services |
| `owner` | string | Required for known gaps |
| `followUp` | string | Required for known gaps |

## Support Matrix

| Field | Type | Rules |
|---|---|---|
| `node` | version range | Node 22 LTS |
| `npm` | version range | Compatible with lockfile v3 and selected Node release |
| `postgresql` | version range | Selected during implementation from currently supported project/deployment versions |
| `windows` | version list | Authoritative supported versions |
| `browsers` | map | Supported current browser versions for web/admin route checks |
| `linuxStatus` | enum | `deferred` for Phase 0 |

## Artifact Measurement

| Field | Type | Rules |
|---|---|---|
| `application` | enum | `web`, `admin` |
| `artifactPath` | string | Build-relative path |
| `category` | enum | `entry-js`, `route-js`, `css`, `asset`, `pwa` |
| `rawBytes` | non-negative integer | Required |
| `compressedBytes` | non-negative integer | Required when compression is measured |
| `budgetStatus` | enum | `within`, `over`, `unclassified` |

Phase 0 records over-budget results but optimizes only when the artifact prevents required
functionality.

## Architecture Decision Record

| Field | Type | Rules |
|---|---|---|
| `id` | string | Sequential ADR identifier |
| `title` | string | Required |
| `status` | enum | `proposed`, `accepted`, `superseded`, `deprecated` |
| `date` | date | Required |
| `owner` | string | Required |
| `context` | markdown | Required |
| `decision` | markdown | Required |
| `alternatives` | markdown | Required |
| `consequences` | markdown | Required |
| `supersedes` | ADR ID | Optional |

## Relationships

- A Verification Baseline references one Support Matrix.
- A Verification Baseline contains many Verification Step Results, Artifact Measurements, and
  Coverage Records.
- Known-gap Coverage Records require follow-up ownership.
- ADRs explain durable decisions that shape the Support Matrix or verification process.

