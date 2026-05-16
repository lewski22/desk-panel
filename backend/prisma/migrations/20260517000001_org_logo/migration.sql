-- AlterTable: add logo and whitelabel fields to Organization
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "logoUrl"           TEXT,
  ADD COLUMN IF NOT EXISTS "logoBgColor"       TEXT,
  ADD COLUMN IF NOT EXISTS "whitelabelEnabled" BOOLEAN NOT NULL DEFAULT false;
