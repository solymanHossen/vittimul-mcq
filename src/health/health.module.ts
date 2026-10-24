import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from '../database/db.health';
import { RedisHealthIndicator } from '../common/redis/redis.health';

// MemoryHealthIndicator is provided and exported by TerminusModule — no manual
// registration required. It is injected directly in HealthController.
// RedisService itself comes from the global RedisModule — only the indicator
// wrapper is registered here, alongside DatabaseHealthIndicator, since this is
// where TerminusModule's HealthIndicatorService is in scope.

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
