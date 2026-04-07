-- Reserti Desk Management — Baseline Migration
-- Generated from schema.prisma (Prisma 5, PostgreSQL 15)
-- This is the initial migration representing the current production state.
-- Safe to run on existing DB (IF NOT EXISTS guards) or fresh DB.

-- ─── Enums ──────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM (
  'OWNER',
  'SUPER_ADMIN',
  'OFFICE_ADMIN',
  'STAFF',
  'END_USER'
);

CREATE TYPE "DeskStatus" AS ENUM (
  'ACTIVE',
  'INACTIVE',
  'MAINTENANCE'
);

CREATE TYPE "ReservationStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'COMPLETED'
);

CREATE TYPE "CheckinMethod" AS ENUM (
  'NFC',
  'QR',
  'MANUAL'
);

CREATE TYPE "EventType" AS ENUM (
  'DESK_CREATED',
  'DESK_UPDATED',
  'DESK_STATUS_CHANGED',
  'RESERVATION_CREATED',
  'RESERVATION_CANCELLED',
  'RESERVATION_EXPIRED',
  'CHECKIN_NFC',
  'CHECKIN_QR',
  'CHECKIN_MANUAL',
  'CHECKOUT',
  'DEVICE_ONLINE',
  'DEVICE_OFFLINE',
  'DEVICE_PROVISIONED',
  'GATEWAY_ONLINE',
  'GATEWAY_OFFLINE',
  'UNAUTHORIZED_SCAN',
  'USER_CREATED',
  'USER_UPDATED',
  'OWNER_IMPERSONATION'
);

-- ─── Organization ────────────────────────────────────────────

