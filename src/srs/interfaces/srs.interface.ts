import { type DifficultyLevel } from '@prisma/client';

export interface DueQuestionOption {
  id: string;
  optionLabel: string;
  optionText: string;
  optionImageUrl: string | null;
  isCorrect: boolean;
}

/**
 * Unlike exam-runtime's sanitized question, this includes `isCorrect` and
 * the explanation — SRS review is a retrospective study flow (the user
 * already attempted this question on an exam), not a live-exam security
 * boundary.
 */
export interface DueQuestion {
  questionId: string;
  questionText: string;
  questionImageUrl: string | null;
  textExplanation: string | null;
  explanationImageUrl: string | null;
  difficulty: DifficultyLevel;
  isMultipleChoice: boolean;
  options: DueQuestionOption[];
  repetitionNumber: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewDate: Date;
}

export interface SrsReviewResult {
  questionId: string;
  repetitionNumber: number;
  lapsesCount: number;
  intervalDays: number;
  easeFactor: number;
  nextReviewDate: Date;
  isMastered: boolean;
  lastReviewedAt: Date;
}

export interface FavoriteDetail {
  questionId: string;
  folderName: string;
  personalNote: string | null;
  createdAt: Date;
  questionText: string;
}
