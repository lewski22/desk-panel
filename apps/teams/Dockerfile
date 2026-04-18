# Dockerfile — Reserti Teams App
# Deploy na: teams.prohalw2026.ovh (Coolify)

# ── Etap 1: build ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

COPY . .

# Build wymaga VITE_API_URL — podaj przez build arg
ARG VITE_API_URL=https://api.prohalw2026.ovh/api/v1
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Etap 2: serve static ──────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config — SPA fallback (wszystko → index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
