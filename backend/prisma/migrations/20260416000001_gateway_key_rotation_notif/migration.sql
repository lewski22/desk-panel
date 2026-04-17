-- Migration: gateway_key_rotation_notif
-- Dodaje GATEWAY_KEY_ROTATION_FAILED do enumu InAppNotifType
--
-- ALTER TYPE ADD VALUE nie może działać wewnątrz transakcji.
-- Trick: COMMIT kończy bieżącą transakcję Prismy, ALTER TYPE działa poza nią,
-- BEGIN otwiera nową transakcję dla kolejnych operacji.

COMMIT;
ALTER TYPE "InAppNotifType" ADD VALUE IF NOT EXISTS 'GATEWAY_KEY_ROTATION_FAILED';
BEGIN;

INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES ('GATEWAY_KEY_ROTATION_FAILED', ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;
