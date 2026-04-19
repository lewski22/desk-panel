import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  constructor(private prisma: PrismaService, private config: ConfigService) {}
  get vapidPublicKey() { return this.config.get<string>('VAPID_PUBLIC_KEY')??''; }
  async subscribe(userId: string, dto: {endpoint:string;p256dh:string;auth:string;userAgent?:string}) {
    return this.prisma.pushSubscription.upsert({ where:{endpoint:dto.endpoint}, update:{userId,...dto}, create:{userId,...dto} });
  }
  async unsubscribe(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({where:{userId,endpoint}});
  }
  async notifyUser(userId: string, payload: {title:string;body:string;url?:string}) {
    const subs=await this.prisma.pushSubscription.findMany({where:{userId}});
    if(!subs.length) return;
    this.logger.log(`Push ${userId}: ${payload.title}`);
  }
}
