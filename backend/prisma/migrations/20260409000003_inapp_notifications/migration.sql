-- Migration: inapp_notifications

CREATE TYPE "InAppNotifType" AS ENUM (
  'GATEWAY_OFFLINE',
  'GATEWAY_BACK_ONLINE',
  'BEACON_OFFLINE',
  'FIRMWARE_UPDATE',
  'GATEWAY_RESET_NEEDED',
  'RESERVATION_CHECKIN_MISSED',
  'SYSTEM_ANNOUNCEMENT'
);

-- Reguły — Owner konfiguruje kto widzi co
CREATE TABLE "NotificationRule" (
  "id"          TEXT      NOT NULL DEFAULT gen_random_uuid(),
  "type"        "InAppNotifType" NOT NULL,
  "targetRoles" TEXT[]    NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabled"     BOOLEAN   NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRule_pkey"  PRIMARY KEY ("id"),
  CONSTRAINT "NotificationRule_type_key" UNIQUE ("type")
);

-- Seed domyślnych reguł
INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled") VALUES
  ('GATEWAY_OFFLINE',          ARRAY['SUPER_ADMIN','OFFICE_ADMIN'], true),
  ('GATEWAY_BACK_ONLINE',      ARRAY['SUPER_ADMIN','OFFICE_ADMIN'], true),
  ('BEACON_OFFLINE',           ARRAY['SUPER_ADMIN','OFFICE_ADMIN'], true),
  ('FIRMWARE_UPDATE',          ARRAY['SUPER_ADMIN'],                true),
  ('GATEWAY_RESET_NEEDED',     ARRAY['SUPER_ADMIN'],                true),
  ('RESERVATION_CHECKIN_MISSED', ARRAY['OFFICE_ADMIN','STAFF'],     false),
  ('SYSTEM_ANNOUNCEMENT',      ARRAY['SUPER_ADMIN','OFFICE_ADMIN','STAFF','END_USER'], true);

-- Instancje powiadomień per user
CREATE TABLE "InAppNotification" (
  "id"             TEXT      NOT NULL DEFAULT gen_random_uuid(),
  "userId"         TEXT      NOT NULL,
  "organizationId" TEXT,
  "type"           "InAppNotifType" NOT NULL,
  "title"          TEXT      NOT NULL,
  "body"           TEXT      NOT NULL,
  "meta"           TEXT,
  "actionUrl"      TEXT,
  "actionLabel"    TEXT,
  "read"           BOOLEAN   NOT NULL DEFAULT false,
  "readAt"         TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InAppNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InAppNotification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "InAppNotification_userId_read_createdAt_idx"
  ON "InAppNotification"("userId", "read", "createdAt");
CREATE INDEX "InAppNotification_organizationId_type_createdAt_idx"
  ON "InAppNotification"("organizationId", "type", "createdAt");
