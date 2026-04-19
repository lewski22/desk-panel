import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { User, UserRole } from '@prisma/client';
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {}
  async validateUser(email: string, password: string): Promise<User|null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;
    if (user.passwordHash === 'AZURE_SSO_ONLY' || user.passwordHash === 'GOOGLE_SSO_ONLY') return null;
    return await bcrypt.compare(password, user.passwordHash) ? user : null;
  }
  async login(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, organizationId: (user as any).organizationId };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '7d' });
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });
    let enabledModules: string[] = [];
    if ((user as any).organizationId) {
      const org = await this.prisma.organization.findUnique({ where: { id: (user as any).organizationId }, select: { enabledModules: true } });
      enabledModules = org?.enabledModules ?? [];
    }
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: (user as any).organizationId, enabledModules } };
  }
  async refresh(refreshToken: string) {
    const record = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true } });
    if (!record || record.expiresAt < new Date()) {
      if (record) await this.prisma.refreshToken.delete({ where: { token: refreshToken } }).catch(() => {});
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (!record.user.isActive) { await this.prisma.refreshToken.delete({ where: { token: refreshToken } }); throw new UnauthorizedException('Account deactivated'); }
    await this.prisma.refreshToken.delete({ where: { token: refreshToken } });
    return this.login(record.user);
  }
  async logout(refreshToken: string) { await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } }); }
  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    let enabledModules: string[] = [];
    if ((user as any).organizationId) {
      const org = await this.prisma.organization.findUnique({ where: { id: (user as any).organizationId }, select: { enabledModules: true } });
      enabledModules = org?.enabledModules ?? [];
    }
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: (user as any).organizationId, enabledModules };
  }
  /**
   * Shared JIT provisioning for SSO providers (Azure, Google).
   * Finds existing user by email (and optionally by ssoId), creates if missing.
   */
  async provisionSsoUser(opts: {
    email:          string;
    orgId:          string;
    firstName?:     string;
    lastName?:      string;
    passwordMarker: string;
    ssoId?:         string;
    ssoIdField?:    string;
    extraData?:     Record<string, string>;
  }): Promise<User> {
    const emailLower = opts.email.toLowerCase();

    const whereOr: any[] = [{ email: emailLower }];
    if (opts.ssoId && opts.ssoIdField) {
      whereOr.push({ [opts.ssoIdField]: opts.ssoId });
    }

    let user = await this.prisma.user.findFirst({ where: { OR: whereOr } });

    if (user) {
      if (!user.isActive) throw new UnauthorizedException('Konto jest nieaktywne');
      if (opts.ssoId && opts.ssoIdField && !(user as any)[opts.ssoIdField]) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data:  { [opts.ssoIdField]: opts.ssoId, ...(opts.extraData ?? {}) },
        });
      }
      return user;
    }

    return this.prisma.user.create({
      data: {
        email:          emailLower,
        passwordHash:   opts.passwordMarker,
        firstName:      opts.firstName ?? null,
        lastName:       opts.lastName  ?? null,
        role:           UserRole.END_USER,
        organizationId: opts.orgId,
        isActive:       true,
        ...(opts.ssoId && opts.ssoIdField ? { [opts.ssoIdField]: opts.ssoId } : {}),
        ...(opts.extraData ?? {}),
      },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) throw new UnauthorizedException('Current password is incorrect');
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new BadRequestException('New password must differ from current');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
