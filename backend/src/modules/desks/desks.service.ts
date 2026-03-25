import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DeskStatus } from '@prisma/client';
import { CreateDeskDto } from './dto/create-desk.dto';
import { UpdateDeskDto } from './dto/update-desk.dto';

@Injectable()
export class DesksService {
  constructor(private prisma: PrismaService) {}

  async findAll(locationId: string) {
    return this.prisma.desk.findMany({
      where: { locationId },
      include: {
        device: { select: { isOnline: true, lastSeen: true } },
        _count: { select: { reservations: true } },
      },
      orderBy: [{ floor: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const desk = await this.prisma.desk.findUnique({
      where: { id },
      include: {
        device: true,
        reservations: {
          where: {
            status: { in: ['PENDING', 'CONFIRMED'] },
            date: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
      },
    });
    if (!desk) throw new NotFoundException(`Desk ${id} not found`);
    return desk;
  }

  async create(locationId: string, dto: CreateDeskDto) {
    const exists = await this.prisma.desk.findFirst({
      where: { locationId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException(
        `Desk with code "${dto.code}" already exists in this location`,
      );
    }
    return this.prisma.desk.create({
      data: { ...dto, locationId },
    });
  }

  async update(id: string, dto: UpdateDeskDto) {
    await this.findOne(id);
    return this.prisma.desk.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.desk.update({
      where: { id },
      data: { status: DeskStatus.INACTIVE },
    });
  }

  async getAvailability(id: string, date: string) {
    await this.findOne(id);
    const reservations = await this.prisma.reservation.findMany({
      where: {
        deskId: id,
        date: new Date(date),
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true, status: true },
      orderBy: { startTime: 'asc' },
    });
    return { deskId: id, date, bookedSlots: reservations };
  }

  async getCurrentStatus(locationId: string) {
    const desks = await this.prisma.desk.findMany({
      where: { locationId, status: DeskStatus.ACTIVE },
      include: {
        device: { select: { isOnline: true } },
        checkins: {
          where: { checkedOutAt: null },
          take: 1,
          orderBy: { checkedInAt: 'desc' },
        },
      },
    });

    return desks.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      floor: d.floor,
      zone: d.zone,
      isOnline: d.device?.isOnline ?? false,
      isOccupied: d.checkins.length > 0,
    }));
  }
}

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.desk.update({ where: { id }, data: { status: DeskStatus.ACTIVE } });
  }

  async unassignDevice(id: string) {
    await this.findOne(id);
    // Find device assigned to this desk and unlink it
    const device = await this.prisma.device.findFirst({ where: { deskId: id } });
    if (!device) return { unlinked: false };
    await this.prisma.device.update({ where: { id: device.id }, data: { deskId: null } });
    return { unlinked: true, deviceId: device.id };
  }
