-- Migration: cascade_desk_delete
-- Adds ON DELETE CASCADE to Reservation and Checkin → Desk FK
-- so that deleting a Desk removes all its reservations and checkins.
-- Also adds auto-checkout for expired sessions (handled in app layer),
-- and closes any currently open stale checkins.

-- Step 1: Close all open checkins where the reservation has ended
UPDATE "Checkin"
SET "checkedOutAt" = NOW()
WHERE "checkedOutAt" IS NULL
  AND "reservationId" IS NOT NULL
  AND "reservationId" IN (
    SELECT id FROM "Reservation" WHERE "endTime" < NOW()
  );

-- Step 2: Close stale walk-in checkins older than 12 hours
UPDATE "Checkin"
SET "checkedOutAt" = NOW()
WHERE "checkedOutAt" IS NULL
  AND "reservationId" IS NULL
  AND "checkedInAt" < NOW() - INTERVAL '12 hours';

-- Step 3: Expire all reservations that ended but are still CONFIRMED/PENDING
UPDATE "Reservation"
SET status = 'EXPIRED'
WHERE status IN ('CONFIRMED', 'PENDING')
  AND "endTime" < NOW();

-- Step 4: Drop old FK and recreate with CASCADE for Reservation → Desk
ALTER TABLE "Reservation"
  DROP CONSTRAINT IF EXISTS "Reservation_deskId_fkey";

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_deskId_fkey"
    FOREIGN KEY ("deskId")
    REFERENCES "Desk"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Step 5: Drop old FK and recreate with CASCADE for Checkin → Desk
ALTER TABLE "Checkin"
  DROP CONSTRAINT IF EXISTS "Checkin_deskId_fkey";

ALTER TABLE "Checkin"
  ADD CONSTRAINT "Checkin_deskId_fkey"
    FOREIGN KEY ("deskId")
    REFERENCES "Desk"(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;
