-- Migration: gateway_key_rotation_notif
-- Dodaje GATEWAY_KEY_ROTATION_FAILED do enumu InAppNotifType
--
-- UWAGA: ALTER TYPE ADD VALUE nie może działać wewnątrz bloku transakcji
-- w PostgreSQL < 12. Używamy DO $$ … $$ z obsługą wyjątku.

DO $$ BEGIN
  ALTER TYPE "InAppNotifType" ADD VALUE 'GATEWAY_KEY_ROTATION_FAILED';
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'GATEWAY_KEY_ROTATION_FAILED already exists in InAppNotifType — skipping.';
END $$;

-- Seed domyślnej reguły dla nowego typu
-- ON CONFLICT: nie nadpisuje jeśli admin już zmienił ustawienia
INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES ('GATEWAY_KEY_ROTATION_FAILED', ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;
