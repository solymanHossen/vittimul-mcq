import { Test, type TestingModule } from '@nestjs/testing';
import { VocabularyService } from './vocabulary.service';
import { PrismaService } from '../database/prisma.service';

const CARD_ROW = {
  id: 1n,
  topicId: null,
  word: 'Ubiquitous',
  pronunciationIpa: null,
  partOfSpeech: null,
  englishDefinition: null,
  bengaliMeaning: 'সর্বব্যাপী',
  synonyms: [],
  antonyms: [],
  mnemonicTrick: null,
  exampleSentence: null,
  audioPronounceUrl: null,
  difficulty: 'MEDIUM',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  vocabularyCard: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  userVocabularyProgress: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
};

describe('VocabularyService', () => {
  let service: VocabularyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VocabularyService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<VocabularyService>(VocabularyService);
    jest.clearAllMocks();
  });

  describe('getDueCards()', () => {
    it('returns due-progress cards and tops up with new cards up to the cap', async () => {
      mockPrisma.userVocabularyProgress.findMany
        .mockResolvedValueOnce([{ leitnerBox: 3, card: CARD_ROW }]) // due progress
        .mockResolvedValueOnce([{ cardId: 1n }]); // touched card ids
      mockPrisma.vocabularyCard.findMany.mockResolvedValueOnce([
        { ...CARD_ROW, id: 2n, word: 'New Word' },
      ]);

      const result = await service.getDueCards(1);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ id: '1', leitnerBox: 3, isNew: false });
      expect(result[1]).toMatchObject({ id: '2', leitnerBox: 1, isNew: true });
    });

    it('excludes cards the user has already touched from the "new" top-up query', async () => {
      mockPrisma.userVocabularyProgress.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ cardId: 5n }, { cardId: 6n }]);
      mockPrisma.vocabularyCard.findMany.mockResolvedValueOnce([]);

      await service.getDueCards(1);

      expect(mockPrisma.vocabularyCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { notIn: [5n, 6n] } }),
        }),
      );
    });

    it('skips the new-card lookup entirely once the due-progress set already fills the cap', async () => {
      const fullPage = Array.from({ length: 50 }, (_, i) => ({
        leitnerBox: 1,
        card: { ...CARD_ROW, id: BigInt(i + 1) },
      }));
      mockPrisma.userVocabularyProgress.findMany.mockResolvedValueOnce(fullPage);

      const result = await service.getDueCards(1);

      expect(result).toHaveLength(50);
      expect(mockPrisma.vocabularyCard.findMany).not.toHaveBeenCalled();
    });
  });

  describe('reviewCard()', () => {
    it('seeds box 1 for a never-reviewed card', async () => {
      mockPrisma.userVocabularyProgress.findUnique.mockResolvedValueOnce(null);
      mockPrisma.userVocabularyProgress.upsert.mockResolvedValueOnce({
        cardId: 1n,
        leitnerBox: 2,
        correctStreak: 1,
        wrongCount: 0,
        isMastered: false,
        nextReviewDate: new Date(),
        lastReviewedAt: new Date(),
      });

      await service.reviewCard(1, { cardId: '1', isRemembered: true });

      expect(mockPrisma.userVocabularyProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ leitnerBox: 2, correctStreak: 1, wrongCount: 0 }),
        }),
      );
    });

    it('resets to box 1 and increments wrongCount on a forgotten card', async () => {
      mockPrisma.userVocabularyProgress.findUnique.mockResolvedValueOnce({
        leitnerBox: 4,
        correctStreak: 3,
      });
      mockPrisma.userVocabularyProgress.upsert.mockResolvedValueOnce({
        cardId: 1n,
        leitnerBox: 1,
        correctStreak: 0,
        wrongCount: 1,
        isMastered: false,
        nextReviewDate: new Date(),
        lastReviewedAt: new Date(),
      });

      await service.reviewCard(1, { cardId: '1', isRemembered: false });

      expect(mockPrisma.userVocabularyProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            leitnerBox: 1,
            correctStreak: 0,
            wrongCount: { increment: 1 },
          }),
        }),
      );
    });
  });
});
