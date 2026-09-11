import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Exposes the shared PrismaService (database client) to the rest of the app. */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
