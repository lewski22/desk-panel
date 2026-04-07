#!/bin/sh
# Reserti — Docker entrypoint
# Handles safe migration from db push to migrate deploy.
#
# Logic:
#   1. Fresh DB (no _prisma_migrations table)
#      → migrate deploy runs full SQL (creates all tables)
#
#   2. Existing DB from db push (tables exist, no migration history)
#      → INSERT baseline migration as already applied
#      → migrate deploy = no-op for baseline, runs any new migrations
#
#   3. DB already managed by migrate (history table exists)
#      → migrate deploy runs only pending migrations

set -e

MIGRATION_NAME="20260407000000_init"
MIGRATION_CHECKSUM="602fa3123ee9d8957fb3e808594209001c9525921fc07bc7b06d387f287dfd23"

echo "→ Checking migration state..."

# Check if _prisma_migrations table exists
MIGRATIONS_TABLE_EXISTS=$(psql "$DATABASE_URL" -tAc \
  "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations')" \
  2>/dev/null || echo "false")

if [ "$MIGRATIONS_TABLE_EXISTS" = "t" ]; then
  # Table exists — check if baseline is already recorded
  BASELINE_EXISTS=$(psql "$DATABASE_URL" -tAc \
    "SELECT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name = '$MIGRATION_NAME')" \
    2>/dev/null || echo "false")

  if [ "$BASELINE_EXISTS" = "f" ]; then
    echo "→ Existing DB detected (db push). Marking baseline migration as applied..."
    psql "$DATABASE_URL" -c "
      INSERT INTO _prisma_migrations
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        (gen_random_uuid()::text, '$MIGRATION_CHECKSUM', now(), '$MIGRATION_NAME', NULL, NULL, now(), 1)
      ON CONFLICT DO NOTHING;
    " 2>/dev/null || true
    echo "→ Baseline marked. Running migrate deploy for pending migrations..."
  else
    echo "→ Migration history found. Running migrate deploy..."
  fi
else
  echo "→ Fresh DB. Running full migrate deploy..."
fi

npx prisma migrate deploy

echo "→ Running seed..."
node dist/database/seeds/seed.js

echo "→ Starting application..."
exec node dist/main
