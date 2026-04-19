#!/bin/sh
set -e
BASELINE="20260407000000_init"
CHECKSUM="602fa3123ee9d8957fb3e808594209001c9525921fc07bc7b06d387f287dfd23"
echo "→ Checking migration state..."
MT=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='_prisma_migrations')" 2>/dev/null||echo "false")
if [ "$MT" = "t" ]; then
  BE=$(psql "$DATABASE_URL" -tAc "SELECT EXISTS(SELECT 1 FROM _prisma_migrations WHERE migration_name='$BASELINE')" 2>/dev/null||echo "false")
  if [ "$BE" = "f" ]; then
    psql "$DATABASE_URL" -c "INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES (gen_random_uuid()::text,'$CHECKSUM',now(),'$BASELINE',NULL,NULL,now(),1) ON CONFLICT DO NOTHING;" 2>/dev/null||true
  fi
  FL=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL" 2>/dev/null||echo "0")
  if [ "$FL" != "0" ] && [ -n "$FL" ]; then
    psql "$DATABASE_URL" -c "UPDATE _prisma_migrations SET rolled_back_at=NOW() WHERE finished_at IS NULL AND rolled_back_at IS NULL;" 2>/dev/null||true
  fi
fi
echo "→ prisma migrate deploy..."
npx prisma@5 migrate deploy
echo "→ seed..."
node dist/database/seeds/seed.js
echo "→ Starting..."
exec node dist/main
