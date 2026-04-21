-- CreateTable
CREATE TABLE "LocationFloorPlan" (
    "id"           TEXT NOT NULL,
    "locationId"   TEXT NOT NULL,
    "floor"        TEXT NOT NULL,
    "floorPlanUrl" TEXT,
    "floorPlanKey" TEXT,
    "floorPlanW"   INTEGER,
    "floorPlanH"   INTEGER,
    "gridSize"     INTEGER DEFAULT 40,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationFloorPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocationFloorPlan_locationId_idx" ON "LocationFloorPlan"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationFloorPlan_locationId_floor_key" ON "LocationFloorPlan"("locationId", "floor");

-- AddForeignKey
ALTER TABLE "LocationFloorPlan" ADD CONSTRAINT "LocationFloorPlan_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
