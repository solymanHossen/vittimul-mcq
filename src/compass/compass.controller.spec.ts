import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { CompassController } from './compass.controller';
import { CompassService } from './compass.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockCompassService = {
  getDashboard: jest.fn(),
  upsertSyllabusTracker: jest.fn(),
};

const user: AuthUser = { id: 1, email: 'user@example.com', role: Role.USER, isActive: true };

describe('CompassController', () => {
  let controller: CompassController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CompassController],
      providers: [{ provide: CompassService, useValue: mockCompassService }],
    }).compile();

    controller = module.get<CompassController>(CompassController);
    jest.clearAllMocks();
  });

  it('getDashboard() forwards the current user id', async () => {
    mockCompassService.getDashboard.mockResolvedValueOnce({
      streak: {
        currentStreak: 0,
        longestStreak: 0,
        streakFreezeCount: 0,
        lastActivityDate: null,
        totalExamsGiven: 0,
        totalQuestionsSolved: 0,
        totalStudyMinutes: 0,
      },
      heatmap: [],
      subjectCompletion: [],
      categoryCompletion: [],
    });

    await controller.getDashboard(user);

    expect(mockCompassService.getDashboard).toHaveBeenCalledWith(1);
  });

  it('updateSyllabus() forwards the numeric topicId, dto, and current user id', async () => {
    mockCompassService.upsertSyllabusTracker.mockResolvedValueOnce({
      topicId: 1,
      isCompleted: true,
      confidenceRating: 4,
      questionsAttempted: 0,
      accuracyPercent: 0,
      revisionCount: 0,
      notes: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    });

    await controller.updateSyllabus(1, { isCompleted: true }, user);

    expect(mockCompassService.upsertSyllabusTracker).toHaveBeenCalledWith(1, 1, {
      isCompleted: true,
    });
  });
});
