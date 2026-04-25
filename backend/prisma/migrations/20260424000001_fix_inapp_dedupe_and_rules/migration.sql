-- FIX P0-1: Add missing dedupeKey column to InAppNotification
-- (schema.prisma already declares it as String?, but the original migration SQL omitted it)
ALTER TABLE "InAppNotification"
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE INDEX IF NOT EXISTS "InAppNotification_dedupeKey_idx"
  ON "InAppNotification"("dedupeKey");

-- FIX P0-1: Seed GATEWAY_KEY_ROTATION_FAILED rule (the others were seeded in 20260423000002)
INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES
  ('GATEWAY_KEY_ROTATION_FAILED', ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;
