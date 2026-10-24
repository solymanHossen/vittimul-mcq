import { HealthIndicatorService } from '@nestjs/terminus';
import type { RedisService } from './redis.service';
import { RedisHealthIndicator } from './redis.health';

const mockPing = jest.fn();

function buildRedisService(): RedisService {
  return { client: { ping: mockPing } } as unknown as RedisService;
}

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;

  beforeEach(() => {
    jest.clearAllMocks();
    indicator = new RedisHealthIndicator(buildRedisService(), new HealthIndicatorService());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports healthy when PING resolves before the timeout', async () => {
    mockPing.mockResolvedValueOnce('PONG');

    const result = await indicator.isHealthy('redis');

    expect(result).toEqual({ redis: { status: 'up' } });
  });

  it('reports a sanitized down result when PING rejects', async () => {
    mockPing.mockRejectedValueOnce(new Error('connection refused'));

    const result = await indicator.isHealthy('redis');

    expect(result).toEqual({
      redis: { status: 'down', message: 'Redis is unavailable' },
    });
  });

  it('never leaks the raw internal error message to the caller', async () => {
    mockPing.mockRejectedValueOnce(new Error('NOAUTH Authentication required'));

    const result = await indicator.isHealthy('redis');

    expect(JSON.stringify(result)).not.toContain('NOAUTH');
  });

  it('times out and reports unhealthy when PING hangs indefinitely', async () => {
    jest.useFakeTimers();
    mockPing.mockImplementation(() => new Promise(() => undefined));

    const resultPromise = indicator.isHealthy('redis');

    await jest.advanceTimersByTimeAsync(2_000);

    await expect(resultPromise).resolves.toEqual({
      redis: { status: 'down', message: 'Redis is unavailable' },
    });
  });
});
