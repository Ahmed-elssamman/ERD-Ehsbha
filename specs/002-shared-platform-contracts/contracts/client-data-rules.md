# Client Data Rules

## Ownership

- Axios instances remain application-owned.
- Driver and admin authentication stores, refresh calls, redirects, and session outcomes remain
  separate.
- Shared packages provide schemas and platform-neutral classification only.
- Feature clients import domain subpaths from `@ehsbha/api-contracts`.
- Components do not call Axios directly.

## Parsing Sequence

1. Receive transport response.
2. Validate shared metadata.
3. Check contract major compatibility.
4. Validate success or failure envelope.
5. Validate operation data or registered error details.
6. Return typed data or a normalized application error.

No client uses unchecked generic casts or fallback `payload as T` behavior.

## Query Keys

- Each domain owns a serializable query-key factory.
- Keys begin with a stable domain identifier.
- Filter objects are normalized before inclusion.
- IDs use their shared branded type at the feature boundary.
- A successful mutation declares all keys it updates or invalidates.

## Retry Matrix

| Operation | Outcome | Automatic Behavior |
|---|---|---|
| Safe read | Network, 408, 502, 503, 504 | At most two retries with exponential backoff |
| Safe read | 429 | At most two retries and respect `Retry-After` |
| Any | Validation, authentication, authorization, not-found | No retry |
| Any | Deterministic conflict | No retry |
| Any | Contract violation or version mismatch | No retry |
| Non-idempotent write | Any transport uncertainty | No automatic retry |
| Idempotent write | Registered transient outcome | Operation-controlled retry with the same key |

## Realm-Specific Outcomes

Driver:

- `SESSION_EXPIRED`: attempt the existing single refresh flow, then clear driver state if refresh
  fails.
- `FORBIDDEN`: expose the feature-level forbidden outcome.

Admin:

- `SESSION_EXPIRED`: attempt the admin refresh flow, then route to login if refresh fails.
- `FORBIDDEN`: keep the session and show forbidden state.
- `ADMIN_MFA_REQUIRED`: route to the MFA challenge flow.
- `ADMIN_PERMISSIONS_STALE`: refresh identity/permissions before allowing privileged controls.

## Contract Failures

- Preserve request ID, operation ID, received version, and schema issue summary.
- Do not expose full private payloads in browser logs or analytics.
- Route-level and query-level error states receive a stable normalized category.
- Contract failures are reportable defects, not user input errors.
