import { Test, type TestingModule } from '@nestjs/testing';
import { SrsService } from './srs.service';
import { PrismaService } from '../database/prisma.service';

function decimal(value: number) {
  return { toNumber: () => value };
}

const mockPrisma = {
  spacedRepetitionQueue: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
  userFavorite: { upsert: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
};

describe('SrsService', () => {
  let service: SrsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SrsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SrsService>(SrsService);
    jest.clearAllMocks();
  });

  describe('getDueQuestions()', () => {
    it('maps rows into fully-detailed due questions, including isCorrect', async () => {
      mockPrisma.spacedRepetitionQueue.findMany.mockResolvedValueOnce([
        {
          repetitionNumber: 1,
          intervalDays: 6,
          easeFactor: decimal(2.5),
          nextReviewDate: new Date('2026-01-01'),
          question: {
            id: 2n,
            questionText: 'Q1',
            questionImageUrl: null,
            textExplanation: 'Because...',
            explanationImageUrl: null,
            difficulty: 'EASY',
            isMultipleChoice: false,
            options: [
              { id: 5n, optionLabel: 'A', optionText: 'X', optionImageUrl: null, isCorrect: true },
            ],
          },
        },
      ]);

      const result = await service.getDueQuestions(1);

      expect(result).toEqual([
        expect.objectContaining({
          questionId: '2',
          easeFactor: 2.5,
          options: [
            { id: '5', optionLabel: 'A', optionText: 'X', optionImageUrl: null, isCorrect: true },
          ],
        }),
      ]);
      expect(mockPrisma.spacedRepetitionQueue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1, isMastered: false, nextReviewDate: { lte: expect.any(Date) } },
        }),
      );
    });
  });

  describe('reviewQuestion()', () => {
    it('seeds SM-2 defaults (repetitionNumber 0, easeFactor 2.5) for a never-reviewed question', async () => {
      mockPrisma.spacedRepetitionQueue.findUnique.mockResolvedValueOnce(null);
      mockPrisma.spacedRepetitionQueue.upsert.mockResolvedValueOnce({
        questionId: 2n,
        repetitionNumber: 1,
        lapsesCount: 0,
        intervalDays: 1,
        easeFactor: decimal(2.6),
        nextReviewDate: new Date(),
        isMastered: false,
        lastReviewedAt: new Date(),
      });

      await service.reviewQuestion(1, { questionId: '2', qualityGrade: 5 });

      expect(mockPrisma.spacedRepetitionQueue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            repetitionNumber: 1,
            intervalDays: 1,
            easeFactor: 2.6,
          }),
        }),
      );
    });

    it('continues from the existing SM-2 state and increments lapsesCount on a failing grade', async () => {
      mockPrisma.spacedRepetitionQueue.findUnique.mockResolvedValueOnce({
        repetitionNumber: 3,
        easeFactor: decimal(2.3),
        intervalDays: 15,
      });
      mockPrisma.spacedRepetitionQueue.upsert.mockResolvedValueOnce({
        questionId: 2n,
        repetitionNumber: 0,
        lapsesCount: 1,
        intervalDays: 1,
        easeFactor: decimal(1.7),
        nextReviewDate: new Date(),
        isMastered: false,
        lastReviewedAt: new Date(),
      });

      await service.reviewQuestion(1, { questionId: '2', qualityGrade: 0 });

      expect(mockPrisma.spacedRepetitionQueue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            repetitionNumber: 0,
            lapsesCount: { increment: 1 },
          }),
        }),
      );
    });
  });

  describe('favorites', () => {
    it('upsertFavorite() defaults folderName to Default when omitted', async () => {
      mockPrisma.userFavorite.upsert.mockResolvedValueOnce({
        questionId: 2n,
        folderName: 'Default',
        personalNote: null,
        createdAt: new Date(),
        question: { questionText: 'Q1' },
      });

      const result = await service.upsertFavorite(1, { questionId: '2' });

      expect(mockPrisma.userFavorite.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ folderName: 'Default' }) }),
      );
      expect(result.folderName).toBe('Default');
    });

    it('deleteFavorite() delegates to the composite-key delete', async () => {
      mockPrisma.userFavorite.delete.mockResolvedValueOnce({});

      await service.deleteFavorite(1, 2n);

      expect(mockPrisma.userFavorite.delete).toHaveBeenCalledWith({
        where: { userId_questionId: { userId: 1, questionId: 2n } },
      });
    });
  });
});
