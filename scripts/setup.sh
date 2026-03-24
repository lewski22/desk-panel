#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $*"; }
error() { echo -e "${RED}[setup]${NC} $*"; exit 1; }

command -v node   >/dev/null 2>&1 || error "Node.js 20+ required"
command -v docker >/dev/null 2>&1 || warn  "Docker not found — start PostgreSQL manually"

[ ! -f backend/.env      ] && cp backend/.env.example backend/.env && warn "Created backend/.env — review secrets"
[ ! -f apps/admin/.env   ] && cp apps/admin/.env.example apps/admin/.env
[ ! -f apps/staff/.env   ] && cp apps/staff/.env.example apps/staff/.env

info "Installing dependencies..."
(cd backend    && npm install --prefer-offline)
(cd apps/admin && npm install --prefer-offline)
(cd apps/staff && npm install --prefer-offline)

info "Generating Prisma client..."
(cd backend && npx prisma generate)

if command -v docker >/dev/null 2>&1; then
  info "Starting PostgreSQL + Mosquitto..."
  docker-compose up -d postgres mosquitto
  until docker-compose exec -T postgres pg_isready -U admin -d desk >/dev/null 2>&1; do
    sleep 1; printf '.'; done; echo ""
fi

info "Running database migrations..."
(cd backend && DATABASE_URL="postgresql://admin:admin@localhost:5432/desk" npx prisma migrate deploy)

info "Seeding database..."
(cd backend && DATABASE_URL="postgresql://admin:admin@localhost:5432/desk" npx ts-node src/database/seeds/seed.ts)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "✅  Setup complete!"
echo ""
echo "  npm run dev              — start everything (requires concurrently)"
echo "  npm run dev:backend      — http://localhost:3000"
echo "  npm run dev:admin        — http://localhost:5174"
echo "  npm run dev:staff        — http://localhost:5173"
echo "  http://localhost:3000/api/docs  — Swagger UI"
echo ""
echo "  superadmin@reserti.pl  / Admin1234!"
echo "  admin@demo-corp.pl     / Admin1234!"
echo "  staff@demo-corp.pl     / Staff1234!"
echo "  user@demo-corp.pl      / User1234!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
