// ── PATCH: backend/src/modules/auth/azure-auth.service.ts ────────────────────
//
// Przepięcie na OrgIntegration z zachowaniem backward compat.
//
// 1. Dodaj import:
//    import { IntegrationsService } from '../integrations/integrations.service';
//
// 2. Dodaj do konstruktora:
//    constructor(
//      private prisma:        PrismaService,
//      private auth:          AuthService,
//      private jwt:           JwtService,
//      private config:        ConfigService,
//      private integrations:  IntegrationsService,   // ← DODAJ
//    ) {}
//
// 3. Zmień metodę loginWithAzureToken — zastąp blok "Sprawdź czy firma ma azureEnabled":

// PRZED:
//   const org = await this.prisma.organization.findFirst({
//     where: { azureTenantId: tenantId, azureEnabled: true, isActive: true },
//   });
//   if (!org) throw new UnauthorizedException('...');

// PO — nowa wersja z backward compat:
async _resolveOrgByTenantId(tenantId: string): Promise<{ id: string } | null> {
  // 1. Szukaj w nowym modelu OrgIntegration
  const integration = await (this as any).prisma.orgIntegration.findFirst({
    where: {
      provider:  'AZURE_ENTRA',
      isEnabled: true,
      tenantHint: tenantId,
    },
    include: { organization: { select: { id: true, isActive: true } } },
  });

  if (integration?.organization?.isActive) {
    return { id: integration.organization.id };
  }

  // 2. Fallback: stare pole Organization.azureTenantId (backward compat)
  const org = await (this as any).prisma.organization.findFirst({
    where: { azureTenantId: tenantId, azureEnabled: true, isActive: true },
    select: { id: true },
  });

  return org ?? null;
}

// 4. W loginWithAzureToken zamień:
//    const org = await this.prisma.organization.findFirst({ ... });
//    if (!org) throw new UnauthorizedException('...');
//
// Na:
//    const org = await this._resolveOrgByTenantId(tenantId);
//    if (!org) throw new UnauthorizedException(
//      'Logowanie przez Microsoft nie jest skonfigurowane dla tej organizacji. ' +
//      'Skontaktuj się z administratorem.',
//    );

// 5. checkSsoAvailable — dodaj obsługę OrgIntegration:
//    Zmień metodę żeby sprawdzała oba miejsca (OrgIntegration FIRST, Organization fallback)

async _checkSsoAvailableNew(orgSlug?: string, email?: string): Promise<{
  available: boolean; tenantId?: string;
}> {
  // Szukaj po emailu (domena)
  if (email) {
    const user = await (this as any).prisma.user.findFirst({
      where:   { email: email.toLowerCase() },
      select:  { organizationId: true },
    });
    if (user?.organizationId) {
      const cfg = await (this as any).integrations.getAzureConfig(user.organizationId);
      if (cfg?.isEnabled && cfg.tenantId) {
        return { available: true, tenantId: cfg.tenantId };
      }
    }
  }

  // Szukaj po slug
  if (orgSlug) {
    const org = await (this as any).prisma.organization.findUnique({
      where:  { slug: orgSlug },
      select: { id: true },
    });
    if (org) {
      const cfg = await (this as any).integrations.getAzureConfig(org.id);
      if (cfg?.isEnabled && cfg.tenantId) {
        return { available: true, tenantId: cfg.tenantId };
      }
    }
  }

  return { available: false };
}
