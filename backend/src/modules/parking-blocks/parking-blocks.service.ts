import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const MAX_ACTIVE_BLOCKS  = 50;
const MAX_BLOCK_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class ParkingBlocksService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    resourceId?: string; groupId?: string;
    from?: string; to?: string; orgId: string;
  }) {
    const where: any = {};

    if (filters.resourceId) {
      const r = await this.prisma.resource.findUnique({
        where:  { id: filters.resourceId },
        select: { location: { select: { organizationId: true } } },
      });
      if (!r || r.location.organizationId !== filters.orgId) throw new ForbiddenException();
      where.resourceId = filters.resourceId;
    }

    if (filters.groupId) {
      const g = await this.prisma.parkingGroup.findUnique({ where: { id: filters.groupId } });
      if (!g || g.organizationId !== filters.orgId) throw new ForbiddenException();
      where.groupId = filters.groupId;
    }

    if (filters.from && filters.to && new Date(filters.from) > new Date(filters.to)) {
      throw new BadRequestException('from must be before to');
    }
    if (filters.from) where.endTime   = { gte: new Date(filters.from) };
    if (filters.to)   where.startTime = { ...(where.startTime ?? {}), lte: new Date(filters.to) };

    return this.prisma.parkingBlock.findMany({
      where,
      include: {
        resource: { select: { name: true, code: true } },
        group:    { select: { name: true } },
        creator:  { select: { firstName: true, lastName: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async create(dto: {
    resourceId?: string; groupId?: string;
    reason?: string; startTime: string; endTime: string;
    createdBy: string; orgId: string;
  }) {
    if (!dto.resourceId && !dto.groupId) {
      throw new BadRequestException('resourceId or groupId is required');
    }
    const start = new Date(dto.startTime);
    const end   = new Date(dto.endTime);
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }
    if (start < new Date()) {
      throw new BadRequestException('Cannot create blocks in the past');
    }
    if (end.getTime() - start.getTime() > MAX_BLOCK_DURATION_MS) {
      throw new BadRequestException('Block duration cannot exceed 30 days');
    }

    if (dto.resourceId) {
      const r = await this.prisma.resource.findUnique({
        where:  { id: dto.resourceId },
        select: { location: { select: { organizationId: true } } },
      });
      if (!r || r.location.organizationId !== dto.orgId) throw new ForbiddenException();
    }

    if (dto.groupId) {
      const g = await this.prisma.parkingGroup.findUnique({ where: { id: dto.groupId } });
      if (!g || g.organizationId !== dto.orgId) throw new ForbiddenException();
    }

    // count + insert atomically to enforce MAX_ACTIVE_BLOCKS
    return this.prisma.$transaction(async (tx) => {
      if (dto.resourceId) {
        const activeCount = await tx.parkingBlock.count({
          where: { resourceId: dto.resourceId, endTime: { gte: new Date() } },
        });
        if (activeCount >= MAX_ACTIVE_BLOCKS) {
          throw new BadRequestException(`Active block limit reached for this resource (max ${MAX_ACTIVE_BLOCKS})`);
        }
      }
      if (dto.groupId) {
        const activeCount = await tx.parkingBlock.count({
          where: { groupId: dto.groupId, endTime: { gte: new Date() } },
        });
        if (activeCount >= MAX_ACTIVE_BLOCKS) {
          throw new BadRequestException(`Active block limit reached for this group (max ${MAX_ACTIVE_BLOCKS})`);
        }
      }
      return tx.parkingBlock.create({
        data: {
          resourceId: dto.resourceId,
          groupId:    dto.groupId,
          reason:     dto.reason,
          startTime:  start,
          endTime:    end,
          createdBy:  dto.createdBy,
        },
        include: {
          resource: { select: { name: true, code: true } },
          group:    { select: { name: true } },
          creator:  { select: { firstName: true, lastName: true } },
        },
      });
    });
  }

  async remove(id: string, orgId: string) {
    const block = await this.prisma.parkingBlock.findUnique({
      where:   { id },
      select: {
        resource: { select: { location: { select: { organizationId: true } } } },
        group:    { select: { organizationId: true } },
      },
    });
    if (!block) throw new NotFoundException();
    const blockOrgId = block.resource?.location?.organizationId ?? block.group?.organizationId;
    if (blockOrgId !== orgId) throw new ForbiddenException();
    await this.prisma.parkingBlock.delete({ where: { id } });
  }

  // Używane przez ResourcesService.createBooking — sprawdź blokady
  async isBlocked(
    resourceId: string,
    userId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<string | null> {
    // Blokady zasobu — ogólne (bez groupId) blokują wszystkich;
    // z groupId blokują tylko członków tej grupy.
    const resourceBlocks = await this.prisma.parkingBlock.findMany({
      where: {
        resourceId,
        startTime: { lte: endTime },
        endTime:   { gte: startTime },
      },
      include: {
        group: { include: { users: { where: { userId } } } },
      },
    });

    for (const rb of resourceBlocks) {
      if (!rb.groupId) {
        return rb.reason ?? 'Spot blocked during this period';
      }
      // group-specific block — dotyczy tylko członków tej grupy
      if ((rb.group as any)?.users?.length) {
        return rb.reason ?? 'Spot blocked for your group during this period';
      }
    }

    // Blokada całej grupy usera w tym czasie
    const groupBlock = await this.prisma.parkingBlock.findFirst({
      where: {
        groupId:    { not: null },
        resourceId: null,
        group:      { users: { some: { userId } } },
        startTime:  { lte: endTime },
        endTime:    { gte: startTime },
      },
    });
    if (groupBlock) return groupBlock.reason ?? 'Your group has bookings blocked during this period';

    return null;
  }
}
