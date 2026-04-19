import {
  Injectable, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VisitorsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Lista gości dla lokalizacji ───────────────────────────────
  async findAll(locationId: string, date?: string, actorOrgId?: string) {
    // Org isolation: sprawdź czy location należy do actorOrg
    if (actorOrgId) {
      const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { organizationId: true } });
      if (!loc || loc.organizationId !== actorOrgId) throw new ForbiddenException('Brak dostępu');
    }

    const where: any = { locationId };
    if (date) {
      const d = new Date(date); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      where.visitDate = { gte: d, lt: next };
    }

    return this.prisma.visitor.findMany({
      where,
      orderBy: { visitDate: 'asc' },
      include: { host: { select: { firstName: true, lastName: true, email: true } } },
    });
  }

  // ── Zaproś gościa ─────────────────────────────────────────────
  async invite(locationId: string, hostUserId: string, dto: {
    firstName: string; lastName?: string; email?: string; company?: string;
    visitDate: string; purpose?: string;
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

  async checkinByQr(qrToken: string) {
    const v = await this.prisma.visitor.findUnique({ where: { qrToken } });
    if (!v) throw new NotFoundException('Nieważny QR token wizyty');
    if (['CHECKED_OUT','CANCELLED'].includes(v.status)) throw new ForbiddenException('Wizyta wygasła');
    return this.checkin(v.id);
  }

  async checkout(id: string) {
    return this.prisma.visitor.update({ where: { id }, data: { status: 'CHECKED_OUT', checkedOutAt: new Date() } });
  }

  async cancel(id: string) {
    return this.prisma.visitor.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  async todayCount(locationId: string) {
    const now = new Date(); now.setHours(0,0,0,0);
    const next = new Date(now); next.setDate(next.getDate() + 1);
    return this.prisma.visitor.count({
      where: { locationId, visitDate: { gte: now, lt: next }, status: { not: 'CANCELLED' } },
    });
  }
}
