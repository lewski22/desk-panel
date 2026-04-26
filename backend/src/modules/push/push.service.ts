import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  onModuleInit() {
  const publicKey  = this.config.get<string>('VAPID_PUBLIC_KEY');
  const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
  const subject    = this.config.get<string>('VAPID_SUBJECT') ?? 'mailto:admin@localhost';

  if (publicKey && privateKey) {
    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('VAPID keys configured — push notifications enabled');
    } catch (err) {
      this.logger.error(
        `VAPID key validation failed — push disabled. Check VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY. ${err.message}`,
      );
    }
  } else {
    this.logger.warn('VAPID keys not configured — push notifications disabled');
  }
}

  get vapidPublicKey() {
    return this.config.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }

  async subscribe(userId: string, dto: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) {
    return this.prisma.pushSubscription.upsert({
      where:  { endpoint: dto.endpoint },
      update: { userId, ...dto },
      create: { userId, ...dto },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async countSubscriptions(): Promise<number> {
    return this.prisma.pushSubscription.count();
  }

  async notifyUser(userId: string, payload: { title: string; body: string; url?: string }) {
    if (!this.vapidPublicKey) {
      this.logger.warn(`notifyUser(${userId}) skipped — VAPID keys not configured`);
      return;
    }

    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (!subs.length) return;

    const message = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url });

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message,
        ),
      ),
    );

    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length) {
      this.logger.warn(`Push to user ${userId}: ${failed.length}/${subs.length} failed`);
    }

    // Clean up expired/invalid subscriptions (410 Gone)
    const expiredEndpoints: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason as any;
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          expiredEndpoints.push(subs[i].endpoint);
        }
      }
    });

    if (expiredEndpoints.length) {
      await this.prisma.pushSubscription.deleteMany({
        where: { endpoint: { in: expiredEndpoints } },
      });
    }
  }
}
