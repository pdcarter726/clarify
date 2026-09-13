import {
  Controller,
  Get,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unauthenticated liveness endpoint for uptime monitors. Pings the database
 * so a reachable API with a dead database still reports as down.
 */
@Controller('healthz')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns 200 `{ status: 'ok' }` when the database responds.
   * @throws ServiceUnavailableException (503) if the database query fails.
   */
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      this.logger.error(`Database health check failed: ${String(error)}`);
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
    return { status: 'ok', database: 'up' };
  }
}
