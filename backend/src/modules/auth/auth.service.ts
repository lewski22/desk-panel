import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { User } from '@prisma/client';
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
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) throw new UnauthorizedException('Current password is incorrect');
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new BadRequestException('New password must differ from current');
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }
}
