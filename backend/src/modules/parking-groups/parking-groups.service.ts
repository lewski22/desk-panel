import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ParkingGroupsService {
  constructor(private prisma: PrismaService) {}

  // ── Guards ───────────────────────────────────────────────────
  private async assertGroupInOrg(groupId: string, orgId: string, tx?: any) {
    const client = tx ?? this.prisma;
    const g = await client.parkingGroup.findUnique({ where: { id: groupId } });
    if (!g) throw new NotFoundException('Group not found');
    if (g.organizationId !== orgId) throw new ForbiddenException('Access denied');
    return g;
  }

  private async assertUserInOrg(userId: string, orgId: string, tx?: any) {
    const client = tx ?? this.prisma;
    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user || user.organizationId !== orgId) throw new ForbiddenException('User not in organization');
    return user;
  }

  // ── CRUD grup ────────────────────────────────────────────────
  async findAll(organizationId: string) {
    return this.prisma.parkingGroup.findMany({
      where:   { organizationId },
      include: { _count: { select: { users: true, resources: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, orgId: string) {
    await this.assertGroupInOrg(id, orgId);
    return this.prisma.parkingGroup.findUnique({
      where:   { id },
      include: {
        users:     { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        resources: { include: { resource: { select: { id: true, name: true, code: true, type: true } } } },
      },
    });
  }

  async create(organizationId: string, dto: { name: string; description?: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Group name is required');
    return this.prisma.parkingGroup.create({
      data: { organizationId, name: dto.name.trim(), description: dto.description },
    });
  }

  // TOCTOU fix: check + mutation in a single transaction
  async update(id: string, orgId: string, dto: { name?: string; description?: string }) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertGroupInOrg(id, orgId, tx);
      return tx.parkingGroup.update({ where: { id }, data: dto });
    });
  }

  async remove(id: string, orgId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.assertGroupInOrg(id, orgId, tx);
      await tx.parkingGroup.delete({ where: { id } });
    });
  }

  // ── Członkowie grupy ─────────────────────────────────────────
  async addUser(groupId: string, orgId: string, userId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertGroupInOrg(groupId, orgId, tx);
      await this.assertUserInOrg(userId, orgId, tx);
      return tx.parkingGroupUser.upsert({
        where:  { groupId_userId: { groupId, userId } },
        create: { groupId, userId, addedBy: actorId },
        update: {},
      });
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
    await this.prisma.$transaction(async (tx) => {
      await this.assertGroupInOrg(groupId, orgId, tx);
      await this.assertUserInOrg(userId, orgId, tx);
      await tx.parkingGroupUser.delete({
        where: { groupId_userId: { groupId, userId } },
      });
    });
  }

  // ── Przypisanie parkingów ────────────────────────────────────
  async setResources(groupId: string, orgId: string, resourceIds: string[], actorId: string) {
    await this.assertGroupInOrg(groupId, orgId);
    const resources = await this.prisma.resource.findMany({
      where:  { id: { in: resourceIds }, type: 'PARKING', location: { organizationId: orgId } },
      select: { id: true },
    });
    const validIds    = resources.map(r => r.id);
    const rejectedIds = resourceIds.filter(id => !validIds.includes(id));

    await this.prisma.$transaction([
      this.prisma.parkingGroupResource.deleteMany({ where: { groupId } }),
      this.prisma.parkingGroupResource.createMany({
        data: validIds.map(resourceId => ({ groupId, resourceId, assignedBy: actorId })),
      }),
    ]);
    return { assigned: validIds.length, rejected: rejectedIds.length };
  }

  // ── Access mode parkingu ─────────────────────────────────────
  async setAccessMode(resourceId: string, orgId: string, accessMode: 'PUBLIC' | 'GROUP_RESTRICTED') {
    const r = await this.prisma.resource.findUnique({
      where:  { id: resourceId },
      select: { id: true, type: true, location: { select: { organizationId: true } } },
    });
    if (!r) throw new NotFoundException('Resource not found');
    if (r.location.organizationId !== orgId) throw new ForbiddenException();
    if (r.type !== 'PARKING') throw new BadRequestException('Only PARKING resources have accessMode');
    return this.prisma.resource.update({ where: { id: resourceId }, data: { accessMode } });
  }

  // ── Sprawdź dostęp usera do konkretnego parkingu ─────────────
  async checkUserAccess(resourceId: string, userId: string): Promise<boolean> {
    const resource = await this.prisma.resource.findUnique({
      where:  { id: resourceId },
      select: { accessMode: true, type: true },
    });
    // Non-PARKING resources and non-existent resources are not subject to group access control.
    // Caller (createBooking) validates resource existence separately.
    if (!resource || resource.type !== 'PARKING') return true;
    if (resource.accessMode === 'PUBLIC') return true;

    const membership = await this.prisma.parkingGroupResource.findFirst({
      where: {
        resourceId,
        group: { users: { some: { userId } } },
      },
    });
    return !!membership;
  }
}
