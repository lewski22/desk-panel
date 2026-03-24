// ── users.service.ts ─────────────────────────────────────────
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { password, ...rest } = dto;

    return this.prisma.user.create({
      data: { ...rest, passwordHash },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, organizationId: true, isActive: true, createdAt: true,
      },
    });
  }

  async findAll(organizationId?: string) {
    return this.prisma.user.findMany({
      where: organizationId ? { organizationId } : undefined,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, cardUid: true, createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, cardUid: true, isActive: true, createdAt: true,
      },
    });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  async updateCardUid(id: string, cardUid: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { cardUid },
      select: { id: true, cardUid: true },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, isActive: true },
    });
  }
}
