import { Test, type TestingModule } from '@nestjs/testing';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import type { AuthUser } from '../auth/interfaces/auth.interfaces';
import { Role } from '@prisma/client';

const mockQuestionsService = {
  createQuestion: jest.fn(),
  bulkCreateQuestions: jest.fn(),
  listQuestions: jest.fn(),
  getQuestionById: jest.fn(),
  updateQuestion: jest.fn(),
  deleteQuestion: jest.fn(),
  createPassage: jest.fn(),
  getPassageById: jest.fn(),
};

const currentUser: AuthUser = {
  id: 1,
  email: 'admin@example.com',
  role: Role.ADMIN,
  isActive: true,
};

const questionDetail = {
  id: '501',
  uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  topicId: 12,
  passageId: null,
  createdById: 1,
  verifiedById: null,
  questionText: 'What is the capital of Bangladesh?',
  questionImageUrl: null,
  textExplanation: null,
  explanationImageUrl: null,
  audioExplanationUrl: null,
  videoExplanationUrl: null,
  sourceReference: null,
  difficulty: 'MEDIUM' as const,
  isMultipleChoice: false,
  defaultMarks: 1,
  defaultNegative: 0.5,
  version: 1,
  isFrozen: false,
  totalFacedCount: 0,
  totalCorrectCount: 0,
  totalSkippedCount: 0,
  isVerified: true,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  options: [
    {
      id: '1',
      optionLabel: 'A',
      optionText: 'Dhaka',
      optionImageUrl: null,
      isCorrect: true,
      displayOrder: 1,
    },
    {
      id: '2',
      optionLabel: 'B',
      optionText: 'Chittagong',
      optionImageUrl: null,
      isCorrect: false,
      displayOrder: 2,
    },
  ],
  tags: [{ id: 1, name: 'Capitals', slug: 'capitals' }],
};

describe('QuestionsController', () => {
  let controller: QuestionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionsController],
      providers: [{ provide: QuestionsService, useValue: mockQuestionsService }],
    }).compile();

    controller = module.get<QuestionsController>(QuestionsController);
    jest.clearAllMocks();
  });

  it('createQuestion() passes the current user id as createdById', async () => {
    mockQuestionsService.createQuestion.mockResolvedValueOnce(questionDetail);
    const dto = {
      topicId: 12,
      questionText: 'What is the capital of Bangladesh?',
      options: [
        { optionLabel: 'A', optionText: 'Dhaka', isCorrect: true },
        { optionLabel: 'B', optionText: 'Chittagong', isCorrect: false },
      ],
    };

    const result = await controller.createQuestion(dto, currentUser);

    expect(mockQuestionsService.createQuestion).toHaveBeenCalledWith(dto, 1);
    expect(result.data.id).toBe('501');
  });

  it('bulkCreateQuestions() reports the created count in the message', async () => {
    mockQuestionsService.bulkCreateQuestions.mockResolvedValueOnce({
      count: 2,
      questions: [questionDetail, questionDetail],
    });

    const result = await controller.bulkCreateQuestions({ questions: [] }, currentUser);

    expect(result.message).toBe('2 questions created successfully');
    expect(result.data.count).toBe(2);
  });

  it('listQuestions() forwards the parsed query and maps items to entities', async () => {
    mockQuestionsService.listQuestions.mockResolvedValueOnce({
      items: [questionDetail],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listQuestions({ page: 1, limit: 20 });

    expect(mockQuestionsService.listQuestions).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.data.items).toHaveLength(1);
    expect(result.data.total).toBe(1);
  });

  it('getQuestion() converts the bigint-pipe id through to the service', async () => {
    mockQuestionsService.getQuestionById.mockResolvedValueOnce(questionDetail);

    const result = await controller.getQuestion(501n);

    expect(mockQuestionsService.getQuestionById).toHaveBeenCalledWith(501n);
    expect(result.data.id).toBe('501');
  });

  it('updateQuestion() passes id, dto, and actor id through to the service', async () => {
    mockQuestionsService.updateQuestion.mockResolvedValueOnce(questionDetail);

    await controller.updateQuestion(501n, { questionText: 'Updated' }, currentUser);

    expect(mockQuestionsService.updateQuestion).toHaveBeenCalledWith(
      501n,
      { questionText: 'Updated' },
      1,
    );
  });

  it('deleteQuestion() returns a null-data success envelope', async () => {
    mockQuestionsService.deleteQuestion.mockResolvedValueOnce(undefined);

    const result = await controller.deleteQuestion(501n);

    expect(mockQuestionsService.deleteQuestion).toHaveBeenCalledWith(501n);
    expect(result).toEqual({ message: 'Question deleted successfully', data: null });
  });

  describe('passages', () => {
    const passage = {
      id: '12',
      title: 'Reading 1',
      passageText: 'Once upon a time...',
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('createPassage() delegates to the service', async () => {
      mockQuestionsService.createPassage.mockResolvedValueOnce(passage);

      const result = await controller.createPassage({ passageText: 'Once upon a time...' });

      expect(result.data.id).toBe('12');
    });

    it('getPassage() converts the bigint-pipe id through to the service', async () => {
      mockQuestionsService.getPassageById.mockResolvedValueOnce(passage);

      const result = await controller.getPassage(12n);

      expect(mockQuestionsService.getPassageById).toHaveBeenCalledWith(12n);
      expect(result.data.id).toBe('12');
    });
  });
});
