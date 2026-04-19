-- Convert InAppNotification.type and NotificationRule.type
-- from PostgreSQL native ENUM "InAppNotifType" to plain TEXT,
-- matching the Prisma schema which declares both as String.
-- Fixes Prisma P2032 error on findMany when enum values like
-- SUBSCRIPTION_EXPIRING are present.

ALTER TABLE "InAppNotification" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE "NotificationRule"  ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

DROP TYPE IF EXISTS "InAppNotifType";
