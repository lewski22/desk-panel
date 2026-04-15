-- Migration: notifications
-- Adds NotificationType enum, NotificationSetting and NotificationLog tables

CREATE TYPE "NotificationType" AS ENUM (
  'FIRMWARE_UPDATE_AVAILABLE',
  'GATEWAY_OFFLINE',
  'BEACON_OFFLINE',
  'RESERVATION_CONFIRMED',
  'RESERVATION_REMINDER',
  'RESERVATION_CANCELLED',
  'CHECKIN_MISSED',
  'DAILY_REPORT'
);

CREATE TABLE "NotificationSetting" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "type"           "NotificationType" NOT NULL,
  "enabled"        BOOLEAN NOT NULL DEFAULT false,
  "recipients"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "thresholdMin"   INTEGER DEFAULT 10,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationSetting_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationSetting_organizationId_type_key" UNIQUE ("organizationId", "type"),
  CONSTRAINT "NotificationSetting_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE TABLE "NotificationLog" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT,
  "type"           "NotificationType" NOT NULL,
  "subject"        TEXT NOT NULL,
  "recipients"     TEXT[] NOT NULL,
  "dedupeKey"      TEXT,
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "success"        BOOLEAN NOT NULL DEFAULT true,
  "errorMsg"       TEXT,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NotificationLog_organizationId_type_sentAt_idx"
  ON "NotificationLog"("organizationId", "type", "sentAt");
CREATE INDEX "NotificationLog_dedupeKey_sentAt_idx"
  ON "NotificationLog"("dedupeKey", "sentAt");
