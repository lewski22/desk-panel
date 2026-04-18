-- Migration: add_graph_sync
-- File: prisma/migrations/20260418000004_add_graph_sync/migration.sql
--
-- Modele potrzebne do Microsoft Graph Sync (M4):
--   GraphToken       — tokeny OAuth2 per user, szyfrowane AES-256-GCM
--   GraphSubscription — subskrypcje webhook Microsoft Graph per user
--   Reservation.graphEventId — ID eventu w kalendarzu Outlook

-- ─── GraphToken ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GraphToken" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "userId"         TEXT         NOT NULL,
  "organizationId" TEXT         NOT NULL,
  -- AES-256-GCM (INTEGRATION_ENCRYPTION_KEY)
  "accessTokenEnc"  TEXT        NOT NULL,
  "refreshTokenEnc" TEXT        NOT NULL,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "scope"          TEXT         NOT NULL DEFAULT 'Calendars.ReadWrite offline_access User.Read',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GraphToken_pkey"   PRIMARY KEY ("id"),
  CONSTRAINT "GraphToken_userId_key" UNIQUE ("userId"),

  CONSTRAINT "GraphToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GraphToken_organizationId_idx" ON "GraphToken"("organizationId");
CREATE INDEX IF NOT EXISTS "GraphToken_expiresAt_idx"      ON "GraphToken"("expiresAt");

-- ─── GraphSubscription ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "GraphSubscription" (
  "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "userId"         TEXT         NOT NULL,
  "subscriptionId" TEXT         NOT NULL,  -- Microsoft's subscription ID
  "calendarId"     TEXT         NOT NULL DEFAULT 'primary',
  "expiresAt"      TIMESTAMP(3) NOT NULL,  -- max 3 dni dla kalendarza
  "clientState"    TEXT         NOT NULL,  -- secret do walidacji webhooków
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GraphSubscription_pkey"           PRIMARY KEY ("id"),
  CONSTRAINT "GraphSubscription_subscriptionId_key" UNIQUE ("subscriptionId"),

  CONSTRAINT "GraphSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GraphSubscription_userId_idx"    ON "GraphSubscription"("userId");
CREATE INDEX IF NOT EXISTS "GraphSubscription_expiresAt_idx" ON "GraphSubscription"("expiresAt");

-- ─── Reservation.graphEventId ─────────────────────────────────────────────────
-- ID eventu w kalendarzu Outlook — potrzebne do update/delete
ALTER TABLE "Reservation"
  ADD COLUMN IF NOT EXISTS "graphEventId" TEXT;
