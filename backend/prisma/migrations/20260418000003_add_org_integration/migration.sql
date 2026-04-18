-- Migration: add_org_integration
-- File: prisma/migrations/20260418000003_add_org_integration/migration.sql
--
-- Dodaje zunifikowany model integracji per organizacja.
-- Zastępuje (stopniowo) rozproszone pola w Organization (azureTenantId itp.).
-- Backward-compat: Organization.azureTenantId pozostaje do czasu pełnej migracji.

DO $$ BEGIN
  CREATE TYPE "IntegrationProvider" AS ENUM (
    'AZURE_ENTRA',
    'SLACK',
    'GOOGLE_WORKSPACE',
    'MICROSOFT_TEAMS',
    'WEBHOOK_CUSTOM'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OrgIntegration" (
  "id"               TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "organizationId"   TEXT         NOT NULL,
  "provider"         "IntegrationProvider" NOT NULL,
  "isEnabled"        BOOLEAN      NOT NULL DEFAULT false,
  -- AES-256-GCM (INTEGRATION_ENCRYPTION_KEY) — plaintext nigdy w DB
  "configEncrypted"  TEXT,
  -- Publiczne metadane (nie szyfrowane — safe to log/display)
  "displayName"      TEXT,
  "tenantHint"       TEXT,         -- Azure: tenantId; Slack: workspace name
  "lastTestedAt"     TIMESTAMP(3),
  "lastTestOk"       BOOLEAN,
  "lastTestError"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrgIntegration_pkey" PRIMARY KEY ("id"),

  CONSTRAINT "OrgIntegration_org_provider_key"
    UNIQUE ("organizationId", "provider"),

  CONSTRAINT "OrgIntegration_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrgIntegration_organizationId_idx"
  ON "OrgIntegration"("organizationId");

-- Migracja danych: skopiuj istniejące Azure config z Organization
-- ON CONFLICT DO NOTHING = idempotentne, bezpieczne do wielokrotnego uruchomienia
INSERT INTO "OrgIntegration" ("id", "organizationId", "provider", "isEnabled", "tenantHint")
SELECT
  gen_random_uuid(),
  "id",
  'AZURE_ENTRA'::"IntegrationProvider",
  "azureEnabled",
  "azureTenantId"
FROM "Organization"
WHERE "azureTenantId" IS NOT NULL
ON CONFLICT ("organizationId", "provider") DO NOTHING;
