-- Migration: gateway_key_rotation_notif
-- Dodaje GATEWAY_KEY_ROTATION_FAILED do enumu InAppNotifType
--
-- UWAGA: ALTER TYPE ADD VALUE nie może działać wewnątrz transakcji PostgreSQL.
-- Prisma 5.x obsługuje to przez specjalny komentarz na początku pliku:
-- "This migration requires no transaction" — wyłącza BEGIN/COMMIT wrapping.

-- This migration requires no transaction.

ALTER TYPE "InAppNotifType" ADD VALUE IF NOT EXISTS 'GATEWAY_KEY_ROTATION_FAILED';

INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES ('GATEWAY_KEY_ROTATION_FAILED', ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;
