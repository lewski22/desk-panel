/**
 * PushService — Sprint G2
 * PWA Push Notifications przez Web Push API
 * Obsługuje subskrypcje i wysyłkę powiadomień
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }       from '@nestjs/config';
import { PrismaService }       from '../../database/prisma.service';

// web-push nie jest zainstalowany — używamy fetch do Web Push Protocol (RFC 8030)
// W produkcji: npm install web-push + dodaj import
// Tymczasowo: minimal implementation bez library

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private prisma:  PrismaService,
    private config:  ConfigService,
  ) {}

  // ── VAPID keys — generowane przy instalacji (env) ─────────────
  get vapidPublicKey() {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }

  // ── Zapisz subskrypcję ────────────────────────────────────────
  async subscribe(userId: string, dto: {
    endpoint: string; p256dh: string; auth: string; userAgent?: string;
  }) {
    // Upsert — endpoint jest unikalny
    return this.prisma.pushSubscription.upsert({
      where:  { endpoint: dto.endpoint },
      update: { userId, p256dh: dto.p256dh, auth: dto.auth, userAgent: dto.userAgent },
      create: { userId, ...dto },
    });
  }

  // ── Usuń subskrypcję (wylogowanie lub opt-out) ────────────────
  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  // ── Wyślij push do wszystkich subskrypcji użytkownika ─────────
  async notifyUser(userId: string, payload: {
    title: string; body: string; url?: string; icon?: string;
  }) {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subs.length === 0) return;

    const vapidPrivate = this.config.get<string>('VAPID_PRIVATE_KEY');
    const vapidSubject = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@reserti.pl';

    if (!vapidPrivate || !this.vapidPublicKey) {
      this.logger.warn('VAPID keys not configured — skipping push notification');
      return;
    }

    const msg = JSON.stringify({
      notification: {
        title: payload.title,
        body:  payload.body,
        icon:  payload.icon ?? '/icon-192.svg',
        badge: '/icon-192.svg',
        data:  { url: payload.url ?? '/dashboard' },
        actions: payload.url ? [{ action: 'open', title: 'Otwórz' }] : [],
      },
    });

    // Wyślij do każdej subskrypcji (fire-and-forget z error handling)
    await Promise.allSettled(
      subs.map(sub => this._sendPush(sub, msg, vapidPrivate, vapidSubject))
    );
  }

  private async _sendPush(sub: any, payload: string, vapidPrivate: string, subject: string) {
    try {
      // Użyj dynamic import żeby nie crashować gdy web-push nie jest zainstalowany
      const webpush = await import('web-push').catch(() => null);
      if (!webpush) {
        this.logger.warn('web-push not installed. Run: npm install web-push');
        return;
      }
      webpush.setVapidDetails(subject, this.vapidPublicKey, vapidPrivate);
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
    } catch (err: any) {
      if (err?.statusCode === 410) {
        // Subscription expired — usuń z DB
        await this.prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
        this.logger.log('Removed expired push subscription: ' + sub.endpoint.slice(0, 40));
      } else {
        this.logger.warn('Push send failed: ' + err?.message);
      }
    }
  }
}
