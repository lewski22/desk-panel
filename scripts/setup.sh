#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Desk Beacon System — first-run dev setup
# Usage: ./scripts/setup.sh
# ─────────────────────────────────────────────────────────────
set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn()  { echo -e "${YELLOW}[setup]${NC} $*"; }

info "Desk Beacon System — dev setup"

# ── 1. Copy .env if missing ───────────────────────────────────
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  warn "Created backend/.env from example — edit before running in prod"
fi

# ── 2. Install backend deps ───────────────────────────────────
info "Installing backend dependencies..."
cd backend && npm install && cd ..

# ── 3. Generate Prisma client ─────────────────────────────────
info "Generating Prisma client..."
cd backend && npx prisma generate && cd ..

# ── 4. Start infra containers ─────────────────────────────────
info "Starting PostgreSQL + Mosquitto..."
docker-compose up -d postgres mosquitto

info "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U admin -d desk &>/dev/null; do
  sleep 1
done

# ── 5. Run migrations ─────────────────────────────────────────
info "Running database migrations..."
cd backend && DATABASE_URL="postgresql://admin:admin@localhost:5432/desk" \
  npx prisma migrate dev --name init && cd ..

# ── 6. Seed database ──────────────────────────────────────────
info "Seeding database with demo data..."
cd backend && DATABASE_URL="postgresql://admin:admin@localhost:5432/desk" \
  npx ts-node src/database/seeds/seed.ts && cd ..

# ── 7. Done ───────────────────────────────────────────────────
echo ""
info "✅ Setup complete!"
echo ""
echo "  Start backend:    cd backend && npm run start:dev"
echo "  Start all:        docker-compose up"
echo "  Swagger UI:       http://localhost:3000/api/docs"
echo "  Prisma Studio:    cd backend && npm run db:studio"
echo ""
echo "  Test accounts:"
echo "    superadmin@reserti.pl  / Admin1234!"
echo "    admin@demo-corp.pl     / Admin1234!"
echo "    staff@demo-corp.pl     / Staff1234!"
echo "    user@demo-corp.pl      / User1234!"
