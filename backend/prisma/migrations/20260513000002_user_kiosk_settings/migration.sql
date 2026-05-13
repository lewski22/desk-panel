-- Add kioskSettings JSON column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "kioskSettings" JSONB;
