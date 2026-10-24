import {
  PrismaClient,
  AttemptStatus,
  QuestionNavState,
  AntiCheatSeverity,
  Prisma,
} from '@prisma/client';
import type { Seeder } from './seeder.interface';

export class ExamAttemptSeeder implements Seeder {
  readonly name = 'ExamAttemptSeeder';
  readonly description =
    'Seeds user devices, exam sections, student exam attempts, question runtimes, and anti-cheat audit logs';
  readonly order = 6;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('📝 Seeding Exam Attempts, Question Runtimes & Anti-Cheat Logs...');

    // 1. Resolve Exam
    const exam = await prisma.exam.findFirst({
      where: { slug: 'weekly-mock-test-1' },
      include: {
        examQuestions: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
          orderBy: { questionOrder: 'asc' },
        },
      },
    });

    if (!exam || exam.examQuestions.length === 0) {
      console.warn(
        '⚠️ Live exam "weekly-mock-test-1" with questions not found. Skipping attempt seeding.',
      );
      return;
    }

    // 2. Resolve or Seed ExamSections
    const englishSubject = await prisma.subject.findFirst({ where: { slug: 'english' } });
    const gkSubject = await prisma.subject.findFirst({ where: { slug: 'general-knowledge' } });

    const section1 = await prisma.examSection.upsert({
      where: { examId_displayOrder: { examId: exam.id, displayOrder: 1 } },
      create: {
        examId: exam.id,
        subjectId: englishSubject?.id ?? null,
        title: 'Section A: Language & Literature',
        displayOrder: 1,
        totalMarks: new Prisma.Decimal('5.00'),
        durationMinutes: 10,
      },
      update: {},
    });

    const section2 = await prisma.examSection.upsert({
      where: { examId_displayOrder: { examId: exam.id, displayOrder: 2 } },
      create: {
        examId: exam.id,
        subjectId: gkSubject?.id ?? null,
        title: 'Section B: General Knowledge & Math',
        displayOrder: 2,
        totalMarks: new Prisma.Decimal('5.00'),
        durationMinutes: 10,
      },
      update: {},
    });

    // Assign sections to exam questions
    for (const [index, eq] of exam.examQuestions.entries()) {
      const targetSectionId = index < 5 ? section1.id : section2.id;
      await prisma.examQuestion.update({
        where: { examId_questionId: { examId: exam.id, questionId: eq.questionId } },
        data: { sectionId: targetSectionId },
      });
    }

    // 3. Resolve Users
    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      take: 4,
      orderBy: { id: 'asc' },
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      console.warn('⚠️ No regular users found to seed attempts.');
      return;
    }

    // 4. Ensure UserDevices
    const userDevices = new Map<number, bigint>();
    for (const user of users) {
      const fingerprint = `device-fp-${user.id}-macbook-pro`;
      const sessionHash = `sess-hash-${user.id}-${Date.now().toString(16)}`;

      const device = await prisma.userDevice.upsert({
        where: { sessionTokenHash: sessionHash },
        create: {
          userId: user.id,
          sessionTokenHash: sessionHash,
          deviceFingerprint: fingerprint,
          deviceModel: 'MacBook Pro 16" M2',
          osName: 'macOS',
          osVersion: '14.5.0',
          appVersion: '2.4.0',
          ipAddress: '103.114.98.42',
          isActiveSession: true,
        },
        update: {},
        select: { id: true },
      });
      userDevices.set(user.id, device.id);
    }

    // 5. Seed Attempts with Realistic Variation
    const now = new Date();
    const attemptsPlan = [
      {
        userIndex: 0,
        status: AttemptStatus.EVALUATED,
        accuracyRate: '90.00',
        obtainedScore: '8.75',
        rawPositive: '9.00',
        negativeDeducted: '0.25',
        totalCorrect: 9,
        totalWrong: 1,
        totalUnanswered: 0,
        timeSeconds: 720,
        meritPosition: 1,
        percentile: '98.50',
      },
      {
        userIndex: 1,
        status: AttemptStatus.EVALUATED,
        accuracyRate: '80.00',
        obtainedScore: '7.50',
        rawPositive: '8.00',
        negativeDeducted: '0.50',
        totalCorrect: 8,
        totalWrong: 2,
        totalUnanswered: 0,
        timeSeconds: 850,
        meritPosition: 2,
        percentile: '89.20',
      },
      {
        userIndex: 2,
        status: AttemptStatus.EVALUATED,
        accuracyRate: '60.00',
        obtainedScore: '5.25',
        rawPositive: '6.00',
        negativeDeducted: '0.75',
        totalCorrect: 6,
        totalWrong: 3,
        totalUnanswered: 1,
        timeSeconds: 980,
        meritPosition: 3,
        percentile: '72.00',
      },
      {
        userIndex: 3,
        status: AttemptStatus.IN_PROGRESS,
        accuracyRate: '0.00',
        obtainedScore: '0.00',
        rawPositive: '0.00',
        negativeDeducted: '0.00',
        totalCorrect: 0,
        totalWrong: 0,
        totalUnanswered: exam.examQuestions.length,
        timeSeconds: 300,
        meritPosition: null,
        percentile: null,
      },
    ];

    let totalAttempts = 0;

    for (const plan of attemptsPlan) {
      const user = users[plan.userIndex];
      if (!user) continue;

      const deviceId = userDevices.get(user.id);
      const startedAt = new Date(now.getTime() - 30 * 60_000);
      const expiresAt = new Date(startedAt.getTime() + exam.durationMinutes * 60_000);
      const submittedAt =
        plan.status === AttemptStatus.EVALUATED
          ? new Date(startedAt.getTime() + plan.timeSeconds * 1000)
          : null;
      const evaluatedAt = submittedAt ? new Date(submittedAt.getTime() + 1000) : null;

      const subjectWiseBreakdown: Prisma.InputJsonValue = [
        {
          subject: 'English',
          correct: Math.floor(plan.totalCorrect / 2),
          wrong: Math.floor(plan.totalWrong / 2),
        },
        {
          subject: 'General Knowledge',
          correct: Math.ceil(plan.totalCorrect / 2),
          wrong: Math.ceil(plan.totalWrong / 2),
        },
      ];

      const attempt = await prisma.examAttempt.upsert({
        where: {
          examId_userId_attemptNumber: {
            examId: exam.id,
            userId: user.id,
            attemptNumber: 1,
          },
        },
        create: {
          examId: exam.id,
          userId: user.id,
          deviceId: deviceId ?? null,
          attemptNumber: 1,
          attemptVersion: 1,
          isOfficial: true,
          startedAt,
          expiresAt,
          submittedAt,
          evaluatedAt,
          status: plan.status,
          ipAddress: '103.114.98.42',
          syncHash: `sync-${user.id}-${Date.now().toString(16)}`,
          tabSwitchCount: plan.userIndex === 1 ? 1 : 0,
          fullscreenExitCount: 0,
          totalAnswered: plan.totalCorrect + plan.totalWrong,
          totalCorrect: plan.totalCorrect,
          totalWrong: plan.totalWrong,
          totalUnanswered: plan.totalUnanswered,
          rawPositiveMarks: new Prisma.Decimal(plan.rawPositive),
          negativeDeducted: new Prisma.Decimal(plan.negativeDeducted),
          obtainedScore: new Prisma.Decimal(plan.obtainedScore),
          accuracyRate: new Prisma.Decimal(plan.accuracyRate),
          isPassed:
            plan.status === AttemptStatus.EVALUATED ? Number(plan.obtainedScore) >= 5 : null,
          timeTakenSeconds: plan.timeSeconds,
          meritPosition: plan.meritPosition,
          percentileScore: plan.percentile ? new Prisma.Decimal(plan.percentile) : null,
          subjectWiseBreakdown,
        },
        update: {
          status: plan.status,
          obtainedScore: new Prisma.Decimal(plan.obtainedScore),
          meritPosition: plan.meritPosition,
        },
        select: { id: true },
      });

      totalAttempts++;

      // 6. Seed Question Runtimes for this attempt
      for (const [qIndex, eq] of exam.examQuestions.entries()) {
        const correctOption = eq.question.options.find((o) => o.isCorrect);
        const wrongOption = eq.question.options.find((o) => !o.isCorrect);

        let selectedOptionId: bigint | null = null;
        let isCorrect: boolean | null = null;
        let marksAwarded: Prisma.Decimal | null = null;
        let navState: QuestionNavState = QuestionNavState.VISITED_UNANSWERED;

        if (plan.status === AttemptStatus.EVALUATED) {
          if (qIndex < plan.totalCorrect) {
            // Answered correctly
            selectedOptionId = correctOption?.id ?? null;
            isCorrect = true;
            marksAwarded = new Prisma.Decimal('1.00');
            navState = QuestionNavState.ANSWERED;
          } else if (qIndex < plan.totalCorrect + plan.totalWrong) {
            // Answered wrongly
            selectedOptionId = wrongOption?.id ?? null;
            isCorrect = false;
            marksAwarded = new Prisma.Decimal('-0.25');
            navState = QuestionNavState.ANSWERED;
          } else {
            // Left unanswered
            selectedOptionId = null;
            isCorrect = null;
            marksAwarded = new Prisma.Decimal('0.00');
            navState = QuestionNavState.NOT_VISITED;
          }
        } else {
          // In progress: mark first two as answered
          if (qIndex === 0) {
            selectedOptionId = correctOption?.id ?? null;
            navState = QuestionNavState.ANSWERED;
          } else if (qIndex === 1) {
            navState = QuestionNavState.MARKED_FOR_REVIEW;
          }
        }

        await prisma.examQuestionRuntime.upsert({
          where: {
            attemptId_questionId: {
              attemptId: attempt.id,
              questionId: eq.questionId,
            },
          },
          create: {
            attemptId: attempt.id,
            questionId: eq.questionId,
            selectedOptionId,
            selectedOptionIds: selectedOptionId ? [selectedOptionId] : [],
            navState,
            timeSpentSeconds: 35,
            answerChangeCount: 0,
            isLocked: plan.status === AttemptStatus.EVALUATED,
            isCorrect,
            marksAwarded,
            answeredAt: selectedOptionId
              ? new Date(startedAt.getTime() + (qIndex + 1) * 35_000)
              : null,
          },
          update: {
            selectedOptionId,
            navState,
            isCorrect,
            marksAwarded,
          },
        });
      }

      // 7. Seed simulated AntiCheatLog for user 1
      if (plan.userIndex === 1) {
        const antiCheatMeta: Prisma.InputJsonValue = {
          triggeredBy: 'window.blur',
          windowLostFocusDurationMs: 1420,
        };

        const existingLog = await prisma.antiCheatLog.findFirst({
          where: { attemptId: attempt.id },
          select: { id: true },
        });

        if (!existingLog) {
          await prisma.antiCheatLog.create({
            data: {
              attemptId: attempt.id,
              eventName: 'TAB_SWITCH',
              severity: AntiCheatSeverity.LOW,
              ipAddress: '103.114.98.42',
              metadata: antiCheatMeta,
              occurredAt: new Date(startedAt.getTime() + 120_000),
            },
          });
        }
      }
    }

    console.info(
      `🎯 Seeded ${totalAttempts} exam attempts with runtime question answers and anti-cheat logs.`,
    );
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    const exam = await prisma.exam.findFirst({
      where: { slug: 'weekly-mock-test-1' },
      select: { id: true },
    });
    if (exam) {
      await prisma.examAttempt.deleteMany({ where: { examId: exam.id } });
    }
    console.info('↩️ ExamAttemptSeeder rolled back.');
  }
}
