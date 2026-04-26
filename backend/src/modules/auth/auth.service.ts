import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../notifications/mailer.service';
import { User, UserRole } from '@prisma/client';
@Injectable()
export class AuthService {
  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
    private mailer:  MailerService,
  ) {}
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
    let subscriptionStatus: string | null = null;
    if ((user as any).organizationId) {
      const org = await this.prisma.organization.findUnique({ where: { id: (user as any).organizationId }, select: { enabledModules: true, planExpiresAt: true, trialEndsAt: true } });
      enabledModules = org?.enabledModules ?? [];
      subscriptionStatus = this._calcSubscriptionStatus(org);
    }
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: (user as any).organizationId, enabledModules, subscriptionStatus } };
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
    let subscriptionStatus: string | null = null;
    if ((user as any).organizationId) {
      const org = await this.prisma.organization.findUnique({ where: { id: (user as any).organizationId }, select: { enabledModules: true, planExpiresAt: true, trialEndsAt: true } });
      enabledModules = org?.enabledModules ?? [];
      subscriptionStatus = this._calcSubscriptionStatus(org);
    }
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: (user as any).organizationId, enabledModules, subscriptionStatus };
  }

  private _calcSubscriptionStatus(org: { planExpiresAt?: Date | null; trialEndsAt?: Date | null } | null | undefined): string | null {
    if (!org) return null;
    const now = new Date();
    const expiryDate = org.trialEndsAt ?? org.planExpiresAt;
    if (!expiryDate) return null; // bezterminowy (Enterprise)
    const days = Math.ceil((expiryDate.getTime() - now.getTime()) / 86_400_000);
    if (days <= 0)  return 'expired';
    if (days <= 14) return 'expiring_soon';
    return null;
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

  // ── Invitation flow ──────────────────────────────────────────

  async createInvitation(opts: {
    email:         string;
    organizationId: string;
    role:          UserRole;
    invitedById:   string;
    expiresInDays?: number;
  }) {
    const emailLower = opts.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) throw new ConflictException('Użytkownik z tym adresem email już istnieje');

    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: opts.organizationId },
      select: { name: true },
    });

    const days = opts.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + days * 86_400_000);

    const invitation = await this.prisma.invitationToken.create({
      data: {
        email:          emailLower,
        organizationId: opts.organizationId,
        role:           opts.role,
        invitedById:    opts.invitedById,
        expiresAt,
      },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://staff.prohalw2026.ovh');
    const link = `${frontendUrl}/register/${invitation.token}`;

    await this.mailer.send({
      to:      emailLower,
      subject: `Zaproszenie do ${org.name} — Reserti`,
      html:    this.mailer.buildHtml({
        title:    `Zaproszenie do ${org.name}`,
        body:     `<p>Zostałeś zaproszony do dołączenia do organizacji <strong>${org.name}</strong> w systemie Reserti.</p>
                   <p>Kliknij przycisk poniżej, aby założyć konto. Link ważny przez ${days} dni.</p>`,
        ctaLabel: 'Utwórz konto',
        ctaUrl:   link,
        footer:   `Jeśli nie spodziewałeś się tego zaproszenia, zignoruj tę wiadomość.`,
      }),
    }, opts.organizationId);

    return { ok: true, email: emailLower, expiresAt };
  }

  async getPendingInvitations(organizationId: string) {
    const invitations = await this.prisma.invitationToken.findMany({
      where: {
        organizationId,
        usedAt:    null,
        expiresAt: { gt: new Date() },
      },
      select: { email: true, role: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return invitations;
  }

  async getInvitationInfo(token: string) {
    const inv = await this.prisma.invitationToken.findUnique({
      where: { token },
      include: { organization: { select: { name: true } } },
    });
    if (!inv) throw new NotFoundException('Zaproszenie nie istnieje lub wygasło');

    return {
      email:   inv.email,
      orgName: inv.organization.name,
      role:    inv.role,
      expired: inv.expiresAt < new Date(),
      used:    !!inv.usedAt,
    };
  }

  async completeRegistration(opts: {
    token:     string;
    firstName: string;
    lastName:  string;
    password:  string;
  }) {
    const inv = await this.prisma.invitationToken.findUnique({ where: { token: opts.token } });
    if (!inv)           throw new NotFoundException('Nieprawidłowy token zaproszenia');
    if (inv.usedAt)     throw new BadRequestException('To zaproszenie zostało już wykorzystane');
    if (inv.expiresAt < new Date()) throw new BadRequestException('Zaproszenie wygasło');

    const emailLower = inv.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) throw new ConflictException('Konto dla tego adresu email już istnieje');

    const hash = await bcrypt.hash(opts.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email:          emailLower,
        passwordHash:   hash,
        firstName:      opts.firstName,
        lastName:       opts.lastName,
        role:           inv.role,
        organizationId: inv.organizationId,
        isActive:       true,
      },
    });

    await this.prisma.invitationToken.update({
      where: { token: opts.token },
      data:  { usedAt: new Date() },
    });

    return this.login(user);
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
