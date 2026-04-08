import { Controller, Get, ForbiddenException, Req } from '@nestjs/common';
import { Request } from 'express';
import { register } from './metrics.registry';
import { ConfigService } from '@nestjs/config';

/**
 * MetricsController — endpoint /metrics dla Prometheus.
 *
 * Chroniony IP whitelist — nie wymaga JWT (Prometheus scraper
 * nie obsługuje tokenów). Skonfiguruj w .env:
 *   METRICS_ALLOWED_IPS=127.0.0.1,10.0.0.5
 *
 * Gdy METRICS_ALLOWED_IPS nie jest ustawione → localhost only.
 * Endpoint jest poza prefixem /api/v1 (patrz app.module.ts).
 */
@Controller()
export class MetricsController {
  private readonly allowedIps: string[];

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('METRICS_ALLOWED_IPS') ?? '127.0.0.1,::1';
    this.allowedIps = raw.split(',').map(ip => ip.trim()).filter(Boolean);
  }

  @Get('metrics')
  async getMetrics(@Req() req: Request): Promise<string> {
    const clientIp = (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket.remoteAddress ??
      ''
    );

    if (!this.allowedIps.includes(clientIp)) {
      throw new ForbiddenException(
        `Metrics endpoint not accessible from ${clientIp}. ` +
        `Set METRICS_ALLOWED_IPS env var to allow this IP.`
      );
    }

    return register.metrics();
  }

  @Get('health')
  getHealth(): object {
    return { ok: true, ts: new Date().toISOString() };
  }
}
