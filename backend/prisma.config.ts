/**
 * Prisma 7 — konfiguracja CLI i migracji.
 *
 * WAŻNE: ten plik jest używany przez Prisma CLI (migrate deploy, generate, studio).
 * DATABASE_URL jest tu podawany dla CLI — runtime używa adaptera pg w PrismaService.
 *
 * W Dockerze: dotenv ładuje .env automatycznie przez ts-node/tsx,
 * ale w Coolify zmienne środowiskowe są przekazywane bezpośrednio przez process.env.
 */
import { defineConfig } from 'prisma/config';

// Załaduj .env jeśli istnieje (dev) — w prod process.env ustawiony przez Coolify
try {
  require('dotenv').config();
} catch {
  // dotenv opcjonalny — w prod nie jest wymagany
}

export default defineConfig({
  schema:     'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
