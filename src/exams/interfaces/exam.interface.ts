import { type ExamType } from '@prisma/client';

export interface ExamSectionDetail {
  id: string;
  subjectId: number | null;
  title: string;
  displayOrder: number;
  totalMarks: number;
  sectionalCutoff: number | null;
  durationMinutes: number | null;
}

/** Full exam metadata — never includes its questions (those are only
 * revealed via exam-runtime once an attempt has started). */
export interface ExamDetail {
  id: string;
  uuid: string;
  categoryId: number | null;
  tournamentId: number | null;
  title: string;
  slug: string;
  examType: ExamType;
  totalQuestions: number;
  totalMarks: number;
  passMarks: number;
  durationMinutes: number;
  negativeMarkingRate: number;
  isOmrMode: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isPremiumOnly: boolean;
  allowMultipleRetakes: boolean;
  maxRetakesAllowed: number;
  maxTabSwitchesAllowed: number;
  syllabusDescription: string | null;
  studyMaterials: unknown;
  startTime: Date;
  endTime: Date;
  resultPublishTime: Date | null;
  isPublished: boolean;
  isResultsPublished: boolean;
  totalParticipants: number;
  highestScore: number | null;
  averageScore: number | null;
  createdAt: Date;
  updatedAt: Date;
  sections: ExamSectionDetail[];
}

export type ExamStatus = 'upcoming' | 'live' | 'archived';

export interface ExamSummary {
  id: string;
  categoryId: number | null;
  title: string;
  slug: string;
  examType: ExamType;
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  isPremiumOnly: boolean;
  startTime: Date;
  endTime: Date;
  status: ExamStatus;
}

export interface PaginatedExams {
  items: ExamSummary[];
  total: number;
  page: number;
  limit: number;
}
