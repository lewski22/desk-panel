-- ============================================================
-- Skonsolidowana migracja Sprint A–B (Reserti v0.12.0)
-- Wszystkie zmiany schematu dodane w sesjach deweloperskich:
--   Sprint D  — Floor Plan Editor
--   Sprint E  — Resources (Sale/Parking) + Bookings
--   Sprint E  — enabledModules (Owner module management)
--   Sprint G  — Recurring reservations + PushSubscription
--   Sprint H  — kioskPin
--   Sprint J  — Visitor Management
--   Sprint B  — SubscriptionEvent + billing fields
--   Sprint B  — nowe typy InAppNotifType
--
-- BEZPIECZNA: wszystkie DDL używają IF NOT EXISTS / DO blocks.
-- IDEMPOTENTNA: wielokrotne uruchomienie nie spowoduje błędów.
-- ============================================================

-- This migration requires no transaction.
-- (potrzebne dla ALTER TYPE ADD VALUE i ALTER TYPE RENAME)

-- ─── Sprint D: Floor Plan Editor ─────────────────────────────

ALTER TABLE "Desk"
  ADD COLUMN IF NOT EXISTS "posX"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "posY"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rotation" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "width"    DOUBLE PRECISION DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "height"   DOUBLE PRECISION DEFAULT 1;

ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "floorPlanUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "floorPlanW"   INTEGER,
  ADD COLUMN IF NOT EXISTS "floorPlanH"   INTEGER,
  ADD COLUMN IF NOT EXISTS "gridSize"     INTEGER DEFAULT 40;

-- ─── Sprint E: Resources (Sale / Parking / Equipment) ────────

