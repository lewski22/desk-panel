# Context: /backend  (Coolify base directory)
# Dockerfile: backend/Dockerfile

# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# OpenSSL needed by Prisma
RUN apk add --no-cache openssl

COPY package.json tsconfig.json nest-cli.json ./
RUN npm install --frozen-lockfile

COPY prisma ./prisma

# Generate Prisma client with binary targets for alpine
RUN npx prisma generate

COPY src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL required at runtime by Prisma
RUN apk add --no-cache openssl

COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./

# prisma migrate deploy requires DATABASE_URL — runs at container start
# when env vars from Coolify are already injected
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main"]

EXPOSE 3000
