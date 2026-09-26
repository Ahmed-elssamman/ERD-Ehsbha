# Test Environment

## Setup

1. Copy `apps/api/.env.test.example` to `apps/api/.env.test`
2. Set Neon pooled `DATABASE_URL` and direct `DIRECT_URL`
3. Ensure the test database name starts with `ehsbha_test_`
4. Never use production values

## Disposable Database Naming

All Neon-backed test databases MUST use the prefix `ehsbha_test_`. The verification safety guard
refuses destructive operations against other database names.

## Forbidden Values

- Production NODE_ENV
- Production database URLs
- Real JWT secrets
- Live OCR or mail service credentials

## Test Credentials

Use the non-production secrets from the `.env.test` file. They are safe to commit
because they are valueless outside the test environment.

## Cleanup

The integration test script cleans up after itself in a `finally` block. If a test
is interrupted, the disposable database can be dropped manually.
