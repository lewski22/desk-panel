/**
 * SubscriptionsService — Sprint B
 * Status subskrypcji, limity, historia zmian, dashboard Owner
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService }         from '../../database/prisma.service';
import { InAppNotificationsService } from '../inapp-notifications/inapp-notifications.service';
import { NotificationsService }      from '../notifications/notifications.service';

// ── Definicja planów — limity i funkcje ──────────────────────
export const PLAN_LIMITS: Record<string, {
  desks: number | null; users: number | null;
  gateways: number | null; locations: number | null;
  ota: boolean; sso: boolean; smtp: boolean; api: boolean;
  label: string; color: string;
}> = {
  starter:    { desks: 10,   users: 25,   gateways: 1, locations: 1,    ota: false, sso: false, smtp: false, api: false, label: 'Starter',    color: 'zinc'   },
  trial:      { desks: 10,   users: 10,   gateways: 1, locations: 1,    ota: false, sso: false, smtp: false, api: false, label: 'Trial',      color: 'amber'  },
  pro:        { desks: 50,   users: 150,  gateways: 3, locations: 5,    ota: true,  sso: true,  smtp: true,  api: false, label: 'Pro',        color: 'indigo' },
  enterprise: { desks: null, users: null, gateways: null, locations: null, ota: true, sso: true, smtp: true, api: true, label: 'Enterprise', color: 'yellow' },
};

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma:   PrismaService,
    private inapp:    InAppNotificationsService,
    private notifications: NotificationsService,
  ) {}

  // ── Oblicz status subskrypcji ─────────────────────────────────
  private _calcStatus(org: any): 'active' | 'expiring_soon' | 'expired' | 'trial' | 'trial_expiring' {
    const now = new Date();
    if (org.trialEndsAt) {
      const daysLeft = Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86_400_000);
      if (daysLeft <= 0)  return 'expired';
      if (daysLeft <= 7)  return 'trial_expiring';
      return 'trial';
    }
    if (!org.planExpiresAt) return 'active'; // Enterprise bezterminowy
    const daysLeft = Math.ceil((org.planExpiresAt.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft <= 0)  return 'expired';
    if (daysLeft <= 14) return 'expiring_soon';
    return 'active';
  }

  private _daysUntilExpiry(org: any): number | null {
    const date = org.trialEndsAt ?? org.planExpiresAt;
    if (!date) return null;
    return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
  }

  // ── Pobierz status subskrypcji org ────────────────────────────
  async getStatus(organizationId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        id: true, name: true, plan: true, planExpiresAt: true, trialEndsAt: true,
        limitDesks: true, limitUsers: true, limitGateways: true, limitLocations: true,
        billingEmail: true, nextInvoiceAt: true,
        _count: {
          select: { locations: true, users: true },
        },
        locations: {
          where: { isActive: true },
          select: {
            gateways: { select: { id: true } },
            desks:    { where: { status: 'ACTIVE' }, select: { id: true } },
          },
        },
      },
    });

    const planDef = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.starter;

    // Limity: z DB jeśli ustawione, inaczej z planu
    const limitDesks     = org.limitDesks     ?? planDef.desks;
    const limitUsers     = org.limitUsers     ?? planDef.users;
    const limitGateways  = org.limitGateways  ?? planDef.gateways;
    const limitLocations = org.limitLocations ?? planDef.locations;

    // Aktualne użycie
    const usedDesks     = org.locations.reduce((sum, l) => sum + l.desks.length, 0);
    const usedGateways  = org.locations.reduce((sum, l) => sum + l.gateways.length, 0);
    const usedLocations = org._count.locations;
    const usedUsers     = org._count.users;

    const pct = (used: number, limit: number | null) =>
      limit === null ? 0 : Math.round((used / limit) * 100);

    const status       = this._calcStatus(org);
    const daysUntilExpiry = this._daysUntilExpiry(org);
    const warnings: string[] = [];

    // Ostrzeżenia > 80%
    if (limitDesks     && usedDesks     / limitDesks     > 0.8) warnings.push('desks_80pct');
    if (limitUsers     && usedUsers     / limitUsers     > 0.8) warnings.push('users_80pct');
    if (limitGateways  && usedGateways  / limitGateways  > 0.8) warnings.push('gateways_80pct');
    if (limitLocations && usedLocations / limitLocations > 0.8) warnings.push('locations_80pct');

    return {
      plan:          org.plan,
      planLabel:     planDef.label,
      planColor:     planDef.color,
      planExpiresAt: org.planExpiresAt,
      trialEndsAt:   org.trialEndsAt,
      daysUntilExpiry,
      status,
      billingEmail:  org.billingEmail,
      nextInvoiceAt: org.nextInvoiceAt,
      usage: {
        desks:     { used: usedDesks,     limit: limitDesks,     pct: pct(usedDesks,     limitDesks) },
        users:     { used: usedUsers,     limit: limitUsers,     pct: pct(usedUsers,     limitUsers) },
        gateways:  { used: usedGateways,  limit: limitGateways,  pct: pct(usedGateways,  limitGateways) },
        locations: { used: usedLocations, limit: limitLocations, pct: pct(usedLocations, limitLocations) },
      },
      features: {
        ota:  planDef.ota,
        sso:  planDef.sso,
        smtp: planDef.smtp,
        api:  planDef.api,
      },
      warnings,
    };
  }

  // ── Zmiana planu (Owner) ─────────────────────────────────────
  async updatePlan(organizationId: string, dto: {
    plan?: string; planExpiresAt?: string; trialEndsAt?: string;
    limitDesks?: number | null; limitUsers?: number | null;
    limitGateways?: number | null; limitLocations?: number | null;
    mrr?: number; billingEmail?: string; nextInvoiceAt?: string; note?: string;
  }, changedBy: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.plan           !== undefined && { plan:           dto.plan }),
        ...(dto.planExpiresAt  !== undefined && { planExpiresAt:  dto.planExpiresAt ? new Date(dto.planExpiresAt) : null }),
        ...(dto.trialEndsAt    !== undefined && { trialEndsAt:    dto.trialEndsAt   ? new Date(dto.trialEndsAt)   : null }),
        ...(dto.limitDesks     !== undefined && { limitDesks:     dto.limitDesks }),
        ...(dto.limitUsers     !== undefined && { limitUsers:     dto.limitUsers }),
        ...(dto.limitGateways  !== undefined && { limitGateways:  dto.limitGateways }),
        ...(dto.limitLocations !== undefined && { limitLocations: dto.limitLocations }),
        ...(dto.mrr            !== undefined && { mrr:            dto.mrr }),
        ...(dto.billingEmail   !== undefined && { billingEmail:   dto.billingEmail }),
        ...(dto.nextInvoiceAt  !== undefined && { nextInvoiceAt:  dto.nextInvoiceAt ? new Date(dto.nextInvoiceAt) : null }),
      },
    });

    // Zapisz event historii
    if (dto.plan && dto.plan !== org.plan) {
      await this.prisma.subscriptionEvent.create({
        data: {
          organizationId,
          type:         'plan_changed',
          previousPlan: org.plan,
          newPlan:      dto.plan,
          changedBy,
          note:         dto.note,
        },
      });
    } else if (dto.planExpiresAt || dto.mrr) {
      await this.prisma.subscriptionEvent.create({
        data: {
          organizationId,
          type:         'renewed',
          previousPlan: org.plan,
          newPlan:      org.plan,
          changedBy,
          note:         dto.note,
        },
      });
    }

    return this.getStatus(organizationId);
  }

  // ── Historia zmian ────────────────────────────────────────────
  async getEvents(organizationId: string) {
    return this.prisma.subscriptionEvent.findMany({
      where:   { organizationId },
      orderBy: { createdAt: 'desc' },
      take:    50,
    });
  }

  // ── Owner Dashboard — MRR + wygasające ───────────────────────
  async getDashboard() {
    const now     = new Date();
    const in14    = new Date(now.getTime() + 14 * 86_400_000);
    const in30    = new Date(now.getTime() + 30 * 86_400_000);

    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, slug: true, plan: true,
        planExpiresAt: true, trialEndsAt: true, mrr: true,
        _count: { select: { users: true } },
      },
    });

    const totalMrr = orgs.reduce((sum, o) => sum + (o.mrr ?? 0), 0);

    const expiringSoon  = orgs.filter(o => {
      const d = o.trialEndsAt ?? o.planExpiresAt;
      return d && d > now && d <= in14;
    });
    const expired = orgs.filter(o => {
      const d = o.trialEndsAt ?? o.planExpiresAt;
      return d && d <= now;
    });
    const onTrial = orgs.filter(o => o.trialEndsAt && o.trialEndsAt > now);

    return {
      totalMrr,
      totalActive:   orgs.length,
      expiringSoon:  expiringSoon.length,
      expired:       expired.length,
      onTrial:       onTrial.length,
      mrrByPlan: Object.fromEntries(
        ['starter','trial','pro','enterprise'].map(p => [
          p,
          orgs.filter(o => o.plan === p).reduce((s, o) => s + (o.mrr ?? 0), 0),
        ])
      ),
      expiringOrgs: expiringSoon.map(o => ({
        id: o.id, name: o.name, plan: o.plan,
        expiresAt:   o.trialEndsAt ?? o.planExpiresAt,
        daysLeft:    Math.ceil(((o.trialEndsAt ?? o.planExpiresAt)!.getTime() - now.getTime()) / 86_400_000),
        mrr:         o.mrr,
      })),
    };
  }

  // ── B4: Cron — sprawdzaj wygasające subskrypcje co 24h ────────
  @Cron('0 8 * * *', { name: 'check-expiring-subscriptions' }) // co dzień o 8:00
  async checkExpiringSubscriptions() {
    this.logger.log('Running subscription expiry check...');
    const now = new Date();

    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, plan: true,
        planExpiresAt: true, trialEndsAt: true,
        users: { where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null }, select: { id: true } },
      },
    });

    for (const org of orgs) {
      const expiryDate = org.trialEndsAt ?? org.planExpiresAt;
      if (!expiryDate) continue;

      const days = Math.ceil((expiryDate.getTime() - now.getTime()) / 86_400_000);
      const isTrial = !!org.trialEndsAt;
      const admins  = org.users.map(u => u.id);

      // Wybierz typ i trigger przy konkretnych dniach
      if ([30, 14, 7, 1].includes(days)) {
        const type = isTrial ? 'TRIAL_EXPIRING' : 'SUBSCRIPTION_EXPIRING';
        for (const userId of admins) {
          await this.inapp.create({
            organizationId: org.id,
            userId,
            type:  type as any,
            title: `Plan wygasa za ${days} ${days === 1 ? 'dzień' : 'dni'}`,
            body:  `${isTrial ? 'Trial' : 'Plan'} "${org.plan}" dla "${org.name}" wygasa ${expiryDate.toLocaleDateString('pl-PL')}.`,
            meta: {
              translations: {
                pl: { title: `Plan wygasa za ${days} ${days === 1 ? 'dzień' : 'dni'}`, body: `${isTrial ? 'Trial' : 'Plan'} "${org.plan}" wygasa ${expiryDate.toLocaleDateString('pl-PL')}.` },
                en: { title: `Plan expires in ${days} ${days === 1 ? 'day' : 'days'}`,  body: `Your "${org.plan}" plan expires on ${expiryDate.toLocaleDateString('en-GB')}.` },
              },
            },
            actionUrl: '/subscription',
          } as any, `sub:expiry:${org.id}:${days}`, 23 * 60);
        }
        this.logger.log(`Subscription expiry notified: ${org.name} (${days} days left)`);
      }

      // Wygasł dzisiaj
      if (days === 0 || days === -1) {
        for (const userId of admins) {
          await this.inapp.create({
            organizationId: org.id,
            userId,
            type:  'SUBSCRIPTION_EXPIRED' as any,
            title: 'Plan wygasł',
            body:  `Plan "${org.plan}" dla "${org.name}" wygasł.`,
            meta:  {},
            actionUrl: '/subscription',
          } as any, `sub:expired:${org.id}`, 48 * 60);
        }
      }
    }
  }

  // ── B4: Cron — sprawdzaj utilization co 6h ────────────────────
  @Cron('0 */6 * * *', { name: 'check-resource-limits' })
  async checkResourceLimits() {
    const orgs = await this.prisma.organization.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, plan: true,
        limitDesks: true, limitUsers: true, limitGateways: true, limitLocations: true,
        users: { where: { role: 'SUPER_ADMIN', isActive: true, deletedAt: null }, select: { id: true } },
        _count: { select: { locations: true, users: true } },
        locations: {
          where: { isActive: true },
          select: {
            gateways: { select: { id: true } },
            desks:    { where: { status: 'ACTIVE' }, select: { id: true } },
          },
        },
      },
    });

    for (const org of orgs) {
      const planDef = PLAN_LIMITS[org.plan] ?? PLAN_LIMITS.starter;
      const usedDesks    = org.locations.reduce((s, l) => s + l.desks.length, 0);
      const usedGateways = org.locations.reduce((s, l) => s + l.gateways.length, 0);

      const checks = [
        { name: 'desks',     used: usedDesks,           limit: org.limitDesks     ?? planDef.desks },
        { name: 'users',     used: org._count.users,    limit: org.limitUsers     ?? planDef.users },
        { name: 'gateways',  used: usedGateways,        limit: org.limitGateways  ?? planDef.gateways },
        { name: 'locations', used: org._count.locations, limit: org.limitLocations ?? planDef.locations },
      ];

      for (const { name, used, limit } of checks) {
        if (!limit) continue;
        const pct = (used / limit) * 100;
        if (pct < 80) continue;

        const threshold = pct >= 95 ? 95 : 80;
        for (const u of org.users) {
          await this.inapp.create({
            organizationId: org.id,
            userId: u.id,
            type: 'LIMIT_WARNING' as any,
            title: `Limit ${name}: ${Math.round(pct)}% wykorzystany`,
            body:  `Używasz ${used}/${limit} (${Math.round(pct)}%) zasobu "${name}" w "${org.name}".`,
            meta: {},
            actionUrl: '/subscription',
          } as any, `sub:limit:${org.id}:${name}:${threshold}`, 6 * 60);
        }
      }
    }
  }
}
