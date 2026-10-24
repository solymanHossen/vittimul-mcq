import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { QuestionsService } from './questions.service';
import { PrismaService } from '../database/prisma.service';

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

const mockTx = {
  question: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  questionOption: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    update: jest.fn(),
  },
  questionTag: {
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  tag: {
    createMany: jest.fn(),
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

const mockPrisma = {
  question: {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  },
  questionPassage: {
    create: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
};

const baseOptionRow = {
  id: 1n,
  optionLabel: 'A',
  optionText: 'Dhaka',
  optionImageUrl: null,
  isCorrect: true,
  displayOrder: 1,
};

function buildQuestionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 501n,
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
    difficulty: 'MEDIUM',
    isMultipleChoice: false,
    defaultMarks: decimal('1.00'),
    defaultNegative: decimal('0.50'),
    version: 1,
    isFrozen: false,
    totalFacedCount: 0,
    totalCorrectCount: 0,
    totalSkippedCount: 0,
    isVerified: true,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    options: [baseOptionRow, { ...baseOptionRow, id: 2n, optionLabel: 'B', isCorrect: false }],
    questionTags: [{ tag: { id: 1, name: 'Capitals', slug: 'capitals' } }],
    ...overrides,
  };
}

describe('QuestionsService', () => {
  let service: QuestionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuestionsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<QuestionsService>(QuestionsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    );
  });

  describe('createQuestion()', () => {
    const dto = {
      topicId: 12,
      questionText: 'What is the capital of Bangladesh?',
      options: [
        { optionLabel: 'A', optionText: 'Dhaka', isCorrect: true },
        { optionLabel: 'B', optionText: 'Chittagong', isCorrect: false },
      ],
      tags: ['Capitals'],
    };

    it('creates the question with nested options and links resolved tags', async () => {
      mockTx.question.create.mockResolvedValueOnce({ id: 501n });
      mockTx.tag.createMany.mockResolvedValueOnce({ count: 1 });
      mockTx.tag.findMany.mockResolvedValueOnce([{ id: 1, slug: 'capitals' }]);
      mockTx.questionTag.createMany.mockResolvedValueOnce({ count: 1 });
      mockTx.question.findUniqueOrThrow.mockResolvedValueOnce(buildQuestionRow());

      const result = await service.createQuestion(dto, 1);

      expect(mockTx.question.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            topicId: 12,
            createdById: 1,
            options: {
              create: [
                expect.objectContaining({ optionLabel: 'A', isCorrect: true, displayOrder: 1 }),
                expect.objectContaining({ optionLabel: 'B', isCorrect: false, displayOrder: 2 }),
              ],
            },
          }),
        }),
      );
      expect(mockTx.questionTag.createMany).toHaveBeenCalledWith({
        data: [{ questionId: 501n, tagId: 1 }],
        skipDuplicates: true,
      });
      expect(result.id).toBe('501');
      expect(result.defaultMarks).toBe(1);
      expect(result.tags).toEqual([{ id: 1, name: 'Capitals', slug: 'capitals' }]);
    });

    it('skips tag linking entirely when no tags are given', async () => {
      mockTx.question.create.mockResolvedValueOnce({ id: 502n });
      mockTx.question.findUniqueOrThrow.mockResolvedValueOnce(
        buildQuestionRow({ id: 502n, questionTags: [] }),
      );

      await service.createQuestion({ ...dto, tags: undefined }, 1);

      expect(mockTx.tag.createMany).not.toHaveBeenCalled();
      expect(mockTx.questionTag.createMany).not.toHaveBeenCalled();
    });
  });

  describe('bulkCreateQuestions()', () => {
    it('resolves tags once for the whole batch and creates every question', async () => {
      mockTx.tag.createMany.mockResolvedValueOnce({ count: 1 });
      mockTx.tag.findMany.mockResolvedValueOnce([{ id: 1, slug: 'capitals' }]);
      mockTx.question.create.mockResolvedValueOnce({ id: 1n }).mockResolvedValueOnce({ id: 2n });
      mockTx.questionTag.createMany.mockResolvedValueOnce({ count: 2 });
      mockTx.question.findMany.mockResolvedValueOnce([
        buildQuestionRow({ id: 1n }),
        buildQuestionRow({ id: 2n }),
      ]);

      const dto = {
        questions: [
          {
            topicId: 12,
            questionText: 'Q1',
            tags: ['Capitals'],
            options: [
              { optionLabel: 'A', optionText: 'X', isCorrect: true },
              { optionLabel: 'B', optionText: 'Y', isCorrect: false },
            ],
          },
          {
            topicId: 12,
            questionText: 'Q2',
            tags: ['Capitals'],
            options: [
              { optionLabel: 'A', optionText: 'X', isCorrect: true },
              { optionLabel: 'B', optionText: 'Y', isCorrect: false },
            ],
          },
        ],
      };

      const result = await service.bulkCreateQuestions(dto, 1);

      expect(mockTx.tag.createMany).toHaveBeenCalledTimes(1);
      expect(mockTx.tag.findMany).toHaveBeenCalledTimes(1);
      expect(mockTx.question.create).toHaveBeenCalledTimes(2);
      expect(mockTx.questionTag.createMany).toHaveBeenCalledWith({
        data: [
          { questionId: 1n, tagId: 1 },
          { questionId: 2n, tagId: 1 },
        ],
        skipDuplicates: true,
      });
      expect(result.count).toBe(2);
    });
  });

  describe('listQuestions()', () => {
    it('combines subjectId and categoryId into a single nested topic filter', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([]);
      mockPrisma.question.count.mockResolvedValueOnce(0);

      await service.listQuestions({
        page: 1,
        limit: 20,
        subjectId: 3,
        categoryId: 7,
      });

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            topic: { subjectId: 3, subject: { categoryId: 7 } },
          }),
        }),
      );
    });

    it('applies offset/limit pagination from page and limit', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([]);
      mockPrisma.question.count.mockResolvedValueOnce(0);

      await service.listQuestions({ page: 3, limit: 10 });

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('sanitizes the full-text search query, stripping tsquery operators', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([]);
      mockPrisma.question.count.mockResolvedValueOnce(0);

      await service.listQuestions({ page: 1, limit: 20, q: 'capital & (city)' });

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            questionText: { search: 'capital & city' },
          }),
        }),
      );
    });

    it('omits the search filter entirely when sanitization leaves nothing', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([]);
      mockPrisma.question.count.mockResolvedValueOnce(0);

      await service.listQuestions({ page: 1, limit: 20, q: '***' });

      const call = mockPrisma.question.findMany.mock.calls[0]?.[0] as { where: object };
      expect(call.where).not.toHaveProperty('questionText');
    });

    it('returns rows mapped through toQuestionDetail alongside pagination metadata', async () => {
      mockPrisma.question.findMany.mockResolvedValueOnce([buildQuestionRow()]);
      mockPrisma.question.count.mockResolvedValueOnce(1);

      const result = await service.listQuestions({ page: 1, limit: 20 });

      expect(result).toEqual(expect.objectContaining({ total: 1, page: 1, limit: 20 }));
      expect(result.items[0]?.id).toBe('501');
    });
  });

  describe('getQuestionById()', () => {
    it('excludes soft-deleted rows and maps the result', async () => {
      mockPrisma.question.findFirstOrThrow.mockResolvedValueOnce(buildQuestionRow());

      const result = await service.getQuestionById(501n);

      expect(mockPrisma.question.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 501n, deletedAt: null } }),
      );
      expect(result.id).toBe('501');
    });
  });

  describe('updateQuestion()', () => {
    it('updates scalar fields on a non-frozen question without touching version', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValueOnce({
        isFrozen: false,
        isMultipleChoice: false,
        questionText: 'Old text',
        version: 1,
      });
      mockTx.question.update.mockResolvedValueOnce(buildQuestionRow({ questionText: 'New text' }));

      await service.updateQuestion(501n, { questionText: 'New text' }, 1);

      expect(mockTx.question.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { questionText: 'New text' } }),
      );
      expect(mockTx.auditLog.create).not.toHaveBeenCalled();
    });

    it("bumps version and writes an AuditLog when editing a frozen question's text", async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValueOnce({
        isFrozen: true,
        isMultipleChoice: false,
        questionText: 'Old text',
        version: 1,
      });
      mockTx.question.update.mockResolvedValueOnce(
        buildQuestionRow({ questionText: 'New text', version: 2 }),
      );

      await service.updateQuestion(501n, { questionText: 'New text' }, 7);

      expect(mockTx.question.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { questionText: 'New text', version: { increment: 1 } },
        }),
      );
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 7,
            action: 'QUESTION_FROZEN_CONTENT_UPDATED',
            entityType: 'Question',
            entityId: '501',
          }),
        }),
      );
    });

    it('replaces options outright on a non-frozen question', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValueOnce({
        isFrozen: false,
        isMultipleChoice: false,
        questionText: 'Q',
        version: 1,
      });
      mockTx.question.update.mockResolvedValueOnce(buildQuestionRow());

      const options = [
        { optionLabel: 'A', optionText: 'X', isCorrect: true },
        { optionLabel: 'B', optionText: 'Y', isCorrect: false },
      ];

      await service.updateQuestion(501n, { options }, 1);

      expect(mockTx.questionOption.deleteMany).toHaveBeenCalledWith({
        where: { questionId: 501n },
      });
      expect(mockTx.questionOption.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({ questionId: 501n, optionLabel: 'A' }),
          expect.objectContaining({ questionId: 501n, optionLabel: 'B' }),
        ],
      });
    });

    it('never deletes existing options on a frozen question — updates by id, creates the rest', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValueOnce({
        isFrozen: true,
        isMultipleChoice: true,
        questionText: 'Q',
        version: 1,
      });
      mockTx.question.update.mockResolvedValueOnce(buildQuestionRow({ version: 2 }));

      const options = [
        { id: '1', optionLabel: 'A', optionText: 'Updated Dhaka', isCorrect: true },
        { optionLabel: 'C', optionText: 'Brand new option', isCorrect: true },
      ];

      await service.updateQuestion(501n, { options }, 1);

      expect(mockTx.questionOption.deleteMany).not.toHaveBeenCalled();
      expect(mockTx.questionOption.update).toHaveBeenCalledWith({
        where: { id_questionId: { id: 1n, questionId: 501n } },
        data: expect.objectContaining({ optionText: 'Updated Dhaka' }),
      });
      expect(mockTx.questionOption.createMany).toHaveBeenCalledWith({
        data: [expect.objectContaining({ questionId: 501n, optionLabel: 'C' })],
      });
    });

    it('rejects updating options to more than one correct answer for a single-choice question', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValueOnce({
        isFrozen: false,
        isMultipleChoice: false,
        questionText: 'Q',
        version: 1,
      });

      const options = [
        { optionLabel: 'A', optionText: 'X', isCorrect: true },
        { optionLabel: 'B', optionText: 'Y', isCorrect: true },
      ];

      await expect(service.updateQuestion(501n, { options }, 1)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTx.question.update).not.toHaveBeenCalled();
    });

    it('allows multiple correct options when isMultipleChoice is already true in the database', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValueOnce({
        isFrozen: false,
        isMultipleChoice: true,
        questionText: 'Q',
        version: 1,
      });
      mockTx.question.update.mockResolvedValueOnce(buildQuestionRow({ isMultipleChoice: true }));

      const options = [
        { optionLabel: 'A', optionText: 'X', isCorrect: true },
        { optionLabel: 'B', optionText: 'Y', isCorrect: true },
      ];

      await expect(service.updateQuestion(501n, { options }, 1)).resolves.toBeDefined();
    });

    it('replaces tags: deletes existing links then links the new set', async () => {
      mockPrisma.question.findUniqueOrThrow.mockResolvedValueOnce({
        isFrozen: false,
        isMultipleChoice: false,
        questionText: 'Q',
        version: 1,
      });
      mockTx.tag.createMany.mockResolvedValueOnce({ count: 1 });
      mockTx.tag.findMany.mockResolvedValueOnce([{ id: 2, slug: 'geography' }]);
      mockTx.question.update.mockResolvedValueOnce(buildQuestionRow());

      await service.updateQuestion(501n, { tags: ['Geography'] }, 1);

      expect(mockTx.questionTag.deleteMany).toHaveBeenCalledWith({ where: { questionId: 501n } });
      expect(mockTx.questionTag.createMany).toHaveBeenCalledWith({
        data: [{ questionId: 501n, tagId: 2 }],
        skipDuplicates: true,
      });
    });
  });

  describe('deleteQuestion()', () => {
    it('soft-deletes by setting deletedAt and isActive', async () => {
      mockPrisma.question.update.mockResolvedValueOnce({});

      await service.deleteQuestion(501n);

      expect(mockPrisma.question.update).toHaveBeenCalledWith({
        where: { id: 501n },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });

  describe('passages', () => {
    it('createPassage() maps the created row', async () => {
      mockPrisma.questionPassage.create.mockResolvedValueOnce({
        id: 12n,
        title: 'Reading 1',
        passageText: 'Once upon a time...',
        imageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createPassage({ passageText: 'Once upon a time...' });

      expect(result.id).toBe('12');
    });

    it('getPassageById() maps the fetched row', async () => {
      mockPrisma.questionPassage.findUniqueOrThrow.mockResolvedValueOnce({
        id: 12n,
        title: null,
        passageText: 'Text',
        imageUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getPassageById(12n);

      expect(result.id).toBe('12');
    });
  });
});
