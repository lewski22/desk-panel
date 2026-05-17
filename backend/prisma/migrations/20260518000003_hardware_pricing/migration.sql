CREATE TABLE IF NOT EXISTS "HardwarePricing" (
  "id"                  TEXT         NOT NULL DEFAULT 'default',
  "beaconPriceEurCents" INTEGER,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "HardwarePricing_pkey" PRIMARY KEY ("id")
);
