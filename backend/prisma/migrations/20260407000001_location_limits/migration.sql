-- AddLocationReservationLimits
-- Adds maxDaysAhead and maxHoursPerDay to Location model.
-- Safe defaults: 14 days ahead, 8 hours per reservation.

ALTER TABLE "Location" ADD COLUMN "maxDaysAhead"   INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "Location" ADD COLUMN "maxHoursPerDay" INTEGER NOT NULL DEFAULT 8;
