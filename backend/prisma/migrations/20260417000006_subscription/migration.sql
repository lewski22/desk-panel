-- Migration: subscription (Sprint B)
-- Dodaje pola billing/limitów do Organization i tabelę SubscriptionEvent

-- Nowe pola Organization — limity i billing
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "limitDesks"     INTEGER,
  ADD COLUMN IF NOT EXISTS "limitUsers"     INTEGER,
  ADD COLUMN IF NOT EXISTS "limitGateways"  INTEGER,
  ADD COLUMN IF NOT EXISTS "limitLocations" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingEmail"   TEXT,
  ADD COLUMN IF NOT EXISTS "mrr"            INTEGER,
  ADD COLUMN IF NOT EXISTS "nextInvoiceAt"  TIMESTAMP(3);

-- Historia zmian planu
CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT         NOT NULL,
  "type"           TEXT         NOT NULL,
  "previousPlan"   TEXT,
  "newPlan"        TEXT,
  "changedBy"      TEXT,
  "note"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionEvent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubscriptionEvent_organizationId_createdAt_idx"
  ON "SubscriptionEvent"("organizationId", "createdAt" DESC);

-- Nowe wartości InAppNotifType dla powiadomień subskrypcji
-- Używamy DO block żeby uniknąć błędu gdy wartość już istnieje
DO $$ BEGIN ALTER TYPE "InAppNotifType" ADD VALUE 'SUBSCRIPTION_EXPIRING'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "InAppNotifType" ADD VALUE 'SUBSCRIPTION_EXPIRED';  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "InAppNotifType" ADD VALUE 'TRIAL_EXPIRING';        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE "InAppNotifType" ADD VALUE 'LIMIT_WARNING';         EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Domyślne reguły dla nowych typów powiadomień
INSERT INTO "NotificationRule" ("type", "targetRoles", "enabled")
VALUES
  ('SUBSCRIPTION_EXPIRING', ARRAY['SUPER_ADMIN'], true),
  ('SUBSCRIPTION_EXPIRED',  ARRAY['SUPER_ADMIN'], true),
  ('TRIAL_EXPIRING',        ARRAY['SUPER_ADMIN'], true),
  ('LIMIT_WARNING',         ARRAY['SUPER_ADMIN'], true)
ON CONFLICT ("type") DO NOTHING;
