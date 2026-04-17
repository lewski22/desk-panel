#!/bin/sh
# Reserti — Docker entrypoint
# Obsługuje 3 scenariusze bezpiecznego startu z prisma migrate deploy.
#
# Scenariusz 1: Świeża DB (brak tabeli _prisma_migrations)
#   → migrate deploy tworzy wszystkie tabele od zera
#
# Scenariusz 2: Istniejąca DB z db push (tabele istnieją, brak historii migracji)
#   → INSERT baseline migration jako już zastosowanej
#   → migrate deploy = no-op dla baseline, uruchamia tylko nowe
#
# Scenariusz 3: DB zarządzana przez migrate (historia istnieje)
#   → Auto-resolve FAILED migracji (failed = started_at bez finished_at)
#   → migrate deploy uruchamia tylko nowe/pending migracje

set -e

BASELINE_NAME="20260407000000_init"
BASELINE_CHECKSUM="602fa3123ee9d8957fb3e808594209001c9525921fc07bc7b06d387f287dfd23"

echo "→ Checking database migration state..."

MIGRATIONS_TABLE=$(psql "$DATABASE_URL" -tAc \
  "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='_prisma_migrations')" \
  2>/dev/null || echo "false")

if [ "$MIGRATIONS_TABLE" = "t" ]; then
  # Tabela istnieje — sprawdź czy baseline jest zapisany
  BASELINE_EXISTS=$(psql "$DATABASE_URL" -tAc \
    "SELECT EXISTS(SELECT 1 FROM _prisma_migrations WHERE migration_name='$BASELINE_NAME')" \
    2>/dev/null || echo "false")

  if [ "$BASELINE_EXISTS" = "f" ]; then
    # Istniejąca DB bez historii migracji (db push) — wstaw baseline
    echo "→ Existing DB without migration history. Inserting baseline..."
    psql "$DATABASE_URL" -c "
      INSERT INTO _prisma_migrations
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        (gen_random_uuid()::text, '$BASELINE_CHECKSUM', now(), '$BASELINE_NAME', NULL, NULL, now(), 1)
      ON CONFLICT DO NOTHING;
    " 2>/dev/null || true
    echo "→ Baseline inserted."
  fi

  # KLUCZOWE: Napraw migracje w stanie "failed" (started_at bez finished_at)
  # Prisma blokuje deploy gdy jakakolwiek migracja jest w tym stanie (P3009)
  # Bezpieczne bo WSZYSTKIE nasze migracje są idempotentne (IF NOT EXISTS etc.)
  FAILED=$(psql "$DATABASE_URL" -tAc \
    "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL" \
    2>/dev/null || echo "0")

  if [ "$FAILED" != "0" ] && [ -n "$FAILED" ] && [ "$FAILED" != "" ]; then
    echo "→ Found $FAILED failed migration(s) — auto-resolving as rolled_back..."
    psql "$DATABASE_URL" -c "
      UPDATE _prisma_migrations
      SET rolled_back_at = NOW()
      WHERE finished_at IS NULL AND rolled_back_at IS NULL;
    " 2>/dev/null || true
    echo "→ Failed migrations resolved. Prisma will re-run them."
  fi

  echo "→ Running prisma migrate deploy..."
else
  echo "→ Fresh database. Running full prisma migrate deploy..."
fi

npx prisma migrate deploy

echo "→ Running seed (idempotent)..."
node dist/database/seeds/seed.js

echo "→ Application starting..."
exec node dist/main
