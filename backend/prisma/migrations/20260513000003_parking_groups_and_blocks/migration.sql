-- CreateEnum
CREATE TYPE "ResourceAccessMode" AS ENUM ('PUBLIC', 'GROUP_RESTRICTED');

-- AlterTable: add accessMode to Resource
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "accessMode" "ResourceAccessMode" NOT NULL DEFAULT 'PUBLIC';

-- CreateTable: ParkingGroup
CREATE TABLE IF NOT EXISTS "ParkingGroup" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ParkingGroupUser
CREATE TABLE IF NOT EXISTS "ParkingGroupUser" (
    "groupId" TEXT NOT NULL,
    "userId"  TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingGroupUser_pkey" PRIMARY KEY ("groupId", "userId")
);

-- CreateTable: ParkingGroupResource
CREATE TABLE IF NOT EXISTS "ParkingGroupResource" (
    "groupId"    TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingGroupResource_pkey" PRIMARY KEY ("groupId", "resourceId")
);

-- CreateTable: ParkingBlock
CREATE TABLE IF NOT EXISTS "ParkingBlock" (
    "id"         TEXT NOT NULL,
    "resourceId" TEXT,
    "groupId"    TEXT,
    "reason"     TEXT,
    "startTime"  TIMESTAMP(3) NOT NULL,
    "endTime"    TIMESTAMP(3) NOT NULL,
    "createdBy"  TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParkingGroup_organizationId_idx" ON "ParkingGroup"("organizationId");

CREATE INDEX IF NOT EXISTS "ParkingGroupUser_userId_idx" ON "ParkingGroupUser"("userId");
CREATE INDEX IF NOT EXISTS "ParkingGroupUser_addedBy_idx" ON "ParkingGroupUser"("addedBy");

CREATE INDEX IF NOT EXISTS "ParkingGroupResource_resourceId_idx" ON "ParkingGroupResource"("resourceId");
CREATE INDEX IF NOT EXISTS "ParkingGroupResource_assignedBy_idx" ON "ParkingGroupResource"("assignedBy");

CREATE INDEX IF NOT EXISTS "ParkingBlock_resourceId_startTime_endTime_idx" ON "ParkingBlock"("resourceId", "startTime", "endTime");
CREATE INDEX IF NOT EXISTS "ParkingBlock_groupId_startTime_endTime_idx"    ON "ParkingBlock"("groupId",    "startTime", "endTime");

-- AddForeignKey: ParkingGroup → Organization
ALTER TABLE "ParkingGroup"
    ADD CONSTRAINT "ParkingGroup_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParkingGroupUser → ParkingGroup
ALTER TABLE "ParkingGroupUser"
    ADD CONSTRAINT "ParkingGroupUser_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ParkingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParkingGroupUser → User (member)
ALTER TABLE "ParkingGroupUser"
    ADD CONSTRAINT "ParkingGroupUser_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParkingGroupUser → User (adder)
ALTER TABLE "ParkingGroupUser"
    ADD CONSTRAINT "ParkingGroupUser_addedBy_fkey"
    FOREIGN KEY ("addedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ParkingGroupResource → ParkingGroup
ALTER TABLE "ParkingGroupResource"
    ADD CONSTRAINT "ParkingGroupResource_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ParkingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParkingGroupResource → Resource
ALTER TABLE "ParkingGroupResource"
    ADD CONSTRAINT "ParkingGroupResource_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParkingGroupResource → User (assigner)
ALTER TABLE "ParkingGroupResource"
    ADD CONSTRAINT "ParkingGroupResource_assignedBy_fkey"
    FOREIGN KEY ("assignedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ParkingBlock → Resource
ALTER TABLE "ParkingBlock"
    ADD CONSTRAINT "ParkingBlock_resourceId_fkey"
    FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParkingBlock → ParkingGroup
ALTER TABLE "ParkingBlock"
    ADD CONSTRAINT "ParkingBlock_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "ParkingGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: ParkingBlock → User (creator)
ALTER TABLE "ParkingBlock"
    ADD CONSTRAINT "ParkingBlock_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
