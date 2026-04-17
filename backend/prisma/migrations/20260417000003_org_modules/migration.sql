-- Migration: org_modules (Sprint E — Owner module management)
-- Dodaje pole enabledModules do tabeli Organization
-- Semantyka: pusta tablica = wszystkie moduły aktywne (backward compat)
-- Możliwe wartości: 'DESKS', 'ROOMS', 'PARKING', 'FLOOR_PLAN', 'WEEKLY_VIEW'

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
