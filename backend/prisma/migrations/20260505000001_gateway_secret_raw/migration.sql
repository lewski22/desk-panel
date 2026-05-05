-- Add secretRaw column to Gateway for HMAC-based auth exchange.
-- Nullable: existing gateways get populated on next rotate-secret or re-register.
ALTER TABLE "Gateway" ADD COLUMN "secretRaw" TEXT;
