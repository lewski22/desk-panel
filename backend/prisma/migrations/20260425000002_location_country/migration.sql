-- FEATURE P4-B3: add country column to Location for holiday-aware workday counting
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "country" TEXT;
