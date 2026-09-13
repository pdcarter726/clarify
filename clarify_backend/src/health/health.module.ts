import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';

/** Exposes the unauthenticated GET /healthz endpoint for uptime monitoring. */
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
