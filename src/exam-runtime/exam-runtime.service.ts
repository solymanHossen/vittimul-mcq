import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AttemptStatus, Prisma, QuestionNavState, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import {
  answersKey,
  ANSWERS_TTL_BUFFER_SECONDS,
  COPY_PASTE_ATTEMPT_EVENT,
  EXPIRY_GRACE_MS,
  FULLSCREEN_EXIT_EVENT,
  paperKey,
  PAPER_CACHE_TTL_SECONDS,
  SUBMIT_LOCK_TTL_SECONDS,
  submitLockKey,
  TAB_SWITCH_EVENT,
} from './exam-runtime.constants';
import { deterministicShuffle } from './deterministic-shuffle.util';
import { EvaluationQuestionInput, evaluateAttempt } from './exam-evaluation.util';
import { SyncAnswersDto } from './dto/sync-answers.dto';
import { AntiCheatEventDto } from './dto/anti-cheat-event.dto';
import {
  RedisAnswerState,
  RuntimeQuestionBase,
  RuntimeQuestionWithState,
} from './interfaces/runtime-question.interface';
import {
  AttemptResult,
  AttemptStartResult,
  AttemptSummary,
} from './interfaces/attempt-detail.interface';

type PrismaTransactionClient = Prisma.TransactionClient;

const EXAM_CONFIG_SELECT = {
  id: true,
  examType: true,
  durationMinutes: true,
  startTime: true,
  endTime: true,
  passMarks: true,
  isPremiumOnly: true,
  isOmrMode: true,
  shuffleQuestions: true,
  shuffleOptions: true,
  allowMultipleRetakes: true,
  maxTabSwitchesAllowed: true,
  isPublished: true,
} satisfies Prisma.ExamSelect;

type ExamConfig = Prisma.ExamGetPayload<{ select: typeof EXAM_CONFIG_SELECT }>;

const COMPLETED_STATUSES: AttemptStatus[] = [
  AttemptStatus.SUBMITTED,
  AttemptStatus.EVALUATED,
  AttemptStatus.AUTO_EXPIRED,
  AttemptStatus.DISQUALIFIED,
];

