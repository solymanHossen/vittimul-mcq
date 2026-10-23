import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from './prisma.service';

/** Maximum milliseconds to wait for the health-check query before declaring degraded. */
const HEALTH_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class DatabaseHealthIndicator {
  private readonly logger = new Logger(DatabaseHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(
                new Error(`Database health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`),
              ),
            HEALTH_CHECK_TIMEOUT_MS,
          );
        }),
      ]);

      return indicator.up();
    } catch (error: unknown) {
      const internalMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log the full detail internally for observability tooling.
      this.logger.error(`Database health check failed: ${internalMessage}`);

      // Surface only a generic message externally — raw DB errors must never
      // reach load-balancer health endpoints or public monitoring dashboards.
      // Terminus v12 only turns a *returned* down result into a 503; a thrown
      // error is treated as unexpected and yields a 500 instead.
      return indicator.down({ message: 'Database is unavailable' });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
