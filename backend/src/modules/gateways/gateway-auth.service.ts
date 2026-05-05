import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual, createHmac } from 'crypto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class GatewayAuthService {
  private readonly logger = new Logger(GatewayAuthService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
  ) {}

  async exchange(gatewayId: string, ts: number, sig: string): Promise<string> {
    const drift = Math.abs(Math.floor(Date.now() / 1000) - ts);
    if (drift > 30) {
      this.logger.warn(`Gateway auth: timestamp drift ${drift}s — gatewayId=${gatewayId}`);
      throw new UnauthorizedException('invalid credentials');
    }

    const gateway = await this.prisma.gateway.findUnique({
      where:  { id: gatewayId },
      select: { id: true, secretRaw: true, isOnline: true },
    });

    if (!gateway?.secretRaw) {
      this.logger.warn(`Gateway auth: not found or secretRaw missing — gatewayId=${gatewayId}`);
      throw new UnauthorizedException('invalid credentials');
    }

    const expected = createHmac('sha256', gateway.secretRaw)
      .update(`${gatewayId}:${ts}`)
      .digest('hex');

    let valid = false;
    try {
      valid = timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(sig,      'hex'),
      );
    } catch {
      valid = false;
    }

    if (!valid) {
      this.logger.warn(`Gateway auth: HMAC mismatch — gatewayId=${gatewayId}`);
      throw new UnauthorizedException('invalid credentials');
    }

    const accessToken = this.jwt.sign(
      { sub: gatewayId, scope: 'gateway' },
      {
        secret:    this.config.getOrThrow<string>('JWT_GATEWAY_SECRET'),
        expiresIn: '60m',
      },
    );

    this.logger.log(`Gateway auth: token issued — gatewayId=${gatewayId}`);
    return accessToken;
  }
}
