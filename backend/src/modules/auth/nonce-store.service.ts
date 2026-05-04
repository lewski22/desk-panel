import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface NonceEntry { orgId: string; expiresAt: number; redirectUrl?: string; }

const NONCE_TTL_MS  = 10 * 60 * 1000; // 10 minutes
const NONCE_TTL_SEC = 600;

/**
 * NonceStoreService — stores OAuth2 nonces used for CSRF protection during
 * Google SSO flow. Uses Redis when REDIS_URL is configured (required for
 * multi-instance deployments); falls back to an in-memory Map for single
 * instance setups.
 */
@Injectable()
export class NonceStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NonceStoreService.name);
  private redis: import('ioredis').Redis | null = null;
  private readonly local = new Map<string, NonceEntry>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set — using in-memory nonce store (single-instance only)');
      return;
    }
    try {
      const { default: Redis } = await import('ioredis');
      this.redis = new Redis(url, { lazyConnect: true, enableReadyCheck: true });
      await this.redis.connect();
      this.logger.log('Nonce store connected to Redis');
    } catch (err: any) {
      this.logger.error(`Redis connect failed — falling back to in-memory: ${err.message}`);
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  async set(nonce: string, entry: Omit<NonceEntry, 'expiresAt'>) {
    const value: NonceEntry = { ...entry, expiresAt: Date.now() + NONCE_TTL_MS };
    if (this.redis) {
      await this.redis.set(`nonce:${nonce}`, JSON.stringify(value), 'EX', NONCE_TTL_SEC);
    } else {
      this.local.set(nonce, value);
      this._cleanupLocal();
    }
  }

  async get(nonce: string): Promise<NonceEntry | null> {
    if (this.redis) {
      const raw = await this.redis.get(`nonce:${nonce}`);
      return raw ? JSON.parse(raw) : null;
    }
    return this.local.get(nonce) ?? null;
  }

  async delete(nonce: string) {
    if (this.redis) {
      await this.redis.del(`nonce:${nonce}`);
    } else {
      this.local.delete(nonce);
    }
  }

  private _cleanupLocal() {
    const now = Date.now();
    for (const [k, v] of this.local.entries()) {
      if (v.expiresAt < now) this.local.delete(k);
    }
  }
}
