import { Test, type TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { SrsController } from './srs.controller';
import { SrsService } from './srs.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';

const mockSrsService = {
  getDueQuestions: jest.fn(),
  reviewQuestion: jest.fn(),
  upsertFavorite: jest.fn(),
  listFavorites: jest.fn(),
  deleteFavorite: jest.fn(),
};

const user: AuthUser = { id: 1, email: 'user@example.com', role: Role.USER, isActive: true };

describe('SrsController', () => {
  let controller: SrsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SrsController],
      providers: [{ provide: SrsService, useValue: mockSrsService }],
    }).compile();

    controller = module.get<SrsController>(SrsController);
    jest.clearAllMocks();
  });

  it('getDueQuestions() forwards the current user id', async () => {
    mockSrsService.getDueQuestions.mockResolvedValueOnce([]);

    await controller.getDueQuestions(user);

    expect(mockSrsService.getDueQuestions).toHaveBeenCalledWith(1);
  });

  it('reviewQuestion() forwards the dto and current user id', async () => {
    mockSrsService.reviewQuestion.mockResolvedValueOnce({
      questionId: '2',
      repetitionNumber: 1,
      lapsesCount: 0,
      intervalDays: 1,
      easeFactor: 2.6,
      nextReviewDate: new Date(),
      isMastered: false,
      lastReviewedAt: new Date(),
    });
    const dto = { questionId: '2', qualityGrade: 5 };

    await controller.reviewQuestion(dto, user);

    expect(mockSrsService.reviewQuestion).toHaveBeenCalledWith(1, dto);
  });

  it('deleteFavorite() forwards the bigint questionId and current user id', async () => {
    mockSrsService.deleteFavorite.mockResolvedValueOnce(undefined);

    const result = await controller.deleteFavorite(2n, user);

    expect(mockSrsService.deleteFavorite).toHaveBeenCalledWith(1, 2n);
    expect(result).toEqual({ message: 'Favorite removed successfully', data: null });
  });
});
