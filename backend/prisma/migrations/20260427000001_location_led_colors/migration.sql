-- AlterTable
ALTER TABLE "Location" ADD COLUMN "ledBrightness"         INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Location" ADD COLUMN "ledColorFree"          TEXT NOT NULL DEFAULT '#00C800';
ALTER TABLE "Location" ADD COLUMN "ledColorReserved"      TEXT NOT NULL DEFAULT '#0050DC';
ALTER TABLE "Location" ADD COLUMN "ledColorOccupied"      TEXT NOT NULL DEFAULT '#DC0000';
ALTER TABLE "Location" ADD COLUMN "ledColorGuestReserved" TEXT NOT NULL DEFAULT '#C8A000';
