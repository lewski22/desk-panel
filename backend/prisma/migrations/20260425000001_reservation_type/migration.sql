-- FEATURE P4-B1: add reservationType column (STANDARD | GUEST | TEAM)
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "reservationType" TEXT NOT NULL DEFAULT 'STANDARD';
