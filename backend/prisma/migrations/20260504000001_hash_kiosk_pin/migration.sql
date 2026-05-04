-- Rename kioskPin → kioskPinHash and clear existing plaintext values.
-- Existing PINs cannot be rehashed without the original values, so they are
-- nulled out. Admins must reset kiosk PINs after this migration.
ALTER TABLE "Location" RENAME COLUMN "kioskPin" TO "kioskPinHash";
UPDATE "Location" SET "kioskPinHash" = NULL WHERE "kioskPinHash" IS NOT NULL;
