import { Test, type TestingModule } from '@nestjs/testing';
import { CompassService } from './compass.service';
import { PrismaService } from '../database/prisma.service';

function decimal(value: number) {
  return { toNumber: () => value };
}

const mockPrisma = {
  userStreak: { findUnique: jest.fn() },
  userDailyActivity: { findMany: jest.fn() },
  subject: { findMany: jest.fn() },
  userSyllabusTracker: { findMany: jest.fn(), upsert: jest.fn() },
  category: { findMany: jest.fn() },
};

describe('CompassService', () => {
  let service: CompassService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompassService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CompassService>(CompassService);
    jest.clearAllMocks();
  });

  describe('getDashboard()', () => {
    it('falls back to zeroed streak defaults when the user has no UserStreak row yet', async () => {
      mockPrisma.userStreak.findUnique.mockResolvedValueOnce(null);
      mockPrisma.userDailyActivity.findMany.mockResolvedValueOnce([]);
      mockPrisma.subject.findMany.mockResolvedValueOnce([]);
      mockPrisma.userSyllabusTracker.findMany.mockResolvedValueOnce([]);

      const result = await service.getDashboard(1);

      expect(result.streak).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        streakFreezeCount: 0,
        lastActivityDate: null,
        totalExamsGiven: 0,
        totalQuestionsSolved: 0,
        totalStudyMinutes: 0,
      });
    });

    it('computes subject completion percentages from completed topics vs total topics', async () => {
      mockPrisma.userStreak.findUnique.mockResolvedValueOnce(null);
      mockPrisma.userDailyActivity.findMany.mockResolvedValueOnce([]);
      mockPrisma.subject.findMany.mockResolvedValueOnce([
        {
          id: 1,
          name: 'English',
          categoryId: 10,
          topics: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
        },
      ]);
      mockPrisma.userSyllabusTracker.findMany.mockResolvedValueOnce([
        { topicId: 1 },
        { topicId: 2 },
      ]);
      mockPrisma.category.findMany.mockResolvedValueOnce([{ id: 10, name: 'Bank Job Prep' }]);

      const result = await service.getDashboard(1);

      expect(result.subjectCompletion).toEqual([
        {
          subjectId: 1,
          subjectName: 'English',
          categoryId: 10,
          totalTopics: 4,
          completedTopics: 2,
          completionPercent: 50,
        },
      ]);
      expect(result.categoryCompletion).toEqual([
        {
          categoryId: 10,
          categoryName: 'Bank Job Prep',
          totalTopics: 4,
          completedTopics: 2,
          completionPercent: 50,
        },
      ]);
    });

    it('reports 0% completion for a subject with no active topics, without dividing by zero', async () => {
      mockPrisma.userStreak.findUnique.mockResolvedValueOnce(null);
      mockPrisma.userDailyActivity.findMany.mockResolvedValueOnce([]);
      mockPrisma.subject.findMany.mockResolvedValueOnce([
        { id: 1, name: 'Empty Subject', categoryId: null, topics: [] },
      ]);
      mockPrisma.userSyllabusTracker.findMany.mockResolvedValueOnce([]);

      const result = await service.getDashboard(1);

      expect(result.subjectCompletion[0]?.completionPercent).toBe(0);
      expect(result.categoryCompletion).toEqual([]); // null categoryId excluded entirely
    });
  });

  describe('upsertSyllabusTracker()', () => {
    it('sets completedAt when marking a topic complete', async () => {
      mockPrisma.userSyllabusTracker.upsert.mockResolvedValueOnce({
        topicId: 1,
        isCompleted: true,
        confidenceRating: 4,
        questionsAttempted: 0,
        accuracyPercent: decimal(0),
        revisionCount: 0,
        notes: null,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      await service.upsertSyllabusTracker(1, 1, { isCompleted: true, confidenceRating: 4 });

      expect(mockPrisma.userSyllabusTracker.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCompleted: true, completedAt: expect.any(Date) }),
          update: expect.objectContaining({ isCompleted: true, completedAt: expect.any(Date) }),
        }),
      );
    });

    it('only touches the fields present in the dto on update', async () => {
      mockPrisma.userSyllabusTracker.upsert.mockResolvedValueOnce({
        topicId: 1,
        isCompleted: false,
        confidenceRating: null,
        questionsAttempted: 0,
        accuracyPercent: decimal(0),
        revisionCount: 3,
        notes: null,
        completedAt: null,
        updatedAt: new Date(),
      });

      await service.upsertSyllabusTracker(1, 1, { revisionCount: 3 });

      expect(mockPrisma.userSyllabusTracker.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { revisionCount: 3 } }),
      );
    });
  });
});
