-- Add emailVerificationToken to User for invitation-flow email verification
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationToken" TEXT;
