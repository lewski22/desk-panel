import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ReservationStatus } from '@prisma/client';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    locationId?: string;
    deskId?: string;
    userId?: string;
    date?: string;
    status?: ReservationStatus;
  }) {
    return this.prisma.reservation.findMany({
      where: {
        ...(filters.deskId && { deskId: filters.deskId }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.date && { date: new Date(filters.date) }),
        ...(filters.status && { status: filters.status }),
        ...(filters.locationId && {
          desk: { locationId: filters.locationId },
        }),
      },
      include: {
        desk: { select: { name: true, code: true, floor: true, zone: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  async findOne(id: string) {
    const r = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        desk: true,
        user: { select: { firstName: true, lastName: true, email: true } },
        checkin: true,
      },
    });
    if (!r) throw new NotFoundException(`Reservation ${id} not found`);
    return r;
  }

  async create(userId: string, dto: CreateReservationDto) {
    // Conflict check: same desk, same date, overlapping time, active status
    const conflict = await this.prisma.reservation.findFirst({
      where: {
        deskId: dto.deskId,
        date: new Date(dto.date),
        status: { in: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED] },
        OR: [
          {
            startTime: { lt: new Date(dto.endTime) },
            endTime: { gt: new Date(dto.startTime) },
          },
        ],
      },
    });

    if (conflict) {
      throw new ConflictException(
        'Desk is already reserved for this time slot',
      );
    }

    return this.prisma.reservation.create({
      data: {
        deskId: dto.deskId,
        userId,
        date: new Date(dto.date),
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        notes: dto.notes,
        status: ReservationStatus.CONFIRMED,
      },
      include: {
        desk: { select: { name: true, code: true } },
      },
    });
  }

  async cancel(id: string, actorId: string, actorRole: string) {
    const reservation = await this.findOne(id);

    // Only owner or admin/office-admin can cancel
    if (
      reservation.userId !== actorId &&
      !['SUPER_ADMIN', 'OFFICE_ADMIN'].includes(actorRole)
    ) {
      throw new ForbiddenException('Not allowed to cancel this reservation');
    }

    if (['CANCELLED', 'COMPLETED'].includes(reservation.status)) {
      throw new ConflictException('Reservation already closed');
    }

    return this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CANCELLED },
    });
  }

  async getQrToken(id: string, actorId: string) {
    const reservation = await this.findOne(id);
    if (reservation.userId !== actorId) {
      throw new ForbiddenException('Not your reservation');
    }
    return { qrToken: reservation.qrToken, deskId: reservation.deskId };
  }

  // Called by scheduled job — marks past CONFIRMED reservations as EXPIRED
  async expireOld() {
    const now = new Date();
    const result = await this.prisma.reservation.updateMany({
      where: {
        status: ReservationStatus.CONFIRMED,
        endTime: { lt: now },
      },
      data: { status: ReservationStatus.EXPIRED },
    });
    return result.count;
  }
}
