import { HealthIndicatorService } from '@nestjs/terminus';
import type { PrismaService } from './prisma.service';
import { DatabaseHealthIndicator } from './db.health';

const mockQueryRaw = jest.fn();

function buildPrismaService(): PrismaService {
  return { $queryRaw: mockQueryRaw } as unknown as PrismaService;
}

describe('DatabaseHealthIndicator', () => {
  let indicator: DatabaseHealthIndicator;

  beforeEach(() => {
    jest.clearAllMocks();
    indicator = new DatabaseHealthIndicator(buildPrismaService(), new HealthIndicatorService());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports healthy when the query resolves before the timeout', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    const result = await indicator.isHealthy('postgres');

    expect(result).toEqual({ postgres: { status: 'up' } });
  });

  it('reports a sanitized down result when the query rejects', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('connection refused'));

    const result = await indicator.isHealthy('postgres');

    expect(result).toEqual({
      postgres: { status: 'down', message: 'Database is unavailable' },
    });
  });

  it('never leaks the raw internal error message to the caller', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('password authentication failed for user "app"'));

    const result = await indicator.isHealthy('postgres');

    expect(JSON.stringify(result)).not.toContain('password authentication failed');
  });

  it('times out and reports unhealthy when the query hangs indefinitely', async () => {
    jest.useFakeTimers();
    mockQueryRaw.mockImplementation(() => new Promise(() => undefined));

    const resultPromise = indicator.isHealthy('postgres');

    await jest.advanceTimersByTimeAsync(2_000);

    await expect(resultPromise).resolves.toEqual({
      postgres: { status: 'down', message: 'Database is unavailable' },
    });
  });
});
