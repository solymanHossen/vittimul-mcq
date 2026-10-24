export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  streakFreezeCount: number;
  lastActivityDate: Date | null;
  totalExamsGiven: number;
  totalQuestionsSolved: number;
  totalStudyMinutes: number;
}

export interface HeatmapDay {
  activityDate: Date;
  examsCompleted: number;
  questionsSolved: number;
  correctCount: number;
  studyMinutes: number;
  xpEarned: number;
}

export interface SubjectCompletion {
  subjectId: number;
  subjectName: string;
  categoryId: number | null;
  totalTopics: number;
  completedTopics: number;
  completionPercent: number;
}

export interface CategoryCompletion {
  categoryId: number;
  categoryName: string;
  totalTopics: number;
  completedTopics: number;
  completionPercent: number;
}

export interface CompassDashboard {
  streak: StreakSummary;
  heatmap: HeatmapDay[];
  subjectCompletion: SubjectCompletion[];
  categoryCompletion: CategoryCompletion[];
}

export interface SyllabusTrackerDetail {
  topicId: number;
  isCompleted: boolean;
  confidenceRating: number | null;
  questionsAttempted: number;
  accuracyPercent: number;
  revisionCount: number;
  notes: string | null;
  completedAt: Date | null;
  updatedAt: Date;
}
