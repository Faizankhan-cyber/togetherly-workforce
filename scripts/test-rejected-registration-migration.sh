#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=togetherly_test}"
: "${PGPASSWORD:?Set PGPASSWORD for the disposable PostgreSQL test database}"

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql --no-psqlrc --set ON_ERROR_STOP=1 \
  --host "$PGHOST" \
  --port "$PGPORT" \
  --username "$PGUSER" \
  --dbname "$PGDATABASE" \
  --file "$repo_root/supabase/tests/reapply_registration.test.sql"
