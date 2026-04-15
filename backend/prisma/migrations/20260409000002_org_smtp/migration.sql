-- Migration: org_smtp
-- Adds per-organization SMTP configuration table

CREATE TABLE "OrganizationSmtpConfig" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" TEXT NOT NULL,
  "host"           TEXT NOT NULL,
  "port"           INTEGER NOT NULL DEFAULT 587,
  "secure"         BOOLEAN NOT NULL DEFAULT false,
  "user"           TEXT NOT NULL,
  "passwordEnc"    TEXT NOT NULL,
  "fromName"       TEXT NOT NULL DEFAULT 'Reserti',
  "fromEmail"      TEXT NOT NULL,
  "isVerified"     BOOLEAN NOT NULL DEFAULT false,
  "lastTestedAt"   TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationSmtpConfig_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationSmtpConfig_organizationId_key" UNIQUE ("organizationId"),
  CONSTRAINT "OrganizationSmtpConfig_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);
