import { type AttemptStatus } from '@prisma/client';
import { type RuntimeQuestionWithState } from './runtime-question.interface';
import { type SubjectBreakdownEntry } from '../exam-evaluation.util';

export interface AttemptSummary {
  id: string;
  examId: string;
  attemptNumber: number;
  isOfficial: boolean;
  isPracticeArchive: boolean;
  status: AttemptStatus;
  startedAt: Date;
  expiresAt: Date;
}

export interface AttemptStartResult {
  attempt: AttemptSummary;
  questions: RuntimeQuestionWithState[];
}

export interface AttemptResult {
  id: string;
  examId: string;
  status: AttemptStatus;
  submittedAt: Date;
  evaluatedAt: Date;
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnanswered: number;
  rawPositiveMarks: number;
  negativeDeducted: number;
  obtainedScore: number;
  accuracyRate: number;
  isPassed: boolean;
  timeTakenSeconds: number;
  subjectWiseBreakdown: SubjectBreakdownEntry[];
}
