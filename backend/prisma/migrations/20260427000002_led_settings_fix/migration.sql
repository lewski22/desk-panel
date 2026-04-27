-- Fix: add LED columns if they were not applied by the previous migration
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "ledBrightness"         INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "ledColorFree"          TEXT    NOT NULL DEFAULT '#00C800';
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "ledColorReserved"      TEXT    NOT NULL DEFAULT '#0050DC';
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "ledColorOccupied"      TEXT    NOT NULL DEFAULT '#DC0000';
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "ledColorGuestReserved" TEXT    NOT NULL DEFAULT '#C8A000';
