-- Migration: floor_plan_editor (Sprint D)
-- Dodaje pola pozycji biurek na mapie oraz metadane floor planu lokalizacji

-- Desk: pozycja, rotacja, rozmiar tokenu
ALTER TABLE "Desk"
  ADD COLUMN IF NOT EXISTS "posX"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "posY"     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rotation" INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "width"    DOUBLE PRECISION DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "height"   DOUBLE PRECISION DEFAULT 1;

-- Location: tło floor planu + wymiary canvas + rozmiar siatki
ALTER TABLE "Location"
  ADD COLUMN IF NOT EXISTS "floorPlanUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "floorPlanW"   INTEGER,
  ADD COLUMN IF NOT EXISTS "floorPlanH"   INTEGER,
  ADD COLUMN IF NOT EXISTS "gridSize"     INTEGER DEFAULT 40;
