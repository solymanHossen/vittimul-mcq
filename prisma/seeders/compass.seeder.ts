import { PrismaClient, Prisma } from '@prisma/client';
import type { Seeder } from './seeder.interface';

export class CompassSeeder implements Seeder {
  readonly name = 'CompassSeeder';
  readonly description =
    'Seeds Compass study planner data: streaks, daily heatmaps, syllabus tracking, SM-2 SRS queues, and question bookmarks';
  readonly order = 7;

  async seed(prisma: PrismaClient): Promise<void> {
    console.info('🧭 Seeding Compass (Streaks, Heatmap, Syllabus, SRS, Bookmarks)...');

    const users = await prisma.user.findMany({
      where: { role: 'USER' },
      take: 5,
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (users.length === 0) {
      console.warn('⚠️ No regular users found. Skipping Compass seeding.');
      return;
    }

    const questions = await prisma.question.findMany({
      take: 10,
      orderBy: { id: 'asc' },
      select: { id: true, topicId: true },
    });

    const topics = await prisma.topic.findMany({
      take: 6,
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    const today = new Date();

    for (const [userIndex, user] of users.entries()) {
      // 1. Seed UserStreak
      const currentStreak = 5 + userIndex * 3;
      const longestStreak = currentStreak + 4;
      await prisma.userStreak.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          currentStreak,
          longestStreak,
          streakFreezeCount: 2,
          lastActivityDate: today,
          totalExamsGiven: 12 + userIndex * 5,
          totalQuestionsSolved: 240 + userIndex * 80,
          totalStudyMinutes: 720 + userIndex * 150,
        },
        update: {
          currentStreak,
          longestStreak,
          lastActivityDate: today,
        },
      });

      // 2. Seed Daily Activity Heatmap (past 14 days)
      for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
        const activityDate = new Date(today);
        activityDate.setDate(today.getDate() - dayOffset);

        // Skips some days to simulate real life
        if (dayOffset === 3 && userIndex === 1) continue;

        const questionsSolved = 15 + ((dayOffset * 3 + userIndex * 5) % 25);
        const correctCount = Math.floor(questionsSolved * 0.8);
        const studyMinutes = 20 + ((dayOffset * 5 + userIndex * 10) % 45);
        const xpEarned = questionsSolved * 10 + studyMinutes * 2;

        await prisma.userDailyActivity.upsert({
          where: {
            userId_activityDate: {
              userId: user.id,
              activityDate,
            },
          },
          create: {
            userId: user.id,
            activityDate,
            examsCompleted: dayOffset % 2 === 0 ? 1 : 0,
            questionsSolved,
            correctCount,
            vocabReviewed: 5,
            studyMinutes,
            xpEarned,
          },
          update: {
            questionsSolved,
            correctCount,
            studyMinutes,
            xpEarned,
          },
        });
      }

      // 3. Seed Syllabus Tracker
      for (const [tIndex, topic] of topics.entries()) {
        const isCompleted = tIndex <= userIndex + 1;
        const confidence = isCompleted ? 4 : 2;
        const accuracy = isCompleted ? '85.50' : '55.00';

        await prisma.userSyllabusTracker.upsert({
          where: {
            userId_topicId: {
              userId: user.id,
              topicId: topic.id,
            },
          },
          create: {
            userId: user.id,
            topicId: topic.id,
            isCompleted,
            confidenceRating: confidence,
            questionsAttempted: isCompleted ? 30 : 10,
            accuracyPercent: new Prisma.Decimal(accuracy),
            revisionCount: isCompleted ? 2 : 0,
            notes: isCompleted
              ? 'Mastered essential formulas and shortcut rules.'
              : 'Needs more problem practice.',
            completedAt: isCompleted ? today : null,
          },
          update: {
            isCompleted,
            confidenceRating: confidence,
            accuracyPercent: new Prisma.Decimal(accuracy),
          },
        });
      }

      // 4. Seed Spaced Repetition (SM-2) Queue
      for (const [qIndex, question] of questions.entries()) {
        if (qIndex > 4) break; // First 5 questions in SRS queue
        const repetition = qIndex + 1;
        const nextReview = new Date(today);
        nextReview.setDate(today.getDate() + repetition * 2);

        await prisma.spacedRepetitionQueue.upsert({
          where: {
            userId_questionId: {
              userId: user.id,
              questionId: question.id,
            },
          },
          create: {
            userId: user.id,
            questionId: question.id,
            repetitionNumber: repetition,
            lapsesCount: qIndex === 2 ? 1 : 0,
            intervalDays: repetition * 2,
            easeFactor: new Prisma.Decimal('2.50'),
            lastQualityGrade: 4,
            nextReviewDate: nextReview,
            isMastered: repetition >= 4,
            lastReviewedAt: today,
          },
          update: {
            repetitionNumber: repetition,
            nextReviewDate: nextReview,
          },
        });
      }

      // 5. Seed User Favorites (Bookmarks)
      if (questions.length >= 2) {
        const favoriteFolders = ['Tricky Math', 'Revision Priority'];
        for (const [fIndex, folderName] of favoriteFolders.entries()) {
          const q = questions[fIndex];
          if (!q) continue;

          await prisma.userFavorite.upsert({
            where: {
              userId_questionId: {
                userId: user.id,
                questionId: q.id,
              },
            },
            create: {
              userId: user.id,
              questionId: q.id,
              folderName,
              personalNote: `Review carefully before the upcoming mock exam — folder: ${folderName}`,
            },
            update: {
              folderName,
            },
          });
        }
      }
    }

    console.info(
      '📈 Successfully seeded Compass streaks, heatmaps, syllabus trackers, SRS queues, and bookmarks.',
    );
  }

  async rollback(prisma: PrismaClient): Promise<void> {
    const users = await prisma.user.findMany({ where: { role: 'USER' }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    await prisma.userStreak.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userDailyActivity.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userSyllabusTracker.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.spacedRepetitionQueue.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userFavorite.deleteMany({ where: { userId: { in: userIds } } });
    console.info('↩️ CompassSeeder rolled back.');
  }
}
