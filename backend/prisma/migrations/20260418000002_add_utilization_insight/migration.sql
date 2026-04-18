-- Migration: add_utilization_insight
-- File: prisma/migrations/20260418000002_add_utilization_insight/migration.sql
--
-- Dodaje tabelę do cachowania wyników K2 (AI utilization insights).
-- Cron generuje wpis raz dziennie per lokalizacja.
-- Bezpieczna: CREATE TABLE IF NOT EXISTS, nullable, idempotentna.

CREATE TABLE IF NOT EXISTS "UtilizationInsight" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "locationId"  TEXT         NOT NULL,
  "orgId"       TEXT         NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "periodDays"  INTEGER      NOT NULL DEFAULT 30,
  "insights"    JSONB        NOT NULL DEFAULT '[]',

  CONSTRAINT "UtilizationInsight_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "UtilizationInsight_locationId_fkey"
    FOREIGN KEY ("locationId")
    REFERENCES "Location"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "UtilizationInsight_locationId_idx"
  ON "UtilizationInsight"("locationId");

CREATE INDEX IF NOT EXISTS "UtilizationInsight_orgId_generatedAt_idx"
  ON "UtilizationInsight"("orgId", "generatedAt" DESC);
