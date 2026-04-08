# Context: /backend  (Coolify base directory)
# Dockerfile: backend/Dockerfile

# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# OpenSSL needed by Prisma
RUN apk add --no-cache openssl

COPY package*.json tsconfig.json nest-cli.json prisma.config.ts ./
RUN npm install --legacy-peer-deps

COPY prisma ./prisma

# Generate Prisma client with binary targets for alpine
RUN npx prisma generate

COPY src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL required by Prisma, postgresql-client for migration baseline check
RUN apk add --no-cache openssl postgresql-client

COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./

# Seed uruchamiany raz przy starcie — upsert jest idempotentny
COPY entrypoint.sh ./entrypoint.sh
CMD ["sh", "entrypoint.sh"]

EXPOSE 3000
