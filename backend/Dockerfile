# Context: /backend  (Coolify base directory)
# Dockerfile: backend/Dockerfile

# ── Build stage ───────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json tsconfig.json nest-cli.json ./
RUN npm install --frozen-lockfile

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]

EXPOSE 3000
