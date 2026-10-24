import { type DifficultyLevel } from '@prisma/client';

/**
 * Fully-mapped, staff-facing view of a Question — `bigint` ids stringified,
 * `Decimal` fields converted to `number`, and the `questionTags` join rows
 * flattened to a plain `tags` array. Built once in `QuestionsService` so
 * controllers and tests work with plain, predictable types instead of raw
 * Prisma payload shapes.
 */
export interface QuestionOptionDetail {
  id: string;
  optionLabel: string;
  optionText: string;
  optionImageUrl: string | null;
  isCorrect: boolean;
  displayOrder: number;
}

export interface QuestionTagDetail {
  id: number;
  name: string;
  slug: string;
}

export interface QuestionDetail {
  id: string;
  uuid: string;
  topicId: number | null;
  passageId: string | null;
  createdById: number | null;
  verifiedById: number | null;
  questionText: string;
  questionImageUrl: string | null;
  textExplanation: string | null;
  explanationImageUrl: string | null;
  audioExplanationUrl: string | null;
  videoExplanationUrl: string | null;
  sourceReference: string | null;
  difficulty: DifficultyLevel;
  isMultipleChoice: boolean;
  defaultMarks: number;
  defaultNegative: number;
  version: number;
  isFrozen: boolean;
  totalFacedCount: number;
  totalCorrectCount: number;
  totalSkippedCount: number;
  isVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  options: QuestionOptionDetail[];
  tags: QuestionTagDetail[];
}

export interface PassageDetail {
  id: string;
  title: string | null;
  passageText: string;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
