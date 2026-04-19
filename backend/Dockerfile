FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json tsconfig.json nest-cli.json ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl postgresql-client
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps
COPY --from=builder /app/prisma       ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist         ./dist
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh
CMD ["sh", "entrypoint.sh"]
EXPOSE 3000
