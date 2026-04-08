import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

/**
 * PrismaService — singleton klient bazy danych.
 *
 * Prisma 7 wymaga jawnego driver adaptera dla PostgreSQL.
 * Używamy @prisma/adapter-pg z połączeniem pg.Pool.
 * CONNECTION_POOL_SIZE konfigurowalne przez env (domyślnie 10).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max:              parseInt(process.env.DB_POOL_SIZE ?? '10', 10),
    });
    const adapter = new PrismaPg(pool);
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
