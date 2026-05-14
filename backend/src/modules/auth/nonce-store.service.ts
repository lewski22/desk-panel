import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface NonceEntry { orgId: string; expiresAt: number; redirectUrl?: string; }

const NONCE_TTL_MS  = 10 * 60 * 1000; // 10 minutes
const NONCE_TTL_SEC = 600;

const XCODE_TTL_MS  = 60 * 1000; // 60 seconds — one-time exchange code
const XCODE_TTL_SEC = 60;

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
  private readonly local      = new Map<string, NonceEntry>();
  private readonly localXcode = new Map<string, string>();

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

  // ── Exchange code store (60s TTL) ────────────────────────────

  async setExchangeCode(code: string, payload: object): Promise<void> {
    const raw = JSON.stringify({ ...payload, _expiresAt: Date.now() + XCODE_TTL_MS });
    if (this.redis) {
      await this.redis.set(`xcode:${code}`, raw, 'EX', XCODE_TTL_SEC);
    } else {
      this.localXcode.set(code, raw);
    }
  }

  async getAndDeleteExchangeCode(code: string): Promise<Record<string, unknown> | null> {
    if (this.redis) {
      const raw = await this.redis.getdel(`xcode:${code}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed._expiresAt < Date.now()) return null;
      return parsed;
    }
    const raw = this.localXcode.get(code);
    this.localXcode.delete(code);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed._expiresAt < Date.now()) return null;
    return parsed;
  }

  private _cleanupLocal() {
    const now = Date.now();
    for (const [k, v] of this.local.entries()) {
      if (v.expiresAt < now) this.local.delete(k);
    }
  }
}
