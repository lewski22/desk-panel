-- Migration: device_ota_status
-- Adds OTA tracking fields to Device table

ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "otaStatus"    TEXT,
  ADD COLUMN IF NOT EXISTS "otaVersion"   TEXT,
  ADD COLUMN IF NOT EXISTS "otaStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "otaFinishedAt" TIMESTAMP(3);

-- Index dla crona timeoutów — szuka in_progress starszych niż 10 min
CREATE INDEX IF NOT EXISTS "Device_otaStatus_otaStartedAt_idx"
  ON "Device"("otaStatus", "otaStartedAt")
  WHERE "otaStatus" = 'in_progress';
