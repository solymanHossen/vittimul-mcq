import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyService } from './vocabulary.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockVocabularyService = {
  createCard: jest.fn(),
  listCards: jest.fn(),
  getDueCards: jest.fn(),
  reviewCard: jest.fn(),
};

const user: AuthUser = { id: 1, email: 'user@example.com', role: Role.USER, isActive: true };

describe('VocabularyController', () => {
  let controller: VocabularyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VocabularyController],
      providers: [{ provide: VocabularyService, useValue: mockVocabularyService }],
    }).compile();

    controller = module.get<VocabularyController>(VocabularyController);
    jest.clearAllMocks();
  });

  it('createCard() delegates to the service', async () => {
    mockVocabularyService.createCard.mockResolvedValueOnce({
      id: '1',
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
    });
    const dto = { word: 'Ubiquitous', bengaliMeaning: 'সর্বব্যাপী' };

    const result = await controller.createCard(dto);

    expect(mockVocabularyService.createCard).toHaveBeenCalledWith(dto);
    expect(result.data.word).toBe('Ubiquitous');
  });

  it('getDueCards() forwards the current user id', async () => {
    mockVocabularyService.getDueCards.mockResolvedValueOnce([]);

    await controller.getDueCards(user);

    expect(mockVocabularyService.getDueCards).toHaveBeenCalledWith(1);
  });

  it('reviewCard() forwards the dto and current user id', async () => {
    mockVocabularyService.reviewCard.mockResolvedValueOnce({
      cardId: '1',
      leitnerBox: 2,
      correctStreak: 1,
      wrongCount: 0,
      isMastered: false,
      nextReviewDate: new Date(),
      lastReviewedAt: new Date(),
    });
    const dto = { cardId: '1', isRemembered: true };

    await controller.reviewCard(dto, user);

    expect(mockVocabularyService.reviewCard).toHaveBeenCalledWith(1, dto);
  });
});
