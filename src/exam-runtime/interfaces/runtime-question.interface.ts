import { type DifficultyLevel, type QuestionNavState } from '@prisma/client';

/** One option as shown during an active attempt — `isCorrect` is never present. */
export interface RuntimeOption {
  optionId: string;
  optionLabel: string;
  optionText: string;
  optionImageUrl: string | null;
}

export interface RuntimePassage {
  id: string;
  title: string | null;
  passageText: string;
  imageUrl: string | null;
}

/** The exam-paper-cache shape: static content, independent of any one
 * attempt's in-progress answers. */
export interface RuntimeQuestionBase {
  questionId: string;
  sectionId: string | null;
  questionOrder: number;
  marks: number;
  negativeMarks: number;
  questionText: string;
  questionImageUrl: string | null;
  difficulty: DifficultyLevel;
  isMultipleChoice: boolean;
  passage: RuntimePassage | null;
  options: RuntimeOption[];
}

/** `RuntimeQuestionBase` plus the current attempt's answer state — what
 * `start`/resume actually returns to the client. */
export interface RuntimeQuestionWithState extends RuntimeQuestionBase {
  selectedOptionId: string | null;
  selectedOptionIds: string[];
  navState: QuestionNavState;
  isLocked: boolean;
}

/** Redis Hash field value for one question's autosaved answer state. */
export interface RedisAnswerState {
  selectedOptionId: string | null;
  selectedOptionIds: string[];
  navState: QuestionNavState;
  timeSpentSeconds: number;
  answerChangeCount: number;
  isLocked: boolean;
}
