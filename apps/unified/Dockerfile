FROM node:20-alpine AS builder
WORKDIR /app

# Kopiuj package*.json — obejmuje package-lock.json jeśli istnieje
# Po wygenerowaniu package-lock.json lokalnie (npm install w apps/unified/)
# i zacommitowaniu go do repo, zmień poniższe na: RUN npm ci
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { \
    try_files $uri $uri/ /index.html; \
  } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
