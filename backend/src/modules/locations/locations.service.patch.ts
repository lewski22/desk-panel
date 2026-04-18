// ── PATCH: backend/src/modules/locations/locations.service.ts ───────────────
//
// 1. Dodaj import:
//    import { StorageService } from '../../shared/storage.service';
//
// 2. Dodaj do konstruktora:
//    constructor(
//      private prisma:   PrismaService,
//      private storage:  StorageService,   // ← DODAJ
//      // ... reszta
//    ) {}
//
// 3. Zastąp istniejącą metodę saveFloorPlan() / uploadFloorPlan()
//    poniższą implementacją:

/**
 * saveFloorPlan — zapisuje plan piętra.
 *
 * Jeśli R2 skonfigurowany → upload do CDN, URL w DB.
 * Brak R2 → base64 w DB (backwards compat, limit 2MB).
 *
 * Usuwa poprzedni plik z R2 jeśli był tam przechowywany.
 */
async saveFloorPlan(
  locationId: string,
  body: {
    floorPlanUrl:  string; // base64 data URL z frontendu
    floorPlanW?:   number;
    floorPlanH?:   number;
    gridSize?:     number;
  },
) {
  const loc = await this.prisma.location.findUnique({
    where:  { id: locationId },
    select: { floorPlanUrl: true, floorPlanKey: true, organizationId: true },
  });
  if (!loc) throw new Error(`Location ${locationId} not found`);

  // Upload pliku (R2 lub base64 fallback)
  const uploaded = await this.storage.uploadFloorPlan(
    loc.organizationId,
    locationId,
    body.floorPlanUrl,
  );

  // Usuń poprzedni plik z R2 jeśli istnieje
  if (loc.floorPlanKey && loc.floorPlanKey !== uploaded.key) {
    await this.storage.deleteFloorPlan(loc.floorPlanKey);
  }

  return this.prisma.location.update({
    where: { id: locationId },
    data:  {
      floorPlanUrl: uploaded.url,
      floorPlanKey: uploaded.key || null,  // null dla DB-backend
      floorPlanW:   body.floorPlanW,
      floorPlanH:   body.floorPlanH,
      gridSize:     body.gridSize,
    },
    select: { id: true, floorPlanUrl: true, floorPlanW: true, floorPlanH: true, gridSize: true },
  });
}

/**
 * deleteFloorPlan — usuwa plan piętra.
 */
async deleteFloorPlan(locationId: string) {
  const loc = await this.prisma.location.findUnique({
    where:  { id: locationId },
    select: { floorPlanKey: true },
  });

  // Usuń z R2 jeśli był tam
  if (loc?.floorPlanKey) {
    await this.storage.deleteFloorPlan(loc.floorPlanKey);
  }

  return this.prisma.location.update({
    where: { id: locationId },
    data:  { floorPlanUrl: null, floorPlanKey: null, floorPlanW: null, floorPlanH: null },
    select: { id: true },
  });
}

// ── MIGRACJA PRISMA — dodaj pole floorPlanKey do Location ───────────────────
// Plik: prisma/migrations/<timestamp>_add_floor_plan_key/migration.sql
//
// -- This migration runs safely (no ALTER TYPE, no transaction issues)
// ALTER TABLE "Location"
//   ADD COLUMN IF NOT EXISTS "floorPlanKey" TEXT;
//
// Plik: prisma/schema.prisma — dodaj do modelu Location:
//   floorPlanKey  String?
//
// ── app.module.ts — dodaj StorageModule ─────────────────────────────────────
// import { StorageModule } from './shared/storage.module';
//
// @Module({
//   imports: [
//     StorageModule,   // ← DODAJ (global, nie potrzeba importować w każdym module)
//     // ... reszta
//   ]
// })
