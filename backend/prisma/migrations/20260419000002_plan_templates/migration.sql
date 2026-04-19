CREATE TABLE IF NOT EXISTS "PlanTemplate" (
  "plan"      TEXT         NOT NULL,
  "desks"     INTEGER,
  "users"     INTEGER,
  "gateways"  INTEGER,
  "locations" INTEGER,
  "ota"       BOOLEAN      NOT NULL DEFAULT false,
  "sso"       BOOLEAN      NOT NULL DEFAULT false,
  "smtp"      BOOLEAN      NOT NULL DEFAULT false,
  "api"       BOOLEAN      NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanTemplate_pkey" PRIMARY KEY ("plan")
);

-- Seed defaults matching PLAN_LIMITS
INSERT INTO "PlanTemplate" ("plan","desks","users","gateways","locations","ota","sso","smtp","api","updatedAt") VALUES
  ('starter',    10,   25,  1, 1, false, false, false, false, NOW()),
  ('trial',      10,   10,  1, 1, false, false, false, false, NOW()),
  ('pro',        50,  150,  3, 5, true,  true,  true,  false, NOW()),
  ('enterprise', NULL, NULL, NULL, NULL, true, true, true, true, NOW())
ON CONFLICT ("plan") DO NOTHING;
