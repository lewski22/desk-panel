# ── Build stage ───────────────────────────────────────────────
# Context: repo root (desk-panel/)
# Coolify wywołuje: docker build -f infra/docker/backend/Dockerfile .
FROM node:20-alpine AS builder
WORKDIR /app

# Kopiuj tylko backend
COPY backend/package.json backend/tsconfig.json backend/nest-cli.json ./
RUN npm install --frozen-lockfile

# Prisma schema → generuj client PRZED kopiowaniem src
COPY backend/prisma ./prisma
RUN npx prisma generate

# Kopiuj źródła i buduj
COPY backend/src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./

# Migracje + start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

EXPOSE 3000
