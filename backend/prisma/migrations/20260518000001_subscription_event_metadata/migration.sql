-- Add metadata JSON field to SubscriptionEvent for invoice tracking, IP logging, etc.
ALTER TABLE "SubscriptionEvent"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;
