ALTER TABLE "PlanTemplate"
  ADD COLUMN IF NOT EXISTS "priceMonthlyEurCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "priceYearlyEurCents"  INTEGER;
