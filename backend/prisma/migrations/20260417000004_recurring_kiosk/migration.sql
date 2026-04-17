-- Migration: recurring_kiosk (Sprint G1 + H3)

-- G1: Cykliczne rezerwacje — pola na Reservation
ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "recurrenceRule"    TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;

-- Index dla szybkiego pobierania serii
CREATE INDEX IF NOT EXISTS "Reservation_recurrenceGroupId_idx"
  ON "Reservation"("recurrenceGroupId")
  WHERE "recurrenceGroupId" IS NOT NULL;

-- H3: Kiosk mode — PIN per lokalizacja
ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "kioskPin" TEXT;