@Injectable()
export class ExamRuntimeService {
  private readonly logger = new Logger(ExamRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  // ── Exam paper cache (shared with ExamsService.publishExam) ─────────────

  async warmExamPaperCache(examId: bigint): Promise<void> {
    const paper = await this.buildPaperFromDatabase(examId);
    await this.writePaperCache(examId, paper);
  }

  async getExamPaper(examId: bigint): Promise<RuntimeQuestionBase[]> {
    const cached = await this.readPaperCache(examId);
    if (cached) return cached;

    const paper = await this.buildPaperFromDatabase(examId);
    await this.writePaperCache(examId, paper);
    return paper;
  }

  private async buildPaperFromDatabase(examId: bigint): Promise<RuntimeQuestionBase[]> {
    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId },
      orderBy: { questionOrder: 'asc' },
      select: {
        questionId: true,
        sectionId: true,
        questionOrder: true,
        marks: true,
        negativeMarks: true,
        question: {
          select: {
            questionText: true,
            questionImageUrl: true,
            difficulty: true,
            isMultipleChoice: true,
            passage: {
              select: { id: true, title: true, passageText: true, imageUrl: true },
            },
            options: {
              orderBy: { displayOrder: 'asc' },
              select: { id: true, optionLabel: true, optionText: true, optionImageUrl: true },
            },
          },
        },
      },
    });

    return examQuestions.map((eq) => ({
      questionId: eq.questionId.toString(),
      sectionId: eq.sectionId?.toString() ?? null,
      questionOrder: eq.questionOrder,
      marks: eq.marks.toNumber(),
      negativeMarks: eq.negativeMarks.toNumber(),
      questionText: eq.question.questionText,
      questionImageUrl: eq.question.questionImageUrl,
      difficulty: eq.question.difficulty,
      isMultipleChoice: eq.question.isMultipleChoice,
      passage: eq.question.passage
        ? {
            id: eq.question.passage.id.toString(),
            title: eq.question.passage.title,
            passageText: eq.question.passage.passageText,
            imageUrl: eq.question.passage.imageUrl,
          }
        : null,
      options: eq.question.options.map((option) => ({
        optionId: option.id.toString(),
        optionLabel: option.optionLabel,
        optionText: option.optionText,
        optionImageUrl: option.optionImageUrl,
      })),
    }));
  }

  private async readPaperCache(examId: bigint): Promise<RuntimeQuestionBase[] | null> {
    try {
      const cached = await this.redis.client.get(paperKey(examId));
      return cached ? (JSON.parse(cached) as RuntimeQuestionBase[]) : null;
    } catch (error: unknown) {
      this.logger.warn(
        `Exam paper cache read failed, falling back to database: ${this.msg(error)}`,
      );
      return null;
    }
  }

  private async writePaperCache(examId: bigint, paper: RuntimeQuestionBase[]): Promise<void> {
    try {
      await this.redis.client.set(
        paperKey(examId),
        JSON.stringify(paper),
        'EX',
        PAPER_CACHE_TTL_SECONDS,
      );
    } catch (error: unknown) {
      this.logger.warn(`Exam paper cache write failed: ${this.msg(error)}`);
    }
  }

  // ── Start / resume an attempt ───────────────────────────────────────────

  async startAttempt(examId: bigint, userId: number): Promise<AttemptStartResult> {
    const exam = await this.prisma.exam.findUniqueOrThrow({
      where: { id: examId },
      select: EXAM_CONFIG_SELECT,
    });

    if (!exam.isPublished) {
      throw new BadRequestException('This exam is not published yet');
    }

    const now = new Date();
    if (now < exam.startTime) {
      throw new BadRequestException('This exam has not started yet');
    }

    const isLive = now <= exam.endTime;
    const isPracticeArchive = !isLive || exam.examType === 'PRACTICE_ARCHIVE';

    if (exam.isPremiumOnly) {
      await this.assertActivePremiumSubscription(userId, now);
    }

    const existingAttempts = await this.prisma.examAttempt.findMany({
      where: { examId, userId },
      orderBy: { attemptNumber: 'desc' },
      select: { id: true, attemptNumber: true, status: true, expiresAt: true, isOfficial: true },
    });

    const resumable = existingAttempts.find(
      (attempt) => attempt.status === AttemptStatus.IN_PROGRESS && attempt.expiresAt > now,
    );
    if (resumable) {
      return this.resumeAttempt(resumable.id, exam);
    }

    if (
      isLive &&
      !exam.allowMultipleRetakes &&
      existingAttempts.some((a) => a.isOfficial && COMPLETED_STATUSES.includes(a.status))
    ) {
      throw new ForbiddenException(
        'You have already completed this exam and retakes are not allowed',
      );
    }

    const nextAttemptNumber = (existingAttempts[0]?.attemptNumber ?? 0) + 1;
    const expiresAt = isPracticeArchive
      ? new Date(now.getTime() + exam.durationMinutes * 60_000)
      : new Date(Math.min(now.getTime() + exam.durationMinutes * 60_000, exam.endTime.getTime()));

    const attempt = await this.prisma.examAttempt.create({
      data: {
        examId,
        userId,
        attemptNumber: nextAttemptNumber,
        isOfficial: nextAttemptNumber === 1 && !isPracticeArchive,
        isPracticeArchive,
        expiresAt,
        status: AttemptStatus.IN_PROGRESS,
      },
      select: {
        id: true,
        examId: true,
        attemptNumber: true,
        isOfficial: true,
        isPracticeArchive: true,
        status: true,
        startedAt: true,
        expiresAt: true,
      },
    });

    const paper = await this.getExamPaper(examId);
    const questions = this.buildFreshQuestionState(paper, attempt.id, exam);

    return { attempt: this.toAttemptSummary(attempt), questions };
  }

  private async resumeAttempt(attemptId: string, exam: ExamConfig): Promise<AttemptStartResult> {
    const attempt = await this.prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        id: true,
        examId: true,
        attemptNumber: true,
        isOfficial: true,
        isPracticeArchive: true,
        status: true,
        startedAt: true,
        expiresAt: true,
      },
    });

    const paper = await this.getExamPaper(exam.id);
    const savedAnswers = await this.readAnswers(attemptId);
    const questions = this.buildFreshQuestionState(paper, attemptId, exam, savedAnswers);

    return { attempt: this.toAttemptSummary(attempt), questions };
  }

  private buildFreshQuestionState(
    paper: RuntimeQuestionBase[],
    attemptId: string,
    exam: Pick<ExamConfig, 'shuffleQuestions' | 'shuffleOptions'>,
    savedAnswers?: Map<string, RedisAnswerState>,
  ): RuntimeQuestionWithState[] {
    const orderedQuestions = exam.shuffleQuestions
      ? deterministicShuffle(paper, `${attemptId}:questions`)
      : paper;

    return orderedQuestions.map((question) => {
      const options = exam.shuffleOptions
        ? deterministicShuffle(question.options, `${attemptId}:options:${question.questionId}`)
        : question.options;
      const saved = savedAnswers?.get(question.questionId);

      return {
        ...question,
        options,
        selectedOptionId: saved?.selectedOptionId ?? null,
        selectedOptionIds: saved?.selectedOptionIds ?? [],
        navState: saved?.navState ?? QuestionNavState.NOT_VISITED,
        isLocked: saved?.isLocked ?? false,
      };
    });
  }

  private async assertActivePremiumSubscription(userId: number, now: Date): Promise<void> {
    const subscription = await this.prisma.userSubscription.findFirst({
      where: { userId, status: SubscriptionStatus.PREMIUM, validUntil: { gt: now } },
      select: { id: true },
    });
    if (!subscription) {
      throw new ForbiddenException('An active premium subscription is required for this exam');
    }
  }

  // ── Redis autosave sync ──────────────────────────────────────────────────

  async syncAnswers(
    attemptId: string,
    userId: number,
    dto: SyncAnswersDto,
  ): Promise<{ synced: number }> {
    const attempt = await this.prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { userId: true, examId: true, status: true, expiresAt: true },
    });

    this.assertOwnership(attempt.userId, userId);

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('This attempt is no longer in progress');
    }
    if (Date.now() > attempt.expiresAt.getTime() + EXPIRY_GRACE_MS) {
      throw new BadRequestException('This attempt has expired');
    }

    const exam = await this.prisma.exam.findUniqueOrThrow({
      where: { id: attempt.examId },
      select: { isOmrMode: true, durationMinutes: true },
    });

    const existing = await this.readAnswers(attemptId);
    const key = answersKey(attemptId);
    const hsetArgs: string[] = [];

    for (const answer of dto.answers) {
      const prior = existing.get(answer.questionId);

      // Strict OMR lock: once a bubble is filled under OMR mode, no incoming
      // payload may change or clear the selection — only non-answer metadata
      // (navState, timeSpentSeconds) is still allowed to update.
      if (exam.isOmrMode && prior?.isLocked) {
        const merged: RedisAnswerState = {
          ...prior,
          navState: answer.navState,
          timeSpentSeconds: answer.timeSpentSeconds,
        };
        hsetArgs.push(answer.questionId, JSON.stringify(merged));
        continue;
      }

      const selectedOptionId = answer.selectedOptionId ?? null;
      const selectedOptionIds = answer.selectedOptionIds ?? [];
      const hasAnswer = selectedOptionId !== null || selectedOptionIds.length > 0;
      const changed =
        !prior ||
        prior.selectedOptionId !== selectedOptionId ||
        JSON.stringify(prior.selectedOptionIds) !== JSON.stringify(selectedOptionIds);

      const next: RedisAnswerState = {
        selectedOptionId,
        selectedOptionIds,
        navState: answer.navState,
        timeSpentSeconds: answer.timeSpentSeconds,
        answerChangeCount: (prior?.answerChangeCount ?? 0) + (prior && changed ? 1 : 0),
        isLocked: exam.isOmrMode && hasAnswer,
      };

      hsetArgs.push(answer.questionId, JSON.stringify(next));
    }

    if (hsetArgs.length > 0) {
      await this.redis.client.hset(key, ...hsetArgs);
      await this.redis.client.expire(key, exam.durationMinutes * 60 + ANSWERS_TTL_BUFFER_SECONDS);
    }

    await this.prisma.examAttempt.update({
      where: { id: attemptId },
      data: { lastSyncedAt: new Date() },
    });

    return { synced: hsetArgs.length / 2 };
  }

  private async readAnswers(attemptId: string): Promise<Map<string, RedisAnswerState>> {
    const raw = await this.redis.client.hgetall(answersKey(attemptId));
    const map = new Map<string, RedisAnswerState>();

    for (const [questionId, json] of Object.entries(raw)) {
      try {
        map.set(questionId, JSON.parse(json) as RedisAnswerState);
      } catch {
        this.logger.warn(`Corrupted Redis answer state for question ${questionId}, skipping`);
      }
    }

    return map;
  }

  // ── Anti-cheat telemetry ─────────────────────────────────────────────────

  async recordAntiCheatEvent(
    attemptId: string,
    userId: number,
    dto: AntiCheatEventDto,
  ): Promise<{ disqualified: boolean }> {
    const attempt = await this.prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { userId: true, status: true, examId: true },
    });

    this.assertOwnership(attempt.userId, userId);

    const counterField = this.resolveCounterField(dto.eventName);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.antiCheatLog.create({
        data: {
          attemptId,
          eventName: dto.eventName,
          severity: dto.severity,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      return tx.examAttempt.update({
        where: { id: attemptId },
        data: counterField ? { [counterField]: { increment: 1 } } : {},
        select: { tabSwitchCount: true, status: true },
      });
    });

    if (counterField === 'tabSwitchCount' && updated.status === AttemptStatus.IN_PROGRESS) {
      const exam = await this.prisma.exam.findUniqueOrThrow({
        where: { id: attempt.examId },
        select: { maxTabSwitchesAllowed: true },
      });

      if (updated.tabSwitchCount > exam.maxTabSwitchesAllowed) {
        await this.prisma.examAttempt.update({
          where: { id: attemptId },
          data: { status: AttemptStatus.DISQUALIFIED, submittedAt: new Date() },
        });
        // Revoke the active runtime session — the live autosave state is no
        // longer relevant once disqualified.
        await this.redis.client.del(answersKey(attemptId));
        return { disqualified: true };
      }
    }

    return { disqualified: false };
  }

  private resolveCounterField(
    eventName: string,
  ): 'tabSwitchCount' | 'fullscreenExitCount' | 'copyPasteAttemptCount' | null {
    switch (eventName) {
      case TAB_SWITCH_EVENT:
        return 'tabSwitchCount';
      case FULLSCREEN_EXIT_EVENT:
        return 'fullscreenExitCount';
      case COPY_PASTE_ATTEMPT_EVENT:
        return 'copyPasteAttemptCount';
      default:
        return null;
    }
  }

  // ── Submit & deterministic evaluation ───────────────────────────────────

  async submitAttempt(attemptId: string, userId: number): Promise<AttemptResult> {
    const lockKey = submitLockKey(attemptId);
    const acquired = await this.redis.client.set(lockKey, '1', 'EX', SUBMIT_LOCK_TTL_SECONDS, 'NX');
    if (acquired !== 'OK') {
      throw new ConflictException('This attempt is already being submitted');
    }

    try {
      return await this.evaluateAndPersist(attemptId, userId);
    } finally {
      await this.redis.client.del(lockKey).catch((error: unknown) => {
        this.logger.warn(`Failed to release submit lock for ${attemptId}: ${this.msg(error)}`);
      });
    }
  }

  private async evaluateAndPersist(attemptId: string, userId: number): Promise<AttemptResult> {
    const attempt = await this.prisma.examAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: { userId: true, examId: true, status: true, startedAt: true, isOfficial: true },
    });

    this.assertOwnership(attempt.userId, userId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('This attempt is not in progress');
    }

    const exam = await this.prisma.exam.findUniqueOrThrow({
      where: { id: attempt.examId },
      select: { passMarks: true },
    });

    const examQuestions = await this.prisma.examQuestion.findMany({
      where: { examId: attempt.examId },
      select: {
        questionId: true,
        marks: true,
        negativeMarks: true,
        question: {
          select: {
            isMultipleChoice: true,
            topic: { select: { subjectId: true, subject: { select: { name: true } } } },
            options: { select: { id: true, isCorrect: true } },
          },
        },
      },
    });

    const evaluationQuestions: EvaluationQuestionInput[] = examQuestions.map((eq) => ({
      questionId: eq.questionId,
      isMultipleChoice: eq.question.isMultipleChoice,
      marks: eq.marks.toNumber(),
      negativeMarks: eq.negativeMarks.toNumber(),
      correctOptionIds: eq.question.options
        .filter((option) => option.isCorrect)
        .map((option) => option.id.toString()),
      subjectId: eq.question.topic?.subjectId ?? null,
      subjectName: eq.question.topic?.subject.name ?? null,
    }));

    const redisAnswers = await this.readAnswers(attemptId);
    const evaluationAnswers = new Map(
      Array.from(redisAnswers.entries()).map(([questionId, state]) => [questionId, state]),
    );

    const summary = evaluateAttempt(evaluationQuestions, evaluationAnswers);
    const now = new Date();
    const timeTakenSeconds = Math.max(
      0,
      Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000),
    );
    const isPassed = summary.obtainedScore >= exam.passMarks.toNumber();
    const today = startOfUtcDay(now);
    const tomorrow = new Date(today.getTime() + 86_400_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.examQuestionRuntime.createMany({
        data: summary.results.map((result) => ({
          attemptId,
          questionId: result.questionId,
          selectedOptionId: result.selectedOptionId,
          selectedOptionIds: result.selectedOptionIds,
          navState: result.navState,
          timeSpentSeconds: result.timeSpentSeconds,
          answerChangeCount: result.answerChangeCount,
          isLocked: result.isLocked,
          isCorrect: result.isCorrect,
          marksAwarded: result.marksAwarded,
          answeredAt: result.isCorrect !== null ? now : null,
        })),
        skipDuplicates: true,
      });

      await tx.examAttempt.update({
        where: { id: attemptId },
        data: {
          status: AttemptStatus.EVALUATED,
          submittedAt: now,
          evaluatedAt: now,
          totalAnswered: summary.totalAnswered,
          totalCorrect: summary.totalCorrect,
          totalWrong: summary.totalWrong,
          totalUnanswered: summary.totalUnanswered,
          rawPositiveMarks: summary.rawPositiveMarks,
          negativeDeducted: summary.negativeDeducted,
          obtainedScore: summary.obtainedScore,
          accuracyRate: summary.accuracyRate,
          isPassed,
          timeTakenSeconds,
          subjectWiseBreakdown: summary.subjectWiseBreakdown as unknown as Prisma.InputJsonValue,
        },
      });

      await this.incrementQuestionCounters(tx, summary.results);
      await this.upsertUserStreak(tx, userId, today, summary.totalAnswered);
      await this.upsertDailyActivity(tx, userId, today, summary);
      await this.enqueueSpacedRepetition(tx, userId, summary.results, tomorrow);
    });

    await this.redis.client.del(answersKey(attemptId)).catch((error: unknown) => {
      this.logger.warn(`Failed to clear answers hash for ${attemptId}: ${this.msg(error)}`);
    });

    if (attempt.isOfficial) {
      await this.leaderboardService
        .recordScore(attempt.examId, userId, summary.obtainedScore, timeTakenSeconds)
        .catch((error: unknown) => {
          this.logger.warn(`Failed to record leaderboard score: ${this.msg(error)}`);
        });
    }

    return {
      id: attemptId,
      examId: attempt.examId.toString(),
      status: AttemptStatus.EVALUATED,
      submittedAt: now,
      evaluatedAt: now,
      totalAnswered: summary.totalAnswered,
      totalCorrect: summary.totalCorrect,
      totalWrong: summary.totalWrong,
      totalUnanswered: summary.totalUnanswered,
      rawPositiveMarks: summary.rawPositiveMarks,
      negativeDeducted: summary.negativeDeducted,
      obtainedScore: summary.obtainedScore,
      accuracyRate: summary.accuracyRate,
      isPassed,
      timeTakenSeconds,
      subjectWiseBreakdown: summary.subjectWiseBreakdown,
    };
  }

  private async incrementQuestionCounters(
    tx: PrismaTransactionClient,
    results: { questionId: bigint; isCorrect: boolean | null }[],
  ): Promise<void> {
    const facedIds = results.map((r) => r.questionId);
    const correctIds = results.filter((r) => r.isCorrect === true).map((r) => r.questionId);
    const skippedIds = results.filter((r) => r.isCorrect === null).map((r) => r.questionId);

    if (facedIds.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: facedIds } },
        data: { totalFacedCount: { increment: 1 } },
      });
    }
    if (correctIds.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: correctIds } },
        data: { totalCorrectCount: { increment: 1 } },
      });
    }
    if (skippedIds.length > 0) {
      await tx.question.updateMany({
        where: { id: { in: skippedIds } },
        data: { totalSkippedCount: { increment: 1 } },
      });
    }
  }

  private async upsertUserStreak(
    tx: PrismaTransactionClient,
    userId: number,
    today: Date,
    totalAnswered: number,
  ): Promise<void> {
    const existing = await tx.userStreak.findUnique({
      where: { userId },
      select: { currentStreak: true, longestStreak: true, lastActivityDate: true },
    });

    if (!existing) {
      await tx.userStreak.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActivityDate: today,
          totalExamsGiven: 1,
          totalQuestionsSolved: totalAnswered,
        },
      });
      return;
    }

    const daysSinceLastActivity = diffInCalendarDays(today, existing.lastActivityDate);
    const nextStreak =
      daysSinceLastActivity === 0
        ? existing.currentStreak
        : daysSinceLastActivity === 1
          ? existing.currentStreak + 1
          : 1;

    await tx.userStreak.update({
      where: { userId },
      data: {
        currentStreak: nextStreak,
        longestStreak: Math.max(nextStreak, existing.longestStreak),
        lastActivityDate: today,
        totalExamsGiven: { increment: 1 },
        totalQuestionsSolved: { increment: totalAnswered },
      },
    });
  }

  private async upsertDailyActivity(
    tx: PrismaTransactionClient,
    userId: number,
    activityDate: Date,
    summary: { totalAnswered: number; totalCorrect: number },
  ): Promise<void> {
    await tx.userDailyActivity.upsert({
      where: { userId_activityDate: { userId, activityDate } },
      create: {
        userId,
        activityDate,
        examsCompleted: 1,
        questionsSolved: summary.totalAnswered,
        correctCount: summary.totalCorrect,
      },
      update: {
        examsCompleted: { increment: 1 },
        questionsSolved: { increment: summary.totalAnswered },
        correctCount: { increment: summary.totalCorrect },
      },
    });
  }

  /**
   * Bounded by the exam's own question count (never an unbounded external
   * collection), so this sequential loop of per-question upserts — rather
   * than a single bulk statement Prisma has no API for — is a deliberate,
   * documented trade-off, same as `QuestionsService.reconcileFrozenOptions`.
   */
  private async enqueueSpacedRepetition(
    tx: PrismaTransactionClient,
    userId: number,
    results: { questionId: bigint; isCorrect: boolean | null }[],
    nextReviewDate: Date,
  ): Promise<void> {
    const missedQuestionIds = results
      .filter((result) => result.isCorrect !== true)
      .map((result) => result.questionId);

    for (const questionId of missedQuestionIds) {
      await tx.spacedRepetitionQueue.upsert({
        where: { userId_questionId: { userId, questionId } },
        create: {
          userId,
          questionId,
          repetitionNumber: 0,
          lapsesCount: 0,
          intervalDays: 1,
          nextReviewDate,
        },
        update: {
          repetitionNumber: 0,
          intervalDays: 1,
          nextReviewDate,
          lapsesCount: { increment: 1 },
        },
      });
    }
  }

  // ── Shared helpers ───────────────────────────────────────────────────────

  private assertOwnership(ownerId: number, requesterId: number): void {
    if (ownerId !== requesterId) {
      throw new ForbiddenException('This attempt does not belong to you');
    }
  }

  private toAttemptSummary(attempt: {
    id: string;
    examId: bigint;
    attemptNumber: number;
    isOfficial: boolean;
    isPracticeArchive: boolean;
    status: AttemptStatus;
    startedAt: Date;
    expiresAt: Date;
  }): AttemptSummary {
    return {
      id: attempt.id,
      examId: attempt.examId.toString(),
      attemptNumber: attempt.attemptNumber,
      isOfficial: attempt.isOfficial,
      isPracticeArchive: attempt.isPracticeArchive,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
    };
  }

  private msg(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function diffInCalendarDays(a: Date, b: Date): number {
  const msPerDay = 86_400_000;
  const utcA = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const utcB = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((utcA - utcB) / msPerDay);
}
