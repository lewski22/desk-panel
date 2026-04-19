-- Convert InAppNotification.type and NotificationRule.type
-- from PostgreSQL native ENUM "InAppNotifType" to plain TEXT,
-- matching the Prisma schema which declares both as String.
-- Uses conditional checks so it's safe to run even if columns
-- are already TEXT or don't exist.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'NotificationRule'
      AND column_name = 'type'
      AND data_type = 'USER-DEFINED'
  ) THEN
    EXECUTE 'ALTER TABLE "NotificationRule" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'InAppNotification'
      AND column_name = 'type'
      AND data_type = 'USER-DEFINED'
  ) THEN
    EXECUTE 'ALTER TABLE "InAppNotification" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT';
  END IF;
END $$;

DROP TYPE IF EXISTS "InAppNotifType";
