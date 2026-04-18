-- Migration: add_floor_plan_key
-- File: prisma/migrations/20260418000001_add_floor_plan_key/migration.sql
--
-- Dodaje pole floorPlanKey do Location — przechowuje klucz S3/R2
-- żeby móc usuwać stare pliki przy nadpisaniu planu piętra.
-- Bezpieczne: ADD COLUMN IF NOT EXISTS, nullable.

ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "floorPlanKey" TEXT;
