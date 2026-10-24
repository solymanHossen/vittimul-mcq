import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { AttemptStatus, QuestionNavState } from '@prisma/client';
import { Test, type TestingModule } from '@nestjs/testing';
import { ExamRuntimeService } from './exam-runtime.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';

function decimal(value: number) {
  return { toNumber: () => value };
}

const mockTx = {
  examQuestionRuntime: { createMany: jest.fn() },
  examAttempt: { update: jest.fn() },
  question: { updateMany: jest.fn() },
  userStreak: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  userDailyActivity: { upsert: jest.fn() },
  spacedRepetitionQueue: { upsert: jest.fn() },
  antiCheatLog: { create: jest.fn() },
};

const mockPrisma = {
  exam: { findUniqueOrThrow: jest.fn() },
  examAttempt: {
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  examQuestion: { findMany: jest.fn() },
  userSubscription: { findFirst: jest.fn() },
  $transaction: jest.fn((callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
};

const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn().mockResolvedValue(1),
  hset: jest.fn(),
  hgetall: jest.fn(),
  expire: jest.fn(),
};

const mockLeaderboardService = { recordScore: jest.fn() };

const EXAM_CONFIG_BASE = {
  id: 1n,
  examType: 'LIVE_CENTRAL_TEST',
  durationMinutes: 60,
  startTime: new Date('2026-01-01T00:00:00.000Z'),
  endTime: new Date('2026-01-01T23:00:00.000Z'),
  passMarks: decimal(40),
  isPremiumOnly: false,
  isOmrMode: true,
  shuffleQuestions: false,
  shuffleOptions: false,
  allowMultipleRetakes: false,
  maxTabSwitchesAllowed: 3,
  isPublished: true,
};

describe('ExamRuntimeService', () => {
  let service: ExamRuntimeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamRuntimeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: { client: mockRedisClient } },
        { provide: LeaderboardService, useValue: mockLeaderboardService },
      ],
    }).compile();

    service = module.get<ExamRuntimeService>(ExamRuntimeService);
    jest.clearAllMocks();
    mockRedisClient.del.mockResolvedValue(1);
    mockLeaderboardService.recordScore.mockResolvedValue(undefined);
    mockPrisma.$transaction.mockImplementation((callback: (tx: typeof mockTx) => unknown) =>
      callback(mockTx),
    );
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T01:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startAttempt()', () => {
    it('rejects an unpublished exam', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        ...EXAM_CONFIG_BASE,
        isPublished: false,
      });

      await expect(service.startAttempt(1n, 1)).rejects.toThrow(BadRequestException);
    });

    it("rejects starting before the exam's startTime", async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        ...EXAM_CONFIG_BASE,
        startTime: new Date('2026-06-01T00:00:00.000Z'),
      });

      await expect(service.startAttempt(1n, 1)).rejects.toThrow(BadRequestException);
    });

    it('rejects a premium-only exam for a user without an active subscription', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        ...EXAM_CONFIG_BASE,
        isPremiumOnly: true,
      });
      mockPrisma.userSubscription.findFirst.mockResolvedValueOnce(null);

      await expect(service.startAttempt(1n, 1)).rejects.toThrow(ForbiddenException);
    });

    it('creates a fresh IN_PROGRESS attempt and returns the sanitized paper', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce(EXAM_CONFIG_BASE);
      mockPrisma.examAttempt.findMany.mockResolvedValueOnce([]);
      mockPrisma.examAttempt.create.mockResolvedValueOnce({
        id: 'attempt-1',
        examId: 1n,
        attemptNumber: 1,
        isOfficial: true,
        isPracticeArchive: false,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date('2026-01-01T02:00:00.000Z'),
      });
      mockRedisClient.get.mockResolvedValueOnce(
        JSON.stringify([
          {
            questionId: '501',
            sectionId: null,
            questionOrder: 1,
            marks: 1,
            negativeMarks: 0.25,
            questionText: 'Q1',
            questionImageUrl: null,
            difficulty: 'EASY',
            isMultipleChoice: false,
            passage: null,
            options: [{ optionId: '1', optionLabel: 'A', optionText: 'X', optionImageUrl: null }],
          },
        ]),
      );

      const result = await service.startAttempt(1n, 1);

      expect(mockPrisma.examAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            attemptNumber: 1,
            isOfficial: true,
            isPracticeArchive: false,
          }),
        }),
      );
      expect(result.attempt.id).toBe('attempt-1');
      expect(result.questions[0]?.selectedOptionId).toBeNull();
      expect(result.questions[0]?.navState).toBe(QuestionNavState.NOT_VISITED);
    });

    it('resumes an existing non-expired IN_PROGRESS attempt instead of creating a new one', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce(EXAM_CONFIG_BASE);
      mockPrisma.examAttempt.findMany.mockResolvedValueOnce([
        {
          id: 'attempt-1',
          attemptNumber: 1,
          status: AttemptStatus.IN_PROGRESS,
          expiresAt: new Date('2026-01-01T02:00:00.000Z'),
          isOfficial: true,
        },
      ]);
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        id: 'attempt-1',
        examId: 1n,
        attemptNumber: 1,
        isOfficial: true,
        isPracticeArchive: false,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(),
        expiresAt: new Date('2026-01-01T02:00:00.000Z'),
      });
      mockRedisClient.get.mockResolvedValueOnce(JSON.stringify([]));
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      const result = await service.startAttempt(1n, 1);

      expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
      expect(result.attempt.id).toBe('attempt-1');
    });

    it('rejects a new attempt when retakes are disallowed and one was already completed live', async () => {
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce(EXAM_CONFIG_BASE);
      mockPrisma.examAttempt.findMany.mockResolvedValueOnce([
        {
          id: 'attempt-1',
          attemptNumber: 1,
          status: AttemptStatus.EVALUATED,
          expiresAt: new Date('2026-01-01T02:00:00.000Z'),
          isOfficial: true,
        },
      ]);

      await expect(service.startAttempt(1n, 1)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.examAttempt.create).not.toHaveBeenCalled();
    });
  });

  describe('syncAnswers()', () => {
    const baseAttempt = {
      userId: 1,
      examId: 1n,
      status: AttemptStatus.IN_PROGRESS,
      expiresAt: new Date('2026-01-01T02:00:00.000Z'),
    };

    it('rejects syncing on an attempt that belongs to someone else', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce(baseAttempt);

      await expect(
        service.syncAnswers('attempt-1', 999, {
          answers: [{ questionId: '1', navState: QuestionNavState.ANSWERED, timeSpentSeconds: 5 }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects syncing once the attempt is no longer IN_PROGRESS', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseAttempt,
        status: AttemptStatus.EVALUATED,
      });

      await expect(
        service.syncAnswers('attempt-1', 1, {
          answers: [{ questionId: '1', navState: QuestionNavState.ANSWERED, timeSpentSeconds: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects syncing past the expiry grace window', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        ...baseAttempt,
        expiresAt: new Date('2025-01-01T00:00:00.000Z'),
      });

      await expect(
        service.syncAnswers('attempt-1', 1, {
          answers: [{ questionId: '1', navState: QuestionNavState.ANSWERED, timeSpentSeconds: 5 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('writes new answers in a single batched hset call', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce(baseAttempt);
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        isOmrMode: true,
        durationMinutes: 60,
      });
      mockRedisClient.hgetall.mockResolvedValueOnce({});

      await service.syncAnswers('attempt-1', 1, {
        answers: [
          {
            questionId: '1',
            selectedOptionId: '10',
            navState: QuestionNavState.ANSWERED,
            timeSpentSeconds: 20,
          },
          {
            questionId: '2',
            selectedOptionId: '20',
            navState: QuestionNavState.ANSWERED,
            timeSpentSeconds: 15,
          },
        ],
      });

      expect(mockRedisClient.hset).toHaveBeenCalledTimes(1);
      const [, ...args] = mockRedisClient.hset.mock.calls[0] as [string, ...string[]];
      expect(args).toHaveLength(4); // 2 question-id/value pairs
    });

    it('locks an answer under OMR mode and ignores a later attempt to change it', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce(baseAttempt);
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({
        isOmrMode: true,
        durationMinutes: 60,
      });
      mockRedisClient.hgetall.mockResolvedValueOnce({
        '1': JSON.stringify({
          selectedOptionId: '10',
          selectedOptionIds: [],
          navState: QuestionNavState.ANSWERED,
          timeSpentSeconds: 10,
          answerChangeCount: 0,
          isLocked: true,
        }),
      });

      await service.syncAnswers('attempt-1', 1, {
        answers: [
          {
            questionId: '1',
            selectedOptionId: '11', // attempting to change a locked answer
            navState: QuestionNavState.ANSWERED,
            timeSpentSeconds: 25,
          },
        ],
      });

      const [, field, valueJson] = mockRedisClient.hset.mock.calls[0] as [string, string, string];
      expect(field).toBe('1');
      const written = JSON.parse(valueJson) as {
        selectedOptionId: string;
        timeSpentSeconds: number;
      };
      expect(written.selectedOptionId).toBe('10'); // unchanged
      expect(written.timeSpentSeconds).toBe(25); // metadata still updates
    });
  });

  describe('recordAntiCheatEvent()', () => {
    it('increments tabSwitchCount and does not disqualify while under the limit', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        userId: 1,
        status: AttemptStatus.IN_PROGRESS,
        examId: 1n,
      });
      mockTx.examAttempt.update.mockResolvedValueOnce({
        tabSwitchCount: 2,
        status: AttemptStatus.IN_PROGRESS,
      });
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({ maxTabSwitchesAllowed: 3 });

      const result = await service.recordAntiCheatEvent('attempt-1', 1, {
        eventName: 'TAB_SWITCH',
        severity: 'LOW',
      });

      expect(mockTx.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { tabSwitchCount: { increment: 1 } } }),
      );
      expect(result.disqualified).toBe(false);
    });

    it('auto-disqualifies once tabSwitchCount exceeds the exam limit', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        userId: 1,
        status: AttemptStatus.IN_PROGRESS,
        examId: 1n,
      });
      mockTx.examAttempt.update.mockResolvedValueOnce({
        tabSwitchCount: 4,
        status: AttemptStatus.IN_PROGRESS,
      });
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({ maxTabSwitchesAllowed: 3 });
      mockPrisma.examAttempt.update.mockResolvedValueOnce({});

      const result = await service.recordAntiCheatEvent('attempt-1', 1, {
        eventName: 'TAB_SWITCH',
        severity: 'HIGH',
      });

      expect(mockPrisma.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: AttemptStatus.DISQUALIFIED, submittedAt: expect.any(Date) },
        }),
      );
      expect(mockRedisClient.del).toHaveBeenCalled();
      expect(result.disqualified).toBe(true);
    });

    it('does not increment any counter for an unrecognized event name', async () => {
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        userId: 1,
        status: AttemptStatus.IN_PROGRESS,
        examId: 1n,
      });
      mockTx.examAttempt.update.mockResolvedValueOnce({
        tabSwitchCount: 0,
        status: AttemptStatus.IN_PROGRESS,
      });

      await service.recordAntiCheatEvent('attempt-1', 1, {
        eventName: 'DEV_TOOLS_OPENED',
        severity: 'MEDIUM',
      });

      expect(mockTx.examAttempt.update).toHaveBeenCalledWith(expect.objectContaining({ data: {} }));
    });
  });

  describe('submitAttempt()', () => {
    it('rejects with ConflictException when the submit lock is already held', async () => {
      mockRedisClient.set.mockResolvedValueOnce(null);

      await expect(service.submitAttempt('attempt-1', 1)).rejects.toThrow(ConflictException);
    });

    it('evaluates, persists, pushes to the leaderboard for an official attempt, and releases the lock', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        userId: 1,
        examId: 1n,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date('2026-01-01T00:30:00.000Z'),
        isOfficial: true,
      });
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({ passMarks: decimal(0) });
      mockPrisma.examQuestion.findMany.mockResolvedValueOnce([
        {
          questionId: 501n,
          marks: decimal(1),
          negativeMarks: decimal(0.25),
          question: {
            isMultipleChoice: false,
            topic: { subjectId: 1, subject: { name: 'English' } },
            options: [
              { id: 1n, isCorrect: true },
              { id: 2n, isCorrect: false },
            ],
          },
        },
      ]);
      mockRedisClient.hgetall.mockResolvedValueOnce({
        '501': JSON.stringify({
          selectedOptionId: '1',
          selectedOptionIds: [],
          navState: QuestionNavState.ANSWERED,
          timeSpentSeconds: 20,
          answerChangeCount: 0,
          isLocked: true,
        }),
      });
      mockTx.userStreak.findUnique.mockResolvedValueOnce(null);

      const result = await service.submitAttempt('attempt-1', 1);

      expect(result.obtainedScore).toBe(1);
      expect(result.isPassed).toBe(true);
      expect(mockTx.examQuestionRuntime.createMany).toHaveBeenCalled();
      expect(mockTx.examAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: AttemptStatus.EVALUATED }),
        }),
      );
      expect(mockLeaderboardService.recordScore).toHaveBeenCalledWith(1n, 1, 1, expect.any(Number));
      expect(mockRedisClient.del).toHaveBeenCalledWith('lock:submit:attempt-1');
    });

    it('does not push to the leaderboard for a non-official (practice) attempt', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        userId: 1,
        examId: 1n,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date('2026-01-01T00:30:00.000Z'),
        isOfficial: false,
      });
      mockPrisma.exam.findUniqueOrThrow.mockResolvedValueOnce({ passMarks: decimal(0) });
      mockPrisma.examQuestion.findMany.mockResolvedValueOnce([]);
      mockRedisClient.hgetall.mockResolvedValueOnce({});
      mockTx.userStreak.findUnique.mockResolvedValueOnce(null);

      await service.submitAttempt('attempt-1', 1);

      expect(mockLeaderboardService.recordScore).not.toHaveBeenCalled();
    });

    it('rejects submitting an attempt that is not IN_PROGRESS', async () => {
      mockRedisClient.set.mockResolvedValueOnce('OK');
      mockPrisma.examAttempt.findUniqueOrThrow.mockResolvedValueOnce({
        userId: 1,
        examId: 1n,
        status: AttemptStatus.EVALUATED,
        startedAt: new Date(),
        isOfficial: true,
      });

      await expect(service.submitAttempt('attempt-1', 1)).rejects.toThrow(BadRequestException);
      expect(mockRedisClient.del).toHaveBeenCalledWith('lock:submit:attempt-1');
    });
  });
});
