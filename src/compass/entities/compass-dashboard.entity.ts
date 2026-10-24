import { ApiProperty } from '@nestjs/swagger';
import type {
  CategoryCompletion,
  CompassDashboard,
  HeatmapDay,
  StreakSummary,
  SubjectCompletion,
} from '../interfaces/compass.interface';

export class StreakSummaryEntity {
  @ApiProperty({ example: 5 })
  currentStreak: number;

  @ApiProperty({ example: 12 })
  longestStreak: number;

  @ApiProperty({ example: 0 })
  streakFreezeCount: number;

  @ApiProperty({ nullable: true })
  lastActivityDate: Date | null;

  @ApiProperty({ example: 20 })
  totalExamsGiven: number;

  @ApiProperty({ example: 450 })
  totalQuestionsSolved: number;

  @ApiProperty({ example: 0 })
  totalStudyMinutes: number;

  constructor(streak: StreakSummary) {
    this.currentStreak = streak.currentStreak;
    this.longestStreak = streak.longestStreak;
    this.streakFreezeCount = streak.streakFreezeCount;
    this.lastActivityDate = streak.lastActivityDate;
    this.totalExamsGiven = streak.totalExamsGiven;
    this.totalQuestionsSolved = streak.totalQuestionsSolved;
    this.totalStudyMinutes = streak.totalStudyMinutes;
  }
}

export class HeatmapDayEntity {
  @ApiProperty()
  activityDate: Date;

  @ApiProperty({ example: 1 })
  examsCompleted: number;

  @ApiProperty({ example: 48 })
  questionsSolved: number;

  @ApiProperty({ example: 40 })
  correctCount: number;

  @ApiProperty({ example: 0 })
  studyMinutes: number;

  @ApiProperty({ example: 0 })
  xpEarned: number;

  constructor(day: HeatmapDay) {
    this.activityDate = day.activityDate;
    this.examsCompleted = day.examsCompleted;
    this.questionsSolved = day.questionsSolved;
    this.correctCount = day.correctCount;
    this.studyMinutes = day.studyMinutes;
    this.xpEarned = day.xpEarned;
  }
}

export class SubjectCompletionEntity {
  @ApiProperty({ example: 1 })
  subjectId: number;

  @ApiProperty({ example: 'English' })
  subjectName: string;

  @ApiProperty({ example: 1, nullable: true })
  categoryId: number | null;

  @ApiProperty({ example: 10 })
  totalTopics: number;

  @ApiProperty({ example: 4 })
  completedTopics: number;

  @ApiProperty({ example: 40 })
  completionPercent: number;

  constructor(entry: SubjectCompletion) {
    this.subjectId = entry.subjectId;
    this.subjectName = entry.subjectName;
    this.categoryId = entry.categoryId;
    this.totalTopics = entry.totalTopics;
    this.completedTopics = entry.completedTopics;
    this.completionPercent = entry.completionPercent;
  }
}

export class CategoryCompletionEntity {
  @ApiProperty({ example: 1 })
  categoryId: number;

  @ApiProperty({ example: 'Bank Job Preparation' })
  categoryName: string;

  @ApiProperty({ example: 40 })
  totalTopics: number;

  @ApiProperty({ example: 10 })
  completedTopics: number;

  @ApiProperty({ example: 25 })
  completionPercent: number;

  constructor(entry: CategoryCompletion) {
    this.categoryId = entry.categoryId;
    this.categoryName = entry.categoryName;
    this.totalTopics = entry.totalTopics;
    this.completedTopics = entry.completedTopics;
    this.completionPercent = entry.completionPercent;
  }
}

export class CompassDashboardEntity {
  @ApiProperty({ type: StreakSummaryEntity })
  streak: StreakSummaryEntity;

  @ApiProperty({ type: [HeatmapDayEntity] })
  heatmap: HeatmapDayEntity[];

  @ApiProperty({ type: [SubjectCompletionEntity] })
  subjectCompletion: SubjectCompletionEntity[];

  @ApiProperty({ type: [CategoryCompletionEntity] })
  categoryCompletion: CategoryCompletionEntity[];

  constructor(dashboard: CompassDashboard) {
    this.streak = new StreakSummaryEntity(dashboard.streak);
    this.heatmap = dashboard.heatmap.map((day) => new HeatmapDayEntity(day));
    this.subjectCompletion = dashboard.subjectCompletion.map(
      (entry) => new SubjectCompletionEntity(entry),
    );
    this.categoryCompletion = dashboard.categoryCompletion.map(
      (entry) => new CategoryCompletionEntity(entry),
    );
  }
}
