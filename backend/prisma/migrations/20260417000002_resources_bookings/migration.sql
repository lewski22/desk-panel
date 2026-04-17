-- Migration: resources_bookings (Sprint E2)
-- Sale konferencyjne, parkingi, equipment — nowy model Resource + Booking

CREATE TYPE "ResourceType"  AS ENUM ('ROOM', 'PARKING', 'EQUIPMENT');
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED');

CREATE TABLE "Resource" (
  "id"          TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "locationId"  TEXT         NOT NULL,
  "type"        "ResourceType" NOT NULL DEFAULT 'ROOM',
  "name"        TEXT         NOT NULL,
  "code"        TEXT         NOT NULL,
  "description" TEXT,
  "capacity"    INTEGER,
  "amenities"   TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "vehicleType" TEXT,
  "floor"       TEXT,
  "zone"        TEXT,
  "posX"        DOUBLE PRECISION,
  "posY"        DOUBLE PRECISION,
  "rotation"    INTEGER      NOT NULL DEFAULT 0,
  "status"      TEXT         NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Resource_locationId_code_key" UNIQUE ("locationId", "code"),
  CONSTRAINT "Resource_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Booking" (
  "id"         TEXT            NOT NULL DEFAULT gen_random_uuid(),
  "resourceId" TEXT            NOT NULL,
  "userId"     TEXT            NOT NULL,
  "date"       DATE            NOT NULL,
  "startTime"  TIMESTAMP(3)    NOT NULL,
  "endTime"    TIMESTAMP(3)    NOT NULL,
  "status"     "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
  "notes"      TEXT,
  "createdAt"  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Booking_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Booking_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON UPDATE CASCADE
);

CREATE INDEX "Resource_locationId_type_idx" ON "Resource"("locationId", "type");
CREATE INDEX "Booking_resourceId_date_idx"  ON "Booking"("resourceId", "date");
CREATE INDEX "Booking_userId_date_idx"       ON "Booking"("userId", "date");
