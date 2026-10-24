import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockLeaderboardService = {
  getLeaderboard: jest.fn(),
  finalizeExam: jest.fn(),
};

const currentUser: AuthUser = {
  id: 99,
  email: 'user@example.com',
  role: Role.USER,
  isActive: true,
};

describe('LeaderboardController', () => {
  let controller: LeaderboardController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaderboardController],
      providers: [{ provide: LeaderboardService, useValue: mockLeaderboardService }],
    }).compile();

    controller = module.get<LeaderboardController>(LeaderboardController);
    jest.clearAllMocks();
  });

  it('getLeaderboard() forwards examId, query, and the current user id to the service', async () => {
    mockLeaderboardService.getLeaderboard.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      currentUser: null,
    });

    const result = await controller.getLeaderboard(7n, { page: 1, limit: 20 }, currentUser);

    expect(mockLeaderboardService.getLeaderboard).toHaveBeenCalledWith(
      7n,
      { page: 1, limit: 20 },
      99,
    );
    expect(result.data.currentUser).toBeNull();
  });

  it('finalizeExam() reports the updated attempt count in the message', async () => {
    mockLeaderboardService.finalizeExam.mockResolvedValueOnce({ updatedAttempts: 42 });

    const result = await controller.finalizeExam(7n);

    expect(mockLeaderboardService.finalizeExam).toHaveBeenCalledWith(7n);
    expect(result.message).toBe('42 attempts finalized');
  });
});
