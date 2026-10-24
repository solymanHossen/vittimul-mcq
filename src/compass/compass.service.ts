import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { daysAgo } from '../common/utils/date.util';
import { UpdateSyllabusDto } from './dto/update-syllabus.dto';
import {
  CategoryCompletion,
  CompassDashboard,
  StreakSummary,
  SubjectCompletion,
  SyllabusTrackerDetail,
} from './interfaces/compass.interface';

const HEATMAP_WINDOW_DAYS = 365;

const DEFAULT_STREAK: StreakSummary = {
  currentStreak: 0,
  longestStreak: 0,
  streakFreezeCount: 0,
  lastActivityDate: null,
  totalExamsGiven: 0,
  totalQuestionsSolved: 0,
  totalStudyMinutes: 0,
};

@Injectable()
export class CompassService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: number): Promise<CompassDashboard> {
    const [streak, activities, subjects, completedTrackers] = await Promise.all([
      this.prisma.userStreak.findUnique({ where: { userId } }),
      this.prisma.userDailyActivity.findMany({
        where: { userId, activityDate: { gte: daysAgo(HEATMAP_WINDOW_DAYS) } },
        orderBy: { activityDate: 'asc' },
        select: {
          activityDate: true,
          examsCompleted: true,
          questionsSolved: true,
          correctCount: true,
          studyMinutes: true,
          xpEarned: true,
        },
      }),
      this.prisma.subject.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          categoryId: true,
          topics: { where: { isActive: true }, select: { id: true } },
        },
      }),
      this.prisma.userSyllabusTracker.findMany({
        where: { userId, isCompleted: true },
        select: { topicId: true },
      }),
    ]);

    const completedTopicIds = new Set(completedTrackers.map((tracker) => tracker.topicId));

    const subjectCompletion: SubjectCompletion[] = subjects.map((subject) => {
      const total = subject.topics.length;
      const completed = subject.topics.filter((topic) => completedTopicIds.has(topic.id)).length;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        categoryId: subject.categoryId,
        totalTopics: total,
        completedTopics: completed,
        completionPercent: percent(completed, total),
      };
    });

    const categoryCompletion = await this.buildCategoryCompletion(subjectCompletion);

    return {
      streak: streak ? this.toStreakSummary(streak) : DEFAULT_STREAK,
      heatmap: activities,
      subjectCompletion,
      categoryCompletion,
    };
  }

  async upsertSyllabusTracker(
    userId: number,
    topicId: number,
    dto: UpdateSyllabusDto,
  ): Promise<SyllabusTrackerDetail> {
    const now = new Date();

    const row = await this.prisma.userSyllabusTracker.upsert({
      where: { userId_topicId: { userId, topicId } },
      create: {
        userId,
        topicId,
        isCompleted: dto.isCompleted ?? false,
        confidenceRating: dto.confidenceRating,
        notes: dto.notes,
        revisionCount: dto.revisionCount ?? 0,
        completedAt: dto.isCompleted ? now : null,
      },
      update: {
        ...(dto.isCompleted !== undefined
          ? { isCompleted: dto.isCompleted, completedAt: dto.isCompleted ? now : null }
          : {}),
        ...(dto.confidenceRating !== undefined ? { confidenceRating: dto.confidenceRating } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.revisionCount !== undefined ? { revisionCount: dto.revisionCount } : {}),
      },
      select: {
        topicId: true,
        isCompleted: true,
        confidenceRating: true,
        questionsAttempted: true,
        accuracyPercent: true,
        revisionCount: true,
        notes: true,
        completedAt: true,
        updatedAt: true,
      },
    });

    return { ...row, accuracyPercent: row.accuracyPercent.toNumber() };
  }

  private async buildCategoryCompletion(
    subjectCompletion: SubjectCompletion[],
  ): Promise<CategoryCompletion[]> {
    const totalsByCategory = new Map<number, { total: number; completed: number }>();
    for (const subject of subjectCompletion) {
      if (subject.categoryId === null) continue;
      const entry = totalsByCategory.get(subject.categoryId) ?? { total: 0, completed: 0 };
      entry.total += subject.totalTopics;
      entry.completed += subject.completedTopics;
      totalsByCategory.set(subject.categoryId, entry);
    }

    if (totalsByCategory.size === 0) return [];

    const categories = await this.prisma.category.findMany({
      where: { id: { in: Array.from(totalsByCategory.keys()) } },
      select: { id: true, name: true },
    });

    return categories.map((category) => {
      const totals = totalsByCategory.get(category.id) ?? { total: 0, completed: 0 };
      return {
        categoryId: category.id,
        categoryName: category.name,
        totalTopics: totals.total,
        completedTopics: totals.completed,
        completionPercent: percent(totals.completed, totals.total),
      };
    });
  }

  private toStreakSummary(streak: {
    currentStreak: number;
    longestStreak: number;
    streakFreezeCount: number;
    lastActivityDate: Date;
    totalExamsGiven: number;
    totalQuestionsSolved: number;
    totalStudyMinutes: number;
  }): StreakSummary {
    return {
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      streakFreezeCount: streak.streakFreezeCount,
      lastActivityDate: streak.lastActivityDate,
      totalExamsGiven: streak.totalExamsGiven,
      totalQuestionsSolved: streak.totalQuestionsSolved,
      totalStudyMinutes: streak.totalStudyMinutes,
    };
  }
}

function percent(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 100 * 100) / 100 : 0;
}