DO $$ BEGIN
  CREATE TYPE "ResourceType" AS ENUM ('ROOM', 'PARKING', 'EQUIPMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Resource" (
  "id"          TEXT           NOT NULL DEFAULT gen_random_uuid(),
  "locationId"  TEXT           NOT NULL,
  "type"        "ResourceType" NOT NULL DEFAULT 'ROOM',
  "name"        TEXT           NOT NULL,
  "code"        TEXT           NOT NULL,
  "description" TEXT,
  "capacity"    INTEGER,
  "amenities"   TEXT[]         NOT NULL DEFAULT ARRAY[]::TEXT[],
  "vehicleType" TEXT,
  "floor"       TEXT,
  "zone"        TEXT,
  "posX"        DOUBLE PRECISION,
  "posY"        DOUBLE PRECISION,
  "rotation"    INTEGER        NOT NULL DEFAULT 0,
  "status"      TEXT           NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Resource_locationId_code_key" UNIQUE ("locationId", "code"),
  CONSTRAINT "Resource_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Booking" (
  "id"         TEXT           NOT NULL DEFAULT gen_random_uuid(),
  "resourceId" TEXT           NOT NULL,
  "userId"     TEXT           NOT NULL,
  "date"       DATE           NOT NULL,
  "startTime"  TIMESTAMP(3)   NOT NULL,
  "endTime"    TIMESTAMP(3)   NOT NULL,
  "status"     "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Booking_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Booking_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Resource_locationId_type_idx" ON "Resource"("locationId", "type");
CREATE INDEX IF NOT EXISTS "Booking_resourceId_date_idx"  ON "Booking"("resourceId", "date");
CREATE INDEX IF NOT EXISTS "Booking_userId_date_idx"       ON "Booking"("userId", "date");

-- ─── Sprint E: Owner module management ───────────────────────

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "enabledModules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ─── Sprint G: Cykliczne rezerwacje ──────────────────────────

ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "recurrenceRule"    TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "Reservation_recurrenceGroupId_idx"
  ON "Reservation"("recurrenceGroupId");

-- ─── Sprint G: PWA Push Subscriptions ────────────────────────

CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "userId"    TEXT         NOT NULL,
  "endpoint"  TEXT         NOT NULL,
  "p256dh"    TEXT         NOT NULL,
  "auth"      TEXT         NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "PushSubscription_endpoint_key" UNIQUE ("endpoint"),
  CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- ─── Sprint H: Kiosk mode PIN ─────────────────────────────────

ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "kioskPin" TEXT;

-- ─── Sprint J: Visitor Management ────────────────────────────

CREATE TABLE IF NOT EXISTS "Visitor" (
  "id"           TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "locationId"   TEXT         NOT NULL,
  "hostUserId"   TEXT         NOT NULL,
  "firstName"    TEXT         NOT NULL,
  "lastName"     TEXT         NOT NULL,
  "email"        TEXT         NOT NULL,
  "company"      TEXT,
  "visitDate"    TIMESTAMP(3) NOT NULL,
  "purpose"      TEXT,
  "status"       TEXT         NOT NULL DEFAULT 'INVITED',
  "qrToken"      TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "checkedInAt"  TIMESTAMP(3),
  "checkedOutAt" TIMESTAMP(3),
  "badgePrinted" BOOLEAN      NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Visitor_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "Visitor_qrToken_key" UNIQUE ("qrToken"),
  CONSTRAINT "Visitor_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Visitor_hostUserId_fkey"
    FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Visitor_locationId_visitDate_idx" ON "Visitor"("locationId", "visitDate");
CREATE INDEX IF NOT EXISTS "Visitor_hostUserId_idx"           ON "Visitor"("hostUserId");

-- ─── Sprint B: Billing fields + SubscriptionEvent ────────────

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "limitDesks"     INTEGER,
  ADD COLUMN IF NOT EXISTS "limitUsers"     INTEGER,
  ADD COLUMN IF NOT EXISTS "limitGateways"  INTEGER,
  ADD COLUMN IF NOT EXISTS "limitLocations" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingEmail"   TEXT,
  ADD COLUMN IF NOT EXISTS "mrr"            INTEGER,
  ADD COLUMN IF NOT EXISTS "nextInvoiceAt"  TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT         NOT NULL,
  "type"           TEXT         NOT NULL,
  "previousPlan"   TEXT,
  "newPlan"        TEXT,
  "changedBy"      TEXT,
  "note"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubscriptionEvent_organizationId_createdAt_idx"
  ON "SubscriptionEvent"("organizationId", "createdAt" DESC);

-- ─── Sprint B: Nowe typy InAppNotifType ──────────────────────
-- CREATE TYPE with all values first, then INSERT default rules

DO $$ BEGIN
  CREATE TYPE "InAppNotifType" AS ENUM (
    'GATEWAY_OFFLINE',
    'GATEWAY_BACK_ONLINE',
    'BEACON_OFFLINE',
    'FIRMWARE_UPDATE',
    'GATEWAY_RESET_NEEDED',
    'RESERVATION_CHECKIN_MISSED',
    'SYSTEM_ANNOUNCEMENT',
    'GATEWAY_KEY_ROTATION_FAILED',
    'SUBSCRIPTION_EXPIRING',
    'SUBSCRIPTION_EXPIRED',
    'TRIAL_EXPIRING',
    'LIMIT_WARNING'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Sprint B: NotificationRule table ─────────────────────────

CREATE TABLE IF NOT EXISTS "NotificationRule" (
  "id"          TEXT           NOT NULL DEFAULT gen_random_uuid(),
  "type"        "InAppNotifType" NOT NULL UNIQUE,
  "targetRoles" TEXT[]         NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabled"     BOOLEAN        NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationRule_type_key" UNIQUE ("type")
);

-- Domyślne reguły powiadomień
INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES
  ('SUBSCRIPTION_EXPIRING', ARRAY['SUPER_ADMIN'], true),
  ('SUBSCRIPTION_EXPIRED',  ARRAY['SUPER_ADMIN'], true),
  ('TRIAL_EXPIRING',        ARRAY['SUPER_ADMIN'], true),
  ('LIMIT_WARNING',         ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;