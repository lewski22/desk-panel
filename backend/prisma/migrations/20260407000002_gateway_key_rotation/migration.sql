-- GatewayKeyRotation
-- Adds rotation fields to Gateway for 15-minute overlap window during secret rotation.
-- Safe defaults: both nullable, no impact on existing rows.

ALTER TABLE "Gateway"
  ADD COLUMN "secretHashPending"      TEXT,
  ADD COLUMN "secretPendingExpiresAt" TIMESTAMP(3);
