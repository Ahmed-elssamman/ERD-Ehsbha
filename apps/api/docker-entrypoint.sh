#!/bin/sh
# Construct a percent-encoded DATABASE_URL from DB_* env vars to support
# passwords containing URL-reserved characters (@ : / ? # % space).
# Fail fast when POSTGRES_PASSWORD is missing.

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "FATAL: POSTGRES_PASSWORD is required" >&2
  exit 1
fi

DB_USER="${POSTGRES_USER:-ehsbha}"
DB_PASS="$POSTGRES_PASSWORD"
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-ehsbha}"

# Percent-encode the password using Node.js (available in the api image)
ENCODED_PASS=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$DB_PASS")

export DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"

exec "$@"
