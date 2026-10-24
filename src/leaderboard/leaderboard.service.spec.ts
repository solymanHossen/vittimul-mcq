import { Test, type TestingModule } from '@nestjs/testing';
import { LeaderboardService } from './leaderboard.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { encodeCompositeScore } from './composite-score.util';

const mockRedisClient = {
  zadd: jest.fn(),
  zrevrange: jest.fn(),
  zcard: jest.fn(),
  zrevrank: jest.fn(),
  zscore: jest.fn(),
};

const mockPrisma = {
  exam: { findUniqueOrThrow: jest.fn() },
  user: { findMany: jest.fn() },
  $executeRaw: jest.fn(),
};

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaderboardService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: { client: mockRedisClient } },
      ],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
    jest.clearAllMocks();
  });

  describe('recordScore()', () => {
    it('encodes the composite score and writes it to the exam ZSET', async () => {
      await service.recordScore(7n, 42, 85.5, 1200);

      const expectedScore = encodeCompositeScore(85.5, 1200);
      expect(mockRedisClient.zadd).toHaveBeenCalledWith('leaderboard:exam:7', expectedScore, '42');
    });
  });

  describe('getLeaderboard()', () => {
    it('ranks entries by page position and enriches them with user details', async () => {
      const score1 = encodeCompositeScore(90, 1000);
      const score2 = encodeCompositeScore(80, 900);
      mockRedisClient.zrevrange.mockResolvedValueOnce(['1', String(score1), '2', String(score2)]);
      mockRedisClient.zcard.mockResolvedValueOnce(2);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 1, name: 'Alice', institutionName: 'Dhaka College', avatarUrl: null },
        { id: 2, name: 'Bob', institutionName: null, avatarUrl: null },
      ]);

      const result = await service.getLeaderboard(7n, { page: 1, limit: 20 });

      expect(result.items).toEqual([
        {
          rank: 1,
          userId: 1,
          name: 'Alice',
          institutionName: 'Dhaka College',
          avatarUrl: null,
          obtainedScore: 90,
          timeTakenSeconds: 1000,
        },
        {
          rank: 2,
          userId: 2,
          name: 'Bob',
          institutionName: null,
          avatarUrl: null,
          obtainedScore: 80,
          timeTakenSeconds: 900,
        },
      ]);
      expect(result.total).toBe(2);
      expect(result.currentUser).toBeNull();
    });

    it('computes rank offsets correctly for page > 1', async () => {
      const score = encodeCompositeScore(70, 500);
      mockRedisClient.zrevrange.mockResolvedValueOnce(['5', String(score)]);
      mockRedisClient.zcard.mockResolvedValueOnce(25);
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 5, name: 'Carol', institutionName: null, avatarUrl: null },
      ]);

      const result = await service.getLeaderboard(7n, { page: 2, limit: 20 });

      expect(result.items[0]?.rank).toBe(21);
    });

    it('skips the user lookup entirely when the page has no entries', async () => {
      mockRedisClient.zrevrange.mockResolvedValueOnce([]);
      mockRedisClient.zcard.mockResolvedValueOnce(0);

      const result = await service.getLeaderboard(7n, { page: 1, limit: 20 });

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
    });

    it("includes the current user's standing and percentile when present on the leaderboard", async () => {
      mockRedisClient.zrevrange.mockResolvedValueOnce([]);
      mockRedisClient.zcard.mockResolvedValueOnce(10);
      mockRedisClient.zrevrank.mockResolvedValueOnce(4); // 0-based rank 4 -> 1-based 5
      mockRedisClient.zscore.mockResolvedValueOnce(String(encodeCompositeScore(60, 2000)));

      const result = await service.getLeaderboard(7n, { page: 1, limit: 20 }, 99);

      expect(result.currentUser).toEqual({
        rank: 5,
        obtainedScore: 60,
        timeTakenSeconds: 2000,
        percentile: 50,
      });
    });

    it('returns a null currentUser when the given user has no entry on the leaderboard', async () => {
      mockRedisClient.zrevrange.mockResolvedValueOnce([]);
      mockRedisClient.zcard.mockResolvedValueOnce(10);
      mockRedisClient.zrevrank.mockResolvedValueOnce(null);
      mockRedisClient.zscore.mockResolvedValueOnce(null);

      const result = await service.getLeaderboard(7n, { page: 1, limit: 20 }, 99);

      expect(result.currentUser).toBeNull();
    });

    it('returns a null currentUser without any rank lookup when the leaderboard is empty', async () => {
      mockRedisClient.zrevrange.mockResolvedValueOnce([]);
      mockRedisClient.zcard.mockResolvedValueOnce(0);

      const result = await service.getLeaderboard(7n, { page: 1, limit: 20 }, 99);

      expect(mockRedisClient.zrevrank).not.toHaveBeenCalled();
      expect(result.currentUser).toBeNull();
    });
  });

  describe('finalizeExam()', () => {
    it('runs the ranking update and skips tournament aggregation for a non-tournament exam', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({ tournamentId: null });
      mockPrisma.$executeRaw.mockResolvedValueOnce(12);

      const result = await service.finalizeExam(7n);

      expect(result).toEqual({ updatedAttempts: 12 });
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('also aggregates TournamentRanking when the exam belongs to a tournament', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({ tournamentId: 3 });
      mockPrisma.$executeRaw.mockResolvedValueOnce(12).mockResolvedValueOnce(5);

      await service.finalizeExam(7n);

      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
    });
  });
});
