-- This migration requires no transaction.
ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "parkingQrCheckinEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Resource"
  DROP COLUMN IF EXISTS "qrCheckinEnabled";
