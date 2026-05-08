ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "passwordChangedAt"  TIMESTAMP(3);

ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "passwordExpiryDays"       INTEGER,
  ADD COLUMN IF NOT EXISTS "passwordMinLength"        INTEGER,
  ADD COLUMN IF NOT EXISTS "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "passwordRequireNumbers"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "passwordRequireSpecial"   BOOLEAN NOT NULL DEFAULT false;