CREATE TABLE "Organization" (
  "id"              TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "plan"            TEXT NOT NULL DEFAULT 'starter',
  "planExpiresAt"   TIMESTAMP(3),
  "trialEndsAt"     TIMESTAMP(3),
  "notes"           TEXT,
  "contactEmail"    TEXT,
  "createdBy"       TEXT,
  "azureTenantId"   TEXT,
  "azureEnabled"    BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- ─── Location ────────────────────────────────────────────────

CREATE TABLE "Location" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "address"        TEXT,
  "city"           TEXT,
  "timezone"       TEXT NOT NULL DEFAULT 'Europe/Warsaw',
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "openTime"       TEXT NOT NULL DEFAULT '08:00',
  "closeTime"      TEXT NOT NULL DEFAULT '17:00',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- ─── Gateway ─────────────────────────────────────────────────

CREATE TABLE "Gateway" (
  "id"          TEXT NOT NULL,
  "locationId"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "secretHash"  TEXT NOT NULL,
  "ipAddress"   TEXT,
  "lastSeen"    TIMESTAMP(3),
  "isOnline"    BOOLEAN NOT NULL DEFAULT false,
  "version"     TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Gateway_pkey" PRIMARY KEY ("id")
);

-- ─── GatewaySetupToken ───────────────────────────────────────

CREATE TABLE "GatewaySetupToken" (
  "id"         TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "gatewayId"  TEXT,
  "createdBy"  TEXT NOT NULL,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "usedAt"     TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatewaySetupToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatewaySetupToken_token_key" ON "GatewaySetupToken"("token");
CREATE INDEX "GatewaySetupToken_locationId_idx" ON "GatewaySetupToken"("locationId");

-- ─── Desk ────────────────────────────────────────────────────

CREATE TABLE "Desk" (
  "id"         TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "floor"      TEXT,
  "zone"       TEXT,
  "status"     "DeskStatus" NOT NULL DEFAULT 'ACTIVE',
  "qrToken"    TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Desk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Desk_qrToken_key" ON "Desk"("qrToken");
CREATE UNIQUE INDEX "Desk_locationId_code_key" ON "Desk"("locationId", "code");

-- ─── Device ──────────────────────────────────────────────────

CREATE TABLE "Device" (
  "id"               TEXT NOT NULL,
  "deskId"           TEXT,
  "gatewayId"        TEXT,
  "hardwareId"       TEXT NOT NULL,
  "mqttUsername"     TEXT NOT NULL,
  "mqttPasswordHash" TEXT NOT NULL,
  "firmwareVersion"  TEXT,
  "lastSeen"         TIMESTAMP(3),
  "isOnline"         BOOLEAN NOT NULL DEFAULT false,
  "rssi"             INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Device_deskId_key"       ON "Device"("deskId");
CREATE UNIQUE INDEX "Device_hardwareId_key"   ON "Device"("hardwareId");
CREATE UNIQUE INDEX "Device_mqttUsername_key" ON "Device"("mqttUsername");

-- ─── User ────────────────────────────────────────────────────

CREATE TABLE "User" (
  "id"                  TEXT NOT NULL,
  "organizationId"      TEXT,
  "email"               TEXT NOT NULL,
  "passwordHash"        TEXT NOT NULL,
  "firstName"           TEXT,
  "lastName"            TEXT,
  "role"                "UserRole" NOT NULL DEFAULT 'END_USER',
  "cardUid"             TEXT,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "azureObjectId"       TEXT,
  "azureTenantId"       TEXT,
  "deletedAt"           TIMESTAMP(3),
  "scheduledDeleteAt"   TIMESTAMP(3),
  "retentionDays"       INTEGER,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key"         ON "User"("email");
CREATE UNIQUE INDEX "User_cardUid_key"       ON "User"("cardUid");
CREATE UNIQUE INDEX "User_azureObjectId_key" ON "User"("azureObjectId");

-- ─── User ↔ Location (many-to-many) ─────────────────────────

CREATE TABLE "_LocationUsers" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_LocationUsers_AB_unique" ON "_LocationUsers"("A", "B");
CREATE INDEX "_LocationUsers_B_index"          ON "_LocationUsers"("B");

-- ─── RefreshToken ─────────────────────────────────────────────

CREATE TABLE "RefreshToken" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- ─── Reservation ─────────────────────────────────────────────

CREATE TABLE "Reservation" (
  "id"               TEXT NOT NULL,
  "deskId"           TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "date"             DATE NOT NULL,
  "startTime"        TIMESTAMP(3) NOT NULL,
  "endTime"          TIMESTAMP(3) NOT NULL,
  "status"           "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "qrToken"          TEXT NOT NULL,
  "notes"            TEXT,
  "checkedInAt"      TIMESTAMP(3),
  "checkedInMethod"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Reservation_qrToken_key" ON "Reservation"("qrToken");

-- ─── Checkin ─────────────────────────────────────────────────

CREATE TABLE "Checkin" (
  "id"            TEXT NOT NULL,
  "reservationId" TEXT,
  "deskId"        TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  "method"        "CheckinMethod" NOT NULL,
  "cardUid"       TEXT,
  "checkedInAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedOutAt"  TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Checkin_reservationId_key" ON "Checkin"("reservationId");

-- ─── Event ───────────────────────────────────────────────────

CREATE TABLE "Event" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT,
  "type"           "EventType" NOT NULL,
  "entityType"     TEXT,
  "entityId"       TEXT,
  "actorId"        TEXT,
  "gatewayId"      TEXT,
  "deviceId"       TEXT,
  "deskId"         TEXT,
  "reservationId"  TEXT,
  "payload"        JSONB,
  "ts"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_type_idx"     ON "Event"("type");
CREATE INDEX "Event_entityId_idx" ON "Event"("entityId");
CREATE INDEX "Event_actorId_idx"  ON "Event"("actorId");
CREATE INDEX "Event_ts_idx"       ON "Event"("ts");

-- ─── Foreign Keys ────────────────────────────────────────────

ALTER TABLE "Location"
  ADD CONSTRAINT "Location_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Gateway"
  ADD CONSTRAINT "Gateway_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GatewaySetupToken"
  ADD CONSTRAINT "GatewaySetupToken_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GatewaySetupToken"
  ADD CONSTRAINT "GatewaySetupToken_gatewayId_fkey"
  FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Desk"
  ADD CONSTRAINT "Desk_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "Location"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Device"
  ADD CONSTRAINT "Device_deskId_fkey"
  FOREIGN KEY ("deskId") REFERENCES "Desk"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Device"
  ADD CONSTRAINT "Device_gatewayId_fkey"
  FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
  ADD CONSTRAINT "User_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "_LocationUsers"
  ADD CONSTRAINT "_LocationUsers_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Location"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_LocationUsers"
  ADD CONSTRAINT "_LocationUsers_B_fkey"
  FOREIGN KEY ("B") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_deskId_fkey"
  FOREIGN KEY ("deskId") REFERENCES "Desk"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Checkin"
  ADD CONSTRAINT "Checkin_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Checkin"
  ADD CONSTRAINT "Checkin_deskId_fkey"
  FOREIGN KEY ("deskId") REFERENCES "Desk"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Checkin"
  ADD CONSTRAINT "Checkin_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_gatewayId_fkey"
  FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_deskId_fkey"
  FOREIGN KEY ("deskId") REFERENCES "Desk"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
