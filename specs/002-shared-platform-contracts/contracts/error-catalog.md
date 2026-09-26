# Governed Error Catalog

This is the required Phase 1 baseline. Domain-specific codes may be added only with a unique
meaning, registered HTTP mapping, retry policy, safe details schema, realms, and tests.

| Code | HTTP | Category | Automatic Retry | Notes |
|---|---:|---|---|---|
| `VALIDATION_ERROR` | 400 | validation | never | May contain safe field issues |
| `INVALID_CURSOR` | 400 | validation | never | Cursor malformed, expired, or bound to another query |
| `UNAUTHENTICATED` | 401 | authentication | never | Realm-specific session handling |
| `SESSION_EXPIRED` | 401 | authentication | never | Refresh flow may run once outside query retry |
| `FORBIDDEN` | 403 | authorization | never | Valid identity lacks permission or ownership |
| `ADMIN_MFA_REQUIRED` | 403 | authorization | never | Admin-only distinct application outcome |
| `ADMIN_PERMISSIONS_STALE` | 403 | authorization | never | Admin permission version refresh required |
| `NOT_FOUND` | 404 | not-found | never | Does not reveal unauthorized private existence |
| `CONFLICT` | 409 | conflict | never | Deterministic state conflict |
| `IDEMPOTENCY_KEY_REUSED` | 409 | conflict | never | Same scoped key with a different request hash |
| `IDEMPOTENCY_IN_PROGRESS` | 409 | conflict | caller-controlled | May provide `Retry-After` |
| `CONTRACT_VIOLATION` | 502 | contract | never | Received success/failure body fails its schema |
| `CONTRACT_VERSION_MISMATCH` | 502 | contract | never | Unsupported contract major |
| `RATE_LIMITED` | 429 | throttling | retry-after | Safe reads only unless write is idempotent |
| `PROVIDER_UNAVAILABLE` | 503 | transient | safe-read or idempotent-write | No private provider details |
| `SERVICE_UNAVAILABLE` | 503 | transient | safe-read or idempotent-write | Temporary platform dependency failure |
| `INTERNAL_ERROR` | 500 | internal | never by default | Sanitized fallback and request ID only |

## Error Registration Rules

- One code has one platform-wide meaning.
- HTTP status is not sufficient to infer the application outcome.
- Codes use uppercase snake case.
- Raw Prisma codes, SQL details, provider messages, stack traces, credentials, and personal data do
  not cross the boundary.
- Driver and admin authentication errors remain realm-specific when behavior differs.
- Client retry classification is derived from the registered code and operation policy.
- Unknown error codes normalize to `CONTRACT_VIOLATION`, retain the request ID, and do not retry
  automatically.
