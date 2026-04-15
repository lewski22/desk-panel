FROM node:20-alpine AS builder
WORKDIR /app

# Kopiuj manifesty osobno — cache layer jeśli package.json nie zmienione
COPY package.json ./

# --legacy-peer-deps: unika kosztownej resolucji peer deps
# --no-audit --no-fund: pomija sieciowe sprawdzenia (szybciej, mniej pamięci)
RUN npm install --legacy-peer-deps --no-audit --no-fund

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
