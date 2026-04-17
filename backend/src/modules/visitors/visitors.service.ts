/**
 * VisitorsService — Sprint J
 * Zarządzanie gośćmi biura (Visitor Management)
 */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  // ── Lista gości per lokalizacja + dzień ───────────────────────
  async findAll(locationId: string, date?: string, actorOrgId?: string) {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { organizationId: true } });
    if (actorOrgId && loc?.organizationId !== actorOrgId) throw new ForbiddenException();

    const where: any = { locationId };
    if (date) {
      const day   = new Date(date + 'T00:00:00.000Z');
      const next  = new Date(day); next.setDate(next.getDate() + 1);
      where.visitDate = { gte: day, lt: next };
    }
    return this.prisma.visitor.findMany({
      where,
      include: { host: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { visitDate: 'asc' },
    });
  }

  // ── Zaproś gościa ─────────────────────────────────────────────
  async invite(locationId: string, hostUserId: string, dto: {
    firstName: string; lastName: string; email: string;
    visitDate: string; company?: string; purpose?: string;
  }) {
    const visitor = await this.prisma.visitor.create({
      data: {
        locationId,
        hostUserId,
        firstName:  dto.firstName,
        lastName:   dto.lastName,
        email:      dto.email,
        company:    dto.company,
        visitDate:  new Date(dto.visitDate),
        purpose:    dto.purpose,
      },
      include: { host: { select: { firstName: true, lastName: true } } },
    });
    // TODO: send invite email with QR token (przez NotificationsService/SMTP)
    return visitor;
  }

  // ── Check-in gościa ───────────────────────────────────────────
  async checkin(id: string) {
    const v = await this.prisma.visitor.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Gość nie znaleziony');
    if (v.status === 'CHECKED_IN') return v;
    return this.prisma.visitor.update({
      where: { id },
      data:  { status: 'CHECKED_IN', checkedInAt: new Date() },
    });
  }

  // ── Check-in przez QR token (publiczny endpoint) ──────────────
  async checkinByQr(qrToken: string) {
    const v = await this.prisma.visitor.findUnique({ where: { qrToken } });
    if (!v) throw new NotFoundException('Nieważny QR token wizyty');
    if (['CHECKED_OUT','CANCELLED'].includes(v.status)) throw new ForbiddenException('Wizyta wygasła');
    return this.checkin(v.id);
  }

  // ── Check-out ─────────────────────────────────────────────────
  async checkout(id: string) {
    return this.prisma.visitor.update({
      where: { id },
      data:  { status: 'CHECKED_OUT', checkedOutAt: new Date() },
    });
  }

  // ── Anuluj wizytę ─────────────────────────────────────────────
  async cancel(id: string) {
    return this.prisma.visitor.update({
      where: { id },
      data:  { status: 'CANCELLED' },
    });
  }

  // ── Dzisiaj — quick count dla dashboardu ─────────────────────
  async todayCount(locationId: string) {
    const now  = new Date(); now.setHours(0,0,0,0);
    const next = new Date(now); next.setDate(next.getDate() + 1);
    return this.prisma.visitor.count({
      where: { locationId, visitDate: { gte: now, lt: next }, status: { not: 'CANCELLED' } },
    });
  }
}
