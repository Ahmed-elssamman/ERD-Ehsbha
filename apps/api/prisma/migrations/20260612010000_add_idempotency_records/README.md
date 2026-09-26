# Idempotency Ledger Migration

This migration is additive. Older API revisions ignore the new table, so coordinated artifact
rollback does not require dropping it. A forward fix may remove expired rows before changing
constraints. Do not roll back by dropping the table during the release rollback window because
newer API instances may still be draining requests.
