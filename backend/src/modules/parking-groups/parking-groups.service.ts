import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ParkingGroupsService {
  constructor(private prisma: PrismaService) {}

  private async assertGroupInOrg(groupId: string, orgId: string) {
    const g = await this.prisma.parkingGroup.findUnique({ where: { id: groupId } });
    if (!g) throw new NotFoundException('Group not found');
    if (g.organizationId !== orgId) throw new ForbiddenException();
    return g;
  }

  async findAll(orgId: string) {
    return this.prisma.parkingGroup.findMany({
      where:   { organizationId: orgId },
      include: { _count: { select: { users: true, resources: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    await this.assertGroupInOrg(id, orgId);
    return this.prisma.parkingGroup.findUnique({
      where: { id },
      include: {
        users: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        resources: {
          include: {
            resource: {
              select: {
                id: true, name: true, code: true, type: true, floor: true, zone: true,
                location: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
  }

  async create(orgId: string, dto: { name: string; description?: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Group name is required');
    return this.prisma.parkingGroup.create({
      data: { organizationId: orgId, name: dto.name.trim(), description: dto.description },
    });
  }

  async update(id: string, orgId: string, dto: { name?: string; description?: string }) {
    await this.assertGroupInOrg(id, orgId);
    return this.prisma.parkingGroup.update({ where: { id }, data: dto });
  }

  async remove(id: string, orgId: string) {
    await this.assertGroupInOrg(id, orgId);
    const activeBookings = await this.prisma.booking.count({
      where: {
        status:  'CONFIRMED',
        endTime: { gte: new Date() },
        resource: { parkingGroups: { some: { groupId: id } } },
      },
    });
    if (activeBookings > 0) {
      throw new ConflictException(
        `Grupa ma ${activeBookings} aktywnych rezerwacji. Anuluj je przed usunięciem grupy.`,
      );
    }
    await this.prisma.parkingGroup.delete({ where: { id } });
  }

  async addUser(groupId: string, orgId: string, userId: string, actorId: string) {
    await this.assertGroupInOrg(groupId, orgId);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== orgId) throw new ForbiddenException('User not in org');
    return this.prisma.parkingGroupUser.upsert({
      where:  { groupId_userId: { groupId, userId } },
      create: { groupId, userId, addedBy: actorId },
      update: {},
    });
  }

  async addUsersBulk(groupId: string, orgId: string, userIds: string[], actorId: string) {
    await this.assertGroupInOrg(groupId, orgId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, organizationId: orgId },
    });
    const validIds = users.map(u => u.id);
    await this.prisma.parkingGroupUser.createMany({
      data:           validIds.map(userId => ({ groupId, userId, addedBy: actorId })),
      skipDuplicates: true,
    });
    return { added: validIds.length };
  }

  async removeUser(groupId: string, orgId: string, userId: string) {
    await this.assertGroupInOrg(groupId, orgId);
    await this.prisma.parkingGroupUser.delete({
      where: { groupId_userId: { groupId, userId } },
    });
  }

  async setResources(groupId: string, orgId: string, resourceIds: string[], actorId: string) {
    await this.assertGroupInOrg(groupId, orgId);
    const resources = await this.prisma.resource.findMany({
      where:  { id: { in: resourceIds }, type: 'PARKING', location: { organizationId: orgId } },
      select: { id: true },
    });
    const validIds = resources.map(r => r.id);
    await this.prisma.$transaction([
      this.prisma.parkingGroupResource.deleteMany({ where: { groupId } }),
      this.prisma.parkingGroupResource.createMany({
        data: validIds.map(resourceId => ({ groupId, resourceId, assignedBy: actorId })),
      }),
    ]);
    return { assigned: validIds.length };
  }

  async setAccessMode(resourceId: string, orgId: string, accessMode: 'PUBLIC' | 'GROUP_RESTRICTED') {
    const r = await this.prisma.resource.findUnique({
      where:   { id: resourceId },
      include: { location: { select: { organizationId: true } } },
    });
    if (!r) throw new NotFoundException();
    if (r.location.organizationId !== orgId) throw new ForbiddenException();
    if (r.type !== 'PARKING') throw new BadRequestException('Tylko zasoby PARKING');
    return this.prisma.resource.update({ where: { id: resourceId }, data: { accessMode } });
  }

  async checkUserAccess(resourceId: string, userId: string): Promise<boolean> {
    const resource = await this.prisma.resource.findUnique({
      where:  { id: resourceId },
      select: { accessMode: true, type: true },
    });
    if (!resource || resource.type !== 'PARKING') return true;
    if (resource.accessMode === 'PUBLIC') return true;
    const membership = await this.prisma.parkingGroupResource.findFirst({
      where: { resourceId, group: { users: { some: { userId } } } },
    });
    return !!membership;
  }

  async checkWeeklyLimit(userId: string, resourceId: string, date: Date): Promise<boolean> {
    const resource = await this.prisma.resource.findUnique({
      where:   { id: resourceId },
      include: { location: { select: { maxParkingDaysPerWeek: true } } },
    });
    const limit = resource?.location?.maxParkingDaysPerWeek;
    if (!limit) return true;

    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const count = await this.prisma.booking.count({
      where: {
        userId,
        status: 'CONFIRMED',
        date:   { gte: startOfWeek, lt: endOfWeek },
        resource: { type: 'PARKING' },
      },
    });
    return count < limit;
  }
}
