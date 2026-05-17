/**
 * AuthService — uwierzytelnianie i zarządzanie sesjami.
 *
 * Odpowiada za:
 * - Logowanie email+hasło (validateUser → login)
 * - Rotację tokenów JWT (access 15 min, refresh 7 dni, httpOnly cookie)
 * - JIT provisioning użytkowników SSO (Azure, Google) — wspólna metoda provisionSsoUser()
 * - Przepływ zaproszeń: createInvitation → link email → completeRegistration
 * - Zmianę hasła z unieważnieniem wszystkich aktywnych sesji
 * - Wyliczanie statusu subskrypcji organizacji (_calcSubscriptionStatus)
 *
 * Refresh tokeny są przechowywane w tabeli RefreshToken i kasowane przy logout
 * lub wygaśnięciu — brak możliwości wielokrotnego użycia.
 *
 * backend/src/modules/auth/auth.service.ts
 */
import { Injectable, Logger, UnauthorizedException, BadRequestException, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RegisterOrgDto } from './dto/register-org.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../notifications/mailer.service';
import { User, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma:  PrismaService,
    private jwt:     JwtService,
    private config:  ConfigService,
    private mailer:  MailerService,
  ) {}
  /** Weryfikuje email+hasło. Zwraca null dla kont SSO-only lub nieaktywnych. */
  async validateUser(email: string, password: string): Promise<User|null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;
    if (user.passwordHash === 'AZURE_SSO_ONLY' || user.passwordHash === 'GOOGLE_SSO_ONLY') return null;
    return await bcrypt.compare(password, user.passwordHash) ? user : null;
  }
  /** Tworzy parę access+refresh token, zapisuje refresh w DB, zwraca profil użytkownika z modułami org. */
  async login(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
    const accessToken = this.jwt.sign(payload);
    const refreshDays = user.role === UserRole.KIOSK ? 30 : 7;
    const refreshToken = this.jwt.sign(payload, { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: `${refreshDays}d` });
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + refreshDays);
    await this.prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt } });
    let enabledModules: string[] = [];
    let subscriptionStatus: string | null = null;
    let mustChangePassword = !!user.mustChangePassword;
    let passwordPolicy: { minLength: number; requireUppercase: boolean; requireNumbers: boolean; requireSpecial: boolean } | undefined;
    if (user.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { enabledModules: true, planExpiresAt: true, trialEndsAt: true, passwordExpiryDays: true, passwordMinLength: true, passwordRequireUppercase: true, passwordRequireNumbers: true, passwordRequireSpecial: true },
      });
      enabledModules = org?.enabledModules ?? [];
      subscriptionStatus = this._calcSubscriptionStatus(org);
      if (!mustChangePassword) {
        mustChangePassword = await this._checkPasswordExpiry(user, org?.passwordExpiryDays ?? null);
      }
      if (org) {
        passwordPolicy = {
          minLength:        org.passwordMinLength        ?? 8,
          requireUppercase: org.passwordRequireUppercase ?? false,
          requireNumbers:   org.passwordRequireNumbers   ?? false,
          requireSpecial:   org.passwordRequireSpecial   ?? false,
        };
      }
    }
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: user.organizationId, enabledModules, subscriptionStatus, mustChangePassword, passwordPolicy } };
  }
  /** Rotuje refresh token: sprawdza DB, kasuje stary, wydaje nową parę. Dezaktywowane konta odrzuca. */
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
    let mustChangePassword = !!user.mustChangePassword;
    let passwordPolicy: { minLength: number; requireUppercase: boolean; requireNumbers: boolean; requireSpecial: boolean } | undefined;
    if (user.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { enabledModules: true, planExpiresAt: true, trialEndsAt: true, passwordExpiryDays: true, passwordMinLength: true, passwordRequireUppercase: true, passwordRequireNumbers: true, passwordRequireSpecial: true },
      });
      enabledModules = org?.enabledModules ?? [];
      subscriptionStatus = this._calcSubscriptionStatus(org);
      if (!mustChangePassword) {
        mustChangePassword = await this._checkPasswordExpiry(user, org?.passwordExpiryDays ?? null);
      }
      if (org) {
        passwordPolicy = {
          minLength:        org.passwordMinLength        ?? 8,
          requireUppercase: org.passwordRequireUppercase ?? false,
          requireNumbers:   org.passwordRequireNumbers   ?? false,
          requireSpecial:   org.passwordRequireSpecial   ?? false,
        };
      }
    }
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, organizationId: user.organizationId, enabledModules, subscriptionStatus, mustChangePassword, passwordPolicy };
  }

  /**
   * Sprawdza czy hasło użytkownika wygasło wg polityki org.
   * Jeśli tak — ustawia mustChangePassword=true w DB i zwraca true.
   * Bezpieczne przy null/undefined createdAt — fallback do now() = 0 dni.
   */
  private async _checkPasswordExpiry(user: User, passwordExpiryDays: number | null): Promise<boolean> {
    if (!passwordExpiryDays) return false;
    if (user.passwordHash === 'AZURE_SSO_ONLY' || user.passwordHash === 'GOOGLE_SSO_ONLY') return false;
    const lastChange: Date = user.passwordChangedAt ?? user.createdAt ?? new Date();
    const daysSince = Math.floor((Date.now() - lastChange.getTime()) / 86_400_000);
    if (daysSince < passwordExpiryDays) return false;
    await this.prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: true } });
    return true;
  }

  /**
   * Oblicza status subskrypcji org na podstawie daty wygaśnięcia.
   * Zwraca: null (aktywna/bezterminowa), 'expiring_soon' (≤14 dni), 'expired'.
   * trialEndsAt ma pierwszeństwo nad planExpiresAt.
   */
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

  /** Tworzy token zaproszenia i wysyła email z linkiem rejestracyjnym. Rzuca ConflictException jeśli email już istnieje. */
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

    const frontendUrl = this.config.get<string>('FRONTEND_URL');
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

  /** Finalizuje rejestrację przez token zaproszenia: tworzy nieaktywne konto, wysyła email weryfikacyjny. */
  async completeRegistration(opts: {
    token:     string;
    firstName: string;
    lastName:  string;
    password:  string;
  }) {
    const inv = await this.prisma.invitationToken.findUnique({
      where:   { token: opts.token },
      include: { organization: { select: { name: true } } },
    });
    if (!inv)           throw new NotFoundException('Nieprawidłowy token zaproszenia');
    if (inv.usedAt)     throw new BadRequestException('To zaproszenie zostało już wykorzystane');
    if (inv.expiresAt < new Date()) throw new BadRequestException('Zaproszenie wygasło');

    const emailLower = inv.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: emailLower } });
    if (existing) throw new ConflictException('Konto dla tego adresu email już istnieje');

    const hash = await bcrypt.hash(opts.password, 12);
    const verificationToken = randomBytes(32).toString('hex');

    await this.prisma.$transaction(async tx => {
      await tx.user.create({
        data: {
          email:                  emailLower,
          passwordHash:           hash,
          firstName:              opts.firstName,
          lastName:               opts.lastName,
          role:                   inv.role,
          organizationId:         inv.organizationId,
          isActive:               false,
          emailVerificationToken: verificationToken,
        },
      });
      await tx.invitationToken.update({
        where: { token: opts.token },
        data:  { usedAt: new Date() },
      });
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    const orgName = inv.organization?.name ?? 'Reserti';

    await this.mailer.send({
      to:      emailLower,
      subject: 'Potwierdź swój adres email — Reserti',
      html:    this.mailer.buildHtml({
        title:    'Potwierdź adres email',
        body:     `Cześć ${opts.firstName},<br><br>Twoje konto w organizacji <strong>${orgName}</strong> zostało założone. Kliknij poniższy przycisk, aby je aktywować.`,
        ctaLabel: 'Aktywuj konto',
        ctaUrl:   verifyUrl,
        footer:   'Link wygasa po 24 godzinach. Jeśli nie zakładałeś konta w Reserti, zignoruj tę wiadomość.',
      }),
    }, inv.organizationId);

    return { message: 'Konto utworzone. Sprawdź skrzynkę e-mail i kliknij link aktywacyjny.', email: emailLower, requiresVerification: true };
  }

  /** Cron: usuwa nieaktywowane konta i osierocone orgi po 24h. Wykonuje się codziennie o 3:00. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupUnverifiedAccounts() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const toDelete = await this.prisma.user.findMany({
      where: {
        isActive:               false,
        emailVerificationToken: { not: null },
        createdAt:              { lt: cutoff },
        role:                   { notIn: [UserRole.KIOSK] },
      },
      select: { id: true, email: true, organizationId: true },
    });

    for (const u of toDelete) {
      try {
        await this.prisma.$transaction(async tx => {
          if (u.organizationId) {
            await tx.subscriptionEvent.create({
              data: {
                organizationId: u.organizationId,
                type:           'email_unverified_deleted',
                note:           `Konto ${u.email} usunięte (brak weryfikacji emaila > 24h)`,
                metadata:       { userId: u.id, deletedBy: 'cron' },
              },
            });
          }
          await tx.user.delete({ where: { id: u.id } });
        });
      } catch (err) {
        this.logger.warn(`cleanupUnverifiedAccounts: failed to delete user ${u.id} (${u.email})`, err);
      }
    }
  }

  /** Zmienia hasło po weryfikacji obecnego. Waliduje złożoność wg polityki org. Unieważnia wszystkie refresh tokeny (wylogowanie ze wszystkich urządzeń). */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role === UserRole.KIOSK) {
      throw new ForbiddenException('Konto KIOSK nie może samodzielnie zmieniać hasła');
    }
    if (!await bcrypt.compare(currentPassword, user.passwordHash)) throw new UnauthorizedException('Current password is incorrect');
    if (await bcrypt.compare(newPassword, user.passwordHash)) throw new BadRequestException('New password must differ from current');

    const orgId = user.organizationId;
    if (orgId) {
      const org = await this.prisma.organization.findUnique({
        where:  { id: orgId },
        select: { passwordMinLength: true, passwordRequireUppercase: true, passwordRequireNumbers: true, passwordRequireSpecial: true },
      });
      if (org) this._validatePasswordComplexity(newPassword, org);
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash, mustChangePassword: false, passwordChangedAt: new Date() } });
    await this.prisma.refreshToken.deleteMany({ where: { userId } });
  }

  /**
   * Sprawdza złożoność hasła wg polityki organizacji.
   * Rzuca BadRequestException z kodem maszynowym (do i18n na frontendzie).
   */
  async registerOrg(dto: RegisterOrgDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail.toLowerCase() },
    });
    if (existing) throw new ConflictException('Email jest już zajęty');

    const base = dto.orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    const slugExists = await this.prisma.organization.findUnique({ where: { slug: base } });
    const slug = slugExists ? `${base}-${Date.now().toString(36)}` : base;

    const { org, user } = await this.prisma.$transaction(async tx => {
      const org = await tx.organization.create({
        data: {
          name:           dto.orgName,
          slug,
          plan:           'free',
          isActive:       true,
          enabledModules: ['DESKS'],
        },
      });
      const user = await tx.user.create({
        data: {
          email:          dto.adminEmail.toLowerCase(),
          passwordHash:   await bcrypt.hash(dto.password, 12),
          firstName:      dto.adminFirstName,
          lastName:       dto.adminLastName,
          role:           UserRole.SUPER_ADMIN,
          isActive:       true,
          organizationId: org.id,
        },
      });
      return { org, user };
    });

    // Zapisz event rejestracji
    await this.prisma.subscriptionEvent.create({
      data: {
        organizationId: org.id,
        type:           'org_registered',
        newPlan:        'free',
        note:           `Self-service rejestracja przez ${dto.adminEmail.toLowerCase()}`,
        metadata:       { source: 'self_service' },
      },
    }).catch(() => {});

    return {
      organizationId: org.id,
      userId:         user.id,
      message:        'Konto zostało założone. Możesz się teraz zalogować.',
    };
  }

  private _validatePasswordComplexity(
    password: string,
    policy: { passwordMinLength?: number | null; passwordRequireUppercase?: boolean; passwordRequireNumbers?: boolean; passwordRequireSpecial?: boolean },
  ) {
    const minLen = policy.passwordMinLength ?? 8;
    if (password.length < minLen)
      throw new BadRequestException(`PASSWORD_TOO_SHORT:${minLen}`);
    if (policy.passwordRequireUppercase && !/[A-Z]/.test(password))
      throw new BadRequestException('PASSWORD_REQUIRE_UPPERCASE');
    if (policy.passwordRequireNumbers && !/[0-9]/.test(password))
      throw new BadRequestException('PASSWORD_REQUIRE_NUMBERS');
    if (policy.passwordRequireSpecial && !/[^A-Za-z0-9]/.test(password))
      throw new BadRequestException('PASSWORD_REQUIRE_SPECIAL');
  }
}
