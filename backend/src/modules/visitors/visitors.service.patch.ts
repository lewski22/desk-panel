// ── PATCH: backend/src/modules/visitors/visitors.service.ts ──────────────
//
// 1. Zmień import klasy:
//    import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
//    import { PrismaService }         from '../../database/prisma.service';
//    import { NotificationsService }  from '../notifications/notifications.service';  // ← DODAJ
//
// 2. Zmień konstruktor:
//    constructor(
//      private prisma:         PrismaService,
//      private notifications:  NotificationsService,   // ← DODAJ
//    ) {}
//
// 3. Zastąp metodę invite() poniższą wersją:

async invite(locationId: string, hostUserId: string, dto: {
  firstName: string; lastName: string; email: string;
  visitDate: string; company?: string; purpose?: string;
}) {
  // Pobierz lokalizację + dane hosta (potrzebne do emaila)
  const [loc, host] = await Promise.all([
    this.prisma.location.findUnique({
      where: { id: locationId },
      select: { name: true, organizationId: true },
    }),
    this.prisma.user.findUnique({
      where: { id: hostUserId },
      select: { firstName: true, lastName: true },
    }),
  ]);

  if (!loc) throw new Error(`Location ${locationId} not found`);

  const visitor = await this.prisma.visitor.create({
    data: {
      locationId,
      hostUserId,
      firstName: dto.firstName,
      lastName:  dto.lastName,
      email:     dto.email,
      company:   dto.company,
      visitDate: new Date(dto.visitDate),
      purpose:   dto.purpose,
    },
    include: { host: { select: { firstName: true, lastName: true } } },
  });

  // Wyślij email z zaproszeniem (fire-and-forget — nie blokuje odpowiedzi)
  if (host && loc) {
    this.notifications.sendVisitorInvite({
      visitor: {
        id:        visitor.id,
        firstName: visitor.firstName,
        lastName:  visitor.lastName,
        email:     visitor.email,
        visitDate: visitor.visitDate,
        qrToken:   visitor.qrToken,
        purpose:   visitor.purpose,
        company:   visitor.company,
      },
      host: {
        firstName: host.firstName ?? '',
        lastName:  host.lastName  ?? '',
      },
      location: {
        name:           loc.name,
        organizationId: loc.organizationId,
      },
    }).catch(err => {
      // Nie crashuj — gość został zaproszony, tylko email się nie wysłał
      console.warn(`[VisitorsService] Failed to send invite email to ${visitor.email}:`, err?.message);
    });
  }

  return visitor;
}

// 4. Dodaj NotificationsModule do imports w visitors.module.ts:
//
//   import { NotificationsModule } from '../notifications/notifications.module';
//
//   @Module({
//     imports:     [NotificationsModule],   // ← DODAJ
//     controllers: [VisitorsController],
//     providers:   [VisitorsService],
//   })
//   export class VisitorsModule {}
