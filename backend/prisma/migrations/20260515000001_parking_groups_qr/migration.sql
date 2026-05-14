-- ── Resource ──────────────────────────────────────────────────
ALTER TABLE "Resource"
  ADD COLUMN IF NOT EXISTS "qrToken"          TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  ADD COLUMN IF NOT EXISTS "qrCheckinEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "notes"            TEXT,
  ADD COLUMN IF NOT EXISTS "floorPlanUrl"     TEXT,
  ADD COLUMN IF NOT EXISTS "floorPlanKey"     TEXT,
  ADD COLUMN IF NOT EXISTS "floorPlanW"       INTEGER,
  ADD COLUMN IF NOT EXISTS "floorPlanH"       INTEGER,
  ADD COLUMN IF NOT EXISTS "gridSize"         INTEGER DEFAULT 40;

-- accessMode: add as TEXT if not present; convert from enum if it was added by a prior migration
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Resource' AND column_name = 'accessMode'
  ) THEN
    ALTER TABLE "Resource" ADD COLUMN "accessMode" TEXT NOT NULL DEFAULT 'PUBLIC';
  ELSE
    -- convert enum → TEXT in case an earlier migration created it as ResourceAccessMode
    ALTER TABLE "Resource" ALTER COLUMN "accessMode" TYPE TEXT USING "accessMode"::TEXT;
    ALTER TABLE "Resource" ALTER COLUMN "accessMode" SET DEFAULT 'PUBLIC';
    ALTER TABLE "Resource" ALTER COLUMN "accessMode" SET NOT NULL;
  END IF;
END $$;

-- Drop ResourceAccessMode enum if it exists (no longer used)
DROP TYPE IF EXISTS "ResourceAccessMode";

-- Unique constraint: replace locationId+code with locationId+type+code
ALTER TABLE "Resource" DROP CONSTRAINT IF EXISTS "Resource_locationId_code_key";
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Resource_locationId_type_code_key'
  ) THEN
    ALTER TABLE "Resource" ADD CONSTRAINT "Resource_locationId_type_code_key"
      UNIQUE ("locationId", "type", "code");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Resource_locationId_type_idx" ON "Resource"("locationId", "type");

-- ── Booking ───────────────────────────────────────────────────
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checkedInBy" TEXT;

CREATE INDEX IF NOT EXISTS "Booking_resourceId_date_idx"    ON "Booking"("resourceId", "date");
CREATE INDEX IF NOT EXISTS "Booking_status_checkedInAt_idx" ON "Booking"("status", "checkedInAt");

-- ── Location ──────────────────────────────────────────────────
ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "maxParkingDaysPerWeek" INTEGER,
  ADD COLUMN IF NOT EXISTS "checkinGraceMinutes"   INTEGER NOT NULL DEFAULT 15;

-- ── ParkingGroup ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ParkingGroup" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "organizationId" TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "description"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParkingGroup_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingGroup_organizationId_fkey') THEN
    ALTER TABLE "ParkingGroup"
      ADD CONSTRAINT "ParkingGroup_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ParkingGroup_organizationId_idx" ON "ParkingGroup"("organizationId");

-- ── ParkingGroupUser ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ParkingGroupUser" (
  "groupId" TEXT NOT NULL,
  "userId"  TEXT NOT NULL,
  "addedBy" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParkingGroupUser_pkey" PRIMARY KEY ("groupId", "userId")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingGroupUser_groupId_fkey') THEN
    ALTER TABLE "ParkingGroupUser"
      ADD CONSTRAINT "ParkingGroupUser_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ParkingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingGroupUser_userId_fkey') THEN
    ALTER TABLE "ParkingGroupUser"
      ADD CONSTRAINT "ParkingGroupUser_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ParkingGroupUser_userId_idx" ON "ParkingGroupUser"("userId");

-- Drop orphaned constraints from a previous migration attempt (adder/assigner relations)
ALTER TABLE "ParkingGroupUser" DROP CONSTRAINT IF EXISTS "ParkingGroupUser_addedBy_fkey";
DROP INDEX IF EXISTS "ParkingGroupUser_addedBy_idx";

-- ── ParkingGroupResource ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ParkingGroupResource" (
  "groupId"    TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParkingGroupResource_pkey" PRIMARY KEY ("groupId", "resourceId")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingGroupResource_groupId_fkey') THEN
    ALTER TABLE "ParkingGroupResource"
      ADD CONSTRAINT "ParkingGroupResource_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ParkingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingGroupResource_resourceId_fkey') THEN
    ALTER TABLE "ParkingGroupResource"
      ADD CONSTRAINT "ParkingGroupResource_resourceId_fkey"
      FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ParkingGroupResource_resourceId_idx" ON "ParkingGroupResource"("resourceId");

-- Drop orphaned assigner constraint from a previous migration attempt
ALTER TABLE "ParkingGroupResource" DROP CONSTRAINT IF EXISTS "ParkingGroupResource_assignedBy_fkey";
DROP INDEX IF EXISTS "ParkingGroupResource_assignedBy_idx";

-- ── ParkingBlock ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ParkingBlock" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "resourceId" TEXT,
  "groupId"    TEXT,
  "reason"     TEXT,
  "startTime"  TIMESTAMP(3) NOT NULL,
  "endTime"    TIMESTAMP(3) NOT NULL,
  "createdBy"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParkingBlock_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingBlock_resourceId_fkey') THEN
    ALTER TABLE "ParkingBlock"
      ADD CONSTRAINT "ParkingBlock_resourceId_fkey"
      FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingBlock_groupId_fkey') THEN
    ALTER TABLE "ParkingBlock"
      ADD CONSTRAINT "ParkingBlock_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ParkingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParkingBlock_createdBy_fkey') THEN
    ALTER TABLE "ParkingBlock"
      ADD CONSTRAINT "ParkingBlock_createdBy_fkey"
      FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ParkingBlock_resourceId_time_idx" ON "ParkingBlock"("resourceId", "startTime", "endTime");
CREATE INDEX IF NOT EXISTS "ParkingBlock_groupId_time_idx"    ON "ParkingBlock"("groupId",    "startTime", "endTime");
