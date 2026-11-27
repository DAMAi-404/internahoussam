#!/usr/bin/env bash
# Runs the migrations and pgTAP tests on a plain local Postgres (no Docker needed).
# Usage: PGHOST=/tmp PGPORT=54329 scripts/db/test-local.sh
# With the Supabase CLI, `supabase db reset && supabase test db` does the same against the real stack.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=mahroussa_test
export PGUSER="${PGUSER:-postgres}"
psql -q -v ON_ERROR_STOP=1 -c "drop database if exists $DB" -c "create database $DB" postgres
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f scripts/db/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" > /dev/null
done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -c "create extension if not exists pgtap"
status=0
for t in supabase/tests/*.sql; do
  out=$(psql -X -q -tA -v ON_ERROR_STOP=1 -d "$DB" -f "$t" 2>&1) || status=1
  echo "$out" | grep -E "^(not ok|# |ERROR|psql)" || true
  echo "$(basename "$t"): $(echo "$out" | grep -c '^ok') ok, $(echo "$out" | grep -c '^not ok') not ok"
  echo "$out" | grep -q '^not ok' && status=1
done
exit $status
