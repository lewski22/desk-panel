-- Migration: visitor_management (Sprint J)

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
  CONSTRAINT "Visitor_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "Visitor_qrToken_key"  UNIQUE ("qrToken"),
  CONSTRAINT "Visitor_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Visitor_hostUserId_fkey"
    FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON UPDATE CASCADE
);

CREATE INDEX "Visitor_locationId_visitDate_idx" ON "Visitor"("locationId", "visitDate");
CREATE INDEX "Visitor_hostUserId_idx"           ON "Visitor"("hostUserId");
