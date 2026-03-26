import {
  Injectable, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { UserRole } from '@prisma/client';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  organizationId?: string;
  cardUid?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  password?: string;
}

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, isActive: true, cardUid: true,
  createdAt: true, deletedAt: true, scheduledDeleteAt: true, retentionDays: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { password, ...rest } = dto;
    return this.prisma.user.create({ data: { ...rest, passwordHash }, select: USER_SELECT });
  }

  async findAll(organizationId?: string) {
    return this.prisma.user.findMany({
      where: { ...(organizationId ? { organizationId } : {}), deletedAt: null },
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDeactivated(organizationId?: string) {
    return this.prisma.user.findMany({
      where: { ...(organizationId ? { organizationId } : {}), deletedAt: { not: null } },
      select: USER_SELECT,
      orderBy: { deletedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  async update(id: string, dto: UpdateUserDto, actorRole: UserRole) {
    if (dto.role === UserRole.SUPER_ADMIN && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Admin can grant Super Admin role');
    }
    const data: any = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
      delete data.password;
    }
    // FIX: single update — Prisma throws P2025 if not found, no pre-fetch needed
    return this.prisma.user.update({ where: { id }, data, select: USER_SELECT });
  }

  async updateCardUid(id: string, cardUid: string) {
    return this.prisma.user.update({ where: { id }, data: { cardUid }, select: { id: true, cardUid: true } });
  }

  async softDelete(id: string, retentionDays = 30) {
    if (retentionDays < 30) retentionDays = 30;
    const deletedAt = new Date();
    const scheduledDeleteAt = new Date(deletedAt);
    scheduledDeleteAt.setDate(scheduledDeleteAt.getDate() + retentionDays);
    return this.prisma.user.update({
      where: { id },
      data:  { isActive: false, deletedAt, scheduledDeleteAt, retentionDays },
      select: USER_SELECT,
    });
  }

  async restore(id: string) {
    return this.prisma.user.update({
      where: { id },
      data:  { isActive: true, deletedAt: null, scheduledDeleteAt: null, retentionDays: null },
      select: USER_SELECT,
    });
  }

  async hardDelete(id: string) {
    const user = await this.findOne(id);
    if (!user.deletedAt) throw new ForbiddenException('User must be deactivated first');
    if (user.scheduledDeleteAt && new Date() < new Date(user.scheduledDeleteAt as any)) {
      throw new ForbiddenException(`Permanent deletion scheduled for ${user.scheduledDeleteAt}`);
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        email:        `deleted-${id}@deleted.invalid`,
        // FIX: anonymize name — was preserving firstName/lastName despite "anonymize" comment
        firstName:    'Usunięty',
        lastName:     'Użytkownik',
        passwordHash: '',
        cardUid:      null,
        isActive:     false,
      },
      select: USER_SELECT,
    });
  }

  async deactivate(id: string) {
    return this.softDelete(id, 30);
  }
}
