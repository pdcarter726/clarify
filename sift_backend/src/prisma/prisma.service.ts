import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

/**
 * Prisma client bound to the MariaDB adapter (DATABASE_URL), connected on
 * module init and cleanly disconnected on module destroy. Inject this to
 * access all Prisma model delegates (recipe, user, tag, etc.).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaMariaDb(process.env.DATABASE_URL as string),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
