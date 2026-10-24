import { QuestionNavState } from '@prisma/client';

/**
 * Pure, side-effect-free deterministic evaluation engine. Takes the
 * authoritative question/correct-answer data (from Postgres) and the
 * submitted answer state (from the Redis autosave hash), and produces the
 * exact numbers `ExamRuntimeService.submitAttempt` persists. Kept separate
 * from the service so the scoring rules themselves can be exhaustively unit
 * tested without mocking Prisma, Redis, or a transaction.
 */

export interface EvaluationQuestionInput {
  questionId: bigint;
  isMultipleChoice: boolean;
  marks: number;
  negativeMarks: number;
  correctOptionIds: string[];
  subjectId: number | null;
  subjectName: string | null;
}

export interface EvaluationAnswerInput {
  selectedOptionId: string | null;
  selectedOptionIds: string[];
  navState: QuestionNavState;
  timeSpentSeconds: number;
  answerChangeCount: number;
  isLocked: boolean;
}

export interface EvaluatedQuestionResult {
  questionId: bigint;
  selectedOptionId: bigint | null;
  selectedOptionIds: bigint[];
  navState: QuestionNavState;
  timeSpentSeconds: number;
  answerChangeCount: number;
  isLocked: boolean;
  /** `null` means the question was left unanswered. */
  isCorrect: boolean | null;
  marksAwarded: number;
}

export interface SubjectBreakdownEntry {
  subjectId: number | null;
  subjectName: string | null;
  correct: number;
  wrong: number;
  unanswered: number;
  marks: number;
}

export interface EvaluationSummary {
  results: EvaluatedQuestionResult[];
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  totalUnanswered: number;
  rawPositiveMarks: number;
  negativeDeducted: number;
  obtainedScore: number;
  accuracyRate: number;
  subjectWiseBreakdown: SubjectBreakdownEntry[];
}

function isAnswered(
  question: EvaluationQuestionInput,
  answer: EvaluationAnswerInput | undefined,
): boolean {
  if (!answer) return false;
  return question.isMultipleChoice
    ? answer.selectedOptionIds.length > 0
    : answer.selectedOptionId !== null;
}

function isCorrectAnswer(
  question: EvaluationQuestionInput,
  answer: EvaluationAnswerInput,
): boolean {
  const correct = new Set(question.correctOptionIds);

  if (question.isMultipleChoice) {
    const selected = answer.selectedOptionIds;
    return selected.length === correct.size && selected.every((id) => correct.has(id));
  }

  return answer.selectedOptionId !== null && correct.has(answer.selectedOptionId);
}

export function evaluateAttempt(
  questions: EvaluationQuestionInput[],
  answers: Map<string, EvaluationAnswerInput>,
): EvaluationSummary {
  const results: EvaluatedQuestionResult[] = [];
  const breakdownBySubject = new Map<string, SubjectBreakdownEntry>();

  let totalAnswered = 0;
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnanswered = 0;
  let rawPositiveMarks = 0;
  let negativeDeducted = 0;

  for (const question of questions) {
    const answer = answers.get(question.questionId.toString());
    const answered = isAnswered(question, answer);

    const subjectKey =
      question.subjectId !== null ? question.subjectId.toString() : 'uncategorized';
    const breakdown = breakdownBySubject.get(subjectKey) ?? {
      subjectId: question.subjectId,
      subjectName: question.subjectName,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      marks: 0,
    };

    let isCorrect: boolean | null = null;
    let marksAwarded = 0;

    if (!answered) {
      totalUnanswered++;
      breakdown.unanswered++;
    } else {
      // `answer` is guaranteed defined here since `isAnswered` returned true.
      isCorrect = isCorrectAnswer(question, answer as EvaluationAnswerInput);
      totalAnswered++;

      if (isCorrect) {
        totalCorrect++;
        marksAwarded = question.marks;
        rawPositiveMarks += question.marks;
        breakdown.correct++;
        breakdown.marks += question.marks;
      } else {
        totalWrong++;
        marksAwarded = -question.negativeMarks;
        negativeDeducted += question.negativeMarks;
        breakdown.wrong++;
        breakdown.marks -= question.negativeMarks;
      }
    }

    breakdownBySubject.set(subjectKey, breakdown);

    results.push({
      questionId: question.questionId,
      selectedOptionId: answer?.selectedOptionId ? BigInt(answer.selectedOptionId) : null,
      selectedOptionIds: (answer?.selectedOptionIds ?? []).map((id) => BigInt(id)),
      navState: answer?.navState ?? QuestionNavState.NOT_VISITED,
      timeSpentSeconds: answer?.timeSpentSeconds ?? 0,
      answerChangeCount: answer?.answerChangeCount ?? 0,
      isLocked: answer?.isLocked ?? false,
      isCorrect,
      marksAwarded,
    });
  }

  const obtainedScore = Math.round((rawPositiveMarks - negativeDeducted) * 100) / 100;
  const accuracyRate =
    totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100 * 100) / 100 : 0;

  return {
    results,
    totalAnswered,
    totalCorrect,
    totalWrong,
    totalUnanswered,
    rawPositiveMarks: Math.round(rawPositiveMarks * 100) / 100,
    negativeDeducted: Math.round(negativeDeducted * 100) / 100,
    obtainedScore,
    accuracyRate,
    subjectWiseBreakdown: Array.from(breakdownBySubject.values()).map((entry) => ({
      ...entry,
      marks: Math.round(entry.marks * 100) / 100,
    })),
  };
}
