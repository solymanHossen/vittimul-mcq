import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from './redis.service';

/** Maximum milliseconds to wait for the PING before declaring degraded. */
const HEALTH_CHECK_TIMEOUT_MS = 2_000;

@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    let timeoutHandle: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.redisService.client.ping(),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(
            () =>
              reject(new Error(`Redis health check timed out after ${HEALTH_CHECK_TIMEOUT_MS}ms`)),
            HEALTH_CHECK_TIMEOUT_MS,
          );
        }),
      ]);

      return indicator.up();
    } catch (error: unknown) {
      const internalMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log the full detail internally for observability tooling.
      this.logger.error(`Redis health check failed: ${internalMessage}`);

      // Surface only a generic message externally — raw Redis errors must never
      // reach load-balancer health endpoints or public monitoring dashboards.
      // Terminus v12 only turns a *returned* down result into a 503; a thrown
      // error is treated as unexpected and yields a 500 instead.
      return indicator.down({ message: 'Redis is unavailable' });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
