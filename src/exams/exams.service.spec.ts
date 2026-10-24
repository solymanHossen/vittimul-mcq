import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { ExamsService } from './exams.service';
import { PrismaService } from '../database/prisma.service';
import { ExamRuntimeService } from '../exam-runtime/exam-runtime.service';

function decimal(value: number) {
  return { toNumber: () => value };
}

const mockTx = {
  examQuestion: { createMany: jest.fn() },
  exam: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
  examSection: { update: jest.fn() },
  question: { updateMany: jest.fn() },
};

const mockPrisma = {
  exam: {
    create: jest.fn(),
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
};

const mockExamRuntimeService = { warmExamPaperCache: jest.fn() };

const EXAM_ROW = {
  id: 1n,
  uuid: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  categoryId: 1,
  tournamentId: null,
  title: 'October Mock Test',
  slug: 'october-mock-test',
  examType: 'LIVE_CENTRAL_TEST',
  totalQuestions: 1,
  totalMarks: decimal(1),
  passMarks: decimal(0),
  durationMinutes: 60,
  negativeMarkingRate: decimal(0.25),
  isOmrMode: true,
  shuffleQuestions: false,
  shuffleOptions: false,
  isPremiumOnly: false,
  allowMultipleRetakes: false,
  maxRetakesAllowed: 1,
  maxTabSwitchesAllowed: 3,
  syllabusDescription: null,
  studyMaterials: null,
  startTime: new Date('2026-01-01T00:00:00.000Z'),
  endTime: new Date('2026-01-02T00:00:00.000Z'),
  resultPublishTime: null,
  isPublished: false,
  isResultsPublished: false,
  totalParticipants: 0,
  highestScore: null,
  averageScore: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  sections: [],
};

describe('ExamsService', () => {
  let service: ExamsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ExamRuntimeService, useValue: mockExamRuntimeService },
      ],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    );
  });

  describe('createExam()', () => {
    it('seeds totalMarks at 0 and creates nested sections', async () => {
      mockPrisma.exam.create.mockResolvedValueOnce(EXAM_ROW);

      await service.createExam({
        title: 'October Mock Test',
        slug: 'october-mock-test',
        durationMinutes: 60,
        startTime: new Date('2026-01-01T00:00:00.000Z'),
        endTime: new Date('2026-01-02T00:00:00.000Z'),
        sections: [{ title: 'English' }],
      });

      expect(mockPrisma.exam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalMarks: 0,
            sections: { create: [expect.objectContaining({ title: 'English' })] },
          }),
        }),
      );
    });
  });

  describe('assignQuestions()', () => {
    it('bulk-creates exam questions, increments totals, and freezes the questions', async () => {
      mockTx.exam.findUniqueOrThrow.mockResolvedValueOnce(EXAM_ROW);

      await service.assignQuestions(1n, {
        questions: [
          { questionId: '501', marks: 1, negativeMarks: 0.25, questionOrder: 1 },
          { questionId: '502', sectionId: '9', marks: 2, negativeMarks: 0.5, questionOrder: 2 },
        ],
      });

      expect(mockTx.examQuestion.createMany).toHaveBeenCalledWith({
        data: [
          {
            examId: 1n,
            questionId: 501n,
            sectionId: null,
            marks: 1,
            negativeMarks: 0.25,
            questionOrder: 1,
          },
          {
            examId: 1n,
            questionId: 502n,
            sectionId: 9n,
            marks: 2,
            negativeMarks: 0.5,
            questionOrder: 2,
          },
        ],
      });
      expect(mockTx.exam.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { totalQuestions: { increment: 2 }, totalMarks: { increment: 3 } },
      });
      expect(mockTx.examSection.update).toHaveBeenCalledWith({
        where: { id: 9n },
        data: { totalMarks: { increment: 2 } },
      });
      expect(mockTx.question.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [501n, 502n] } },
        data: { isFrozen: true },
      });
    });
  });

  describe('publishExam()', () => {
    it('rejects publishing an exam with no questions', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        totalQuestions: 0,
        totalMarks: decimal(0),
      });

      await expect(service.publishExam(1n)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.exam.update).not.toHaveBeenCalled();
    });

    it('rejects publishing an exam whose totalMarks is zero', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        totalQuestions: 5,
        totalMarks: decimal(0),
      });

      await expect(service.publishExam(1n)).rejects.toThrow(BadRequestException);
    });

    it('publishes and pre-warms the exam paper cache', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        totalQuestions: 5,
        totalMarks: decimal(100),
      });
      mockPrisma.exam.update.mockResolvedValueOnce({ ...EXAM_ROW, isPublished: true });

      await service.publishExam(1n);

      expect(mockPrisma.exam.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { isPublished: true },
        select: expect.any(Object),
      });
      expect(mockExamRuntimeService.warmExamPaperCache).toHaveBeenCalledWith(1n);
    });
  });

  describe('listExams()', () => {
    it('always restricts the list to published, non-deleted exams', async () => {
      mockPrisma.exam.findMany.mockResolvedValueOnce([]);
      mockPrisma.exam.count.mockResolvedValueOnce(0);

      await service.listExams({ page: 1, limit: 20 });

      expect(mockPrisma.exam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublished: true, deletedAt: null }),
        }),
      );
    });

    it("computes status 'live' for an exam whose window contains now", async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
      mockPrisma.exam.findMany.mockResolvedValueOnce([
        {
          id: 1n,
          categoryId: 1,
          title: 'Live Exam',
          slug: 'live-exam',
          examType: 'LIVE_CENTRAL_TEST',
          totalQuestions: 10,
          totalMarks: decimal(10),
          durationMinutes: 60,
          isPremiumOnly: false,
          startTime: new Date('2026-01-01T00:00:00.000Z'),
          endTime: new Date('2026-01-02T00:00:00.000Z'),
        },
      ]);
      mockPrisma.exam.count.mockResolvedValueOnce(1);

      const result = await service.listExams({ page: 1, limit: 20 });

      expect(result.items[0]?.status).toBe('live');
      jest.useRealTimers();
    });

    it("filters by status: 'upcoming' maps to a startTime-in-the-future condition", async () => {
      mockPrisma.exam.findMany.mockResolvedValueOnce([]);
      mockPrisma.exam.count.mockResolvedValueOnce(0);

      await service.listExams({ page: 1, limit: 20, status: 'upcoming' });

      expect(mockPrisma.exam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ startTime: { gt: expect.any(Date) } }),
        }),
      );
    });
  });

  describe('getExamBySlug()', () => {
    it('only matches published, non-deleted exams', async () => {
      mockPrisma.exam.findFirstOrThrow.mockResolvedValueOnce(EXAM_ROW);

      await service.getExamBySlug('october-mock-test');

      expect(mockPrisma.exam.findFirstOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'october-mock-test', isPublished: true, deletedAt: null },
        }),
      );
    });

    it('never selects accessPin', async () => {
      mockPrisma.exam.findFirstOrThrow.mockResolvedValueOnce(EXAM_ROW);

      await service.getExamBySlug('october-mock-test');

      const call = mockPrisma.exam.findFirstOrThrow.mock.calls[0]?.[0] as {
        select: Record<string, unknown>;
      };
      expect(call.select).not.toHaveProperty('accessPin');
    });
  });
});
