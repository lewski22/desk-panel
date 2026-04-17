-- Migration: recurring_push_kiosk (Sprint G1 + G2 + H3)

-- G1: Cykliczne rezerwacje — pola na modelu Reservation
ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "recurrenceRule"    TEXT,
  ADD COLUMN IF NOT EXISTS "recurrenceGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "Reservation_recurrenceGroupId_idx"
  ON "Reservation"("recurrenceGroupId");

-- H3: Kiosk mode PIN per lokalizacja
ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "kioskPin" TEXT;

-- G2: PWA Push Subscriptions
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id"        TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "userId"    TEXT         NOT NULL,
  "endpoint"  TEXT         NOT NULL,
  "p256dh"    TEXT         NOT NULL,
  "auth"      TEXT         NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushSubscription_pkey"     PRIMARY KEY ("id"),
  CONSTRAINT "PushSubscription_endpoint_key" UNIQUE ("endpoint"),
  CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx"
  ON "PushSubscription"("userId");
