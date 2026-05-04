/**
 * PrismaService — adapter NestJS dla Prisma ORM.
 *
 * Rozszerza PrismaClient o cykl życia modułu NestJS: nawiązuje połączenie
 * z PostgreSQL przy starcie aplikacji i rozłącza przy zamknięciu.
 * Wstrzykuj w konstruktorach zamiast bezpośrednio używać PrismaClient.
 *
 * backend/src/database/prisma.service.ts
 */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit()    { await this.$connect(); }
  async onModuleDestroy() { await this.$disconnect(); }
}
