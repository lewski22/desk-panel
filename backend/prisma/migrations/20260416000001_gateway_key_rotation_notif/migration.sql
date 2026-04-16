-- Migration: gateway_key_rotation_notif
-- Dodaje nowy typ powiadomienia GATEWAY_KEY_ROTATION_FAILED
-- do enumu InAppNotifType oraz domyślną regułę NotificationRule

-- PostgreSQL wymaga ALTER TYPE … ADD VALUE dla istniejącego enumu
ALTER TYPE "InAppNotifType" ADD VALUE IF NOT EXISTS 'GATEWAY_KEY_ROTATION_FAILED';

-- Seed domyślnej reguły — widoczna dla SUPER_ADMIN (alert bezpieczeństwa)
-- ON CONFLICT: nie nadpisuje jeśli admin już zmienił ustawienia
INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES ('GATEWAY_KEY_ROTATION_FAILED', ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;
