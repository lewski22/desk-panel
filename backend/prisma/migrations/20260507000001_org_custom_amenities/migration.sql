-- Sprint 0.17.8: per-org custom amenities dictionary
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "customAmenities" TEXT[] NOT NULL DEFAULT '{}';
