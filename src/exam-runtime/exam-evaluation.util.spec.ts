import { QuestionNavState } from '@prisma/client';
import {
  evaluateAttempt,
  type EvaluationAnswerInput,
  type EvaluationQuestionInput,
} from './exam-evaluation.util';

function singleChoiceQuestion(
  overrides: Partial<EvaluationQuestionInput> = {},
): EvaluationQuestionInput {
  return {
    questionId: 1n,
    isMultipleChoice: false,
    marks: 1,
    negativeMarks: 0.25,
    correctOptionIds: ['10'],
    subjectId: 1,
    subjectName: 'English',
    ...overrides,
  };
}

function answer(overrides: Partial<EvaluationAnswerInput> = {}): EvaluationAnswerInput {
  return {
    selectedOptionId: null,
    selectedOptionIds: [],
    navState: QuestionNavState.ANSWERED,
    timeSpentSeconds: 30,
    answerChangeCount: 0,
    isLocked: false,
    ...overrides,
  };
}

describe('evaluateAttempt() — single choice', () => {
  it('awards full marks for a correct answer', () => {
    const question = singleChoiceQuestion();
    const answers = new Map([['1', answer({ selectedOptionId: '10' })]]);

    const summary = evaluateAttempt([question], answers);

    expect(summary.results[0]).toMatchObject({ isCorrect: true, marksAwarded: 1 });
    expect(summary).toMatchObject({
      totalAnswered: 1,
      totalCorrect: 1,
      totalWrong: 0,
      totalUnanswered: 0,
      rawPositiveMarks: 1,
      negativeDeducted: 0,
      obtainedScore: 1,
      accuracyRate: 100,
    });
  });

  it('deducts the negative marks for a wrong answer', () => {
    const question = singleChoiceQuestion();
    const answers = new Map([['1', answer({ selectedOptionId: '11' })]]);

    const summary = evaluateAttempt([question], answers);

    expect(summary.results[0]).toMatchObject({ isCorrect: false, marksAwarded: -0.25 });
    expect(summary.obtainedScore).toBe(-0.25);
    expect(summary.totalWrong).toBe(1);
  });

  it('awards zero marks and counts as unanswered when no option is selected', () => {
    const question = singleChoiceQuestion();
    const summary = evaluateAttempt([question], new Map());

    expect(summary.results[0]).toMatchObject({ isCorrect: null, marksAwarded: 0 });
    expect(summary.totalUnanswered).toBe(1);
    expect(summary.totalAnswered).toBe(0);
    expect(summary.accuracyRate).toBe(0);
  });

  it('treats an empty selectedOptionIds array (no selectedOptionId) as unanswered', () => {
    const question = singleChoiceQuestion();
    const answers = new Map([['1', answer({ selectedOptionId: null })]]);

    const summary = evaluateAttempt([question], answers);

    expect(summary.results[0]?.isCorrect).toBeNull();
  });
});

describe('evaluateAttempt() — multiple choice (exact set match)', () => {
  function mcqQuestion(overrides: Partial<EvaluationQuestionInput> = {}): EvaluationQuestionInput {
    return singleChoiceQuestion({
      isMultipleChoice: true,
      correctOptionIds: ['10', '11'],
      marks: 2,
      negativeMarks: 0.5,
      ...overrides,
    });
  }

  it('is correct only when the selected set exactly matches the correct set', () => {
    const question = mcqQuestion();
    const answers = new Map([['1', answer({ selectedOptionIds: ['11', '10'] })]]);

    const summary = evaluateAttempt([question], answers);

    expect(summary.results[0]).toMatchObject({ isCorrect: true, marksAwarded: 2 });
  });

  it('is wrong when only a subset of the correct options is selected (partial credit is not given)', () => {
    const question = mcqQuestion();
    const answers = new Map([['1', answer({ selectedOptionIds: ['10'] })]]);

    const summary = evaluateAttempt([question], answers);

    expect(summary.results[0]).toMatchObject({ isCorrect: false, marksAwarded: -0.5 });
  });

  it('is wrong when an extra incorrect option is included alongside the correct ones', () => {
    const question = mcqQuestion();
    const answers = new Map([['1', answer({ selectedOptionIds: ['10', '11', '12'] })]]);

    const summary = evaluateAttempt([question], answers);

    expect(summary.results[0]?.isCorrect).toBe(false);
  });

  it('counts as unanswered when selectedOptionIds is empty', () => {
    const question = mcqQuestion();
    const answers = new Map([['1', answer({ selectedOptionIds: [] })]]);

    const summary = evaluateAttempt([question], answers);

    expect(summary.results[0]?.isCorrect).toBeNull();
    expect(summary.totalUnanswered).toBe(1);
  });
});

describe('evaluateAttempt() — aggregation across multiple questions', () => {
  it('sums scores and groups the subject-wise breakdown correctly', () => {
    const questions: EvaluationQuestionInput[] = [
      singleChoiceQuestion({
        questionId: 1n,
        correctOptionIds: ['10'],
        subjectId: 1,
        subjectName: 'English',
      }),
      singleChoiceQuestion({
        questionId: 2n,
        correctOptionIds: ['20'],
        subjectId: 1,
        subjectName: 'English',
      }),
      singleChoiceQuestion({
        questionId: 3n,
        correctOptionIds: ['30'],
        subjectId: 2,
        subjectName: 'Math',
      }),
    ];
    const answers = new Map([
      ['1', answer({ selectedOptionId: '10' })], // correct, subject 1
      ['2', answer({ selectedOptionId: '21' })], // wrong, subject 1
      // question 3 left unanswered, subject 2
    ]);

    const summary = evaluateAttempt(questions, answers);

    expect(summary.totalAnswered).toBe(2);
    expect(summary.totalCorrect).toBe(1);
    expect(summary.totalWrong).toBe(1);
    expect(summary.totalUnanswered).toBe(1);
    expect(summary.obtainedScore).toBe(0.75); // +1 - 0.25
    expect(summary.accuracyRate).toBe(50);

    const english = summary.subjectWiseBreakdown.find((entry) => entry.subjectId === 1);
    const math = summary.subjectWiseBreakdown.find((entry) => entry.subjectId === 2);
    expect(english).toMatchObject({ correct: 1, wrong: 1, unanswered: 0, marks: 0.75 });
    expect(math).toMatchObject({ correct: 0, wrong: 0, unanswered: 1, marks: 0 });
  });

  it('groups uncategorized questions (no subject) under a stable bucket without crashing', () => {
    const question = singleChoiceQuestion({ subjectId: null, subjectName: null });
    const summary = evaluateAttempt([question], new Map());

    expect(summary.subjectWiseBreakdown).toEqual([
      { subjectId: null, subjectName: null, correct: 0, wrong: 0, unanswered: 1, marks: 0 },
    ]);
  });

  it('returns an empty, zeroed summary for an empty question list', () => {
    const summary = evaluateAttempt([], new Map());

    expect(summary).toMatchObject({
      results: [],
      totalAnswered: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalUnanswered: 0,
      obtainedScore: 0,
      accuracyRate: 0,
      subjectWiseBreakdown: [],
    });
  });

  it('rounds the obtained score to 2 decimal places to avoid floating-point drift', () => {
    const questions: EvaluationQuestionInput[] = [
      singleChoiceQuestion({ questionId: 1n, marks: 1, negativeMarks: 0.33 }),
      singleChoiceQuestion({
        questionId: 2n,
        correctOptionIds: ['20'],
        marks: 1,
        negativeMarks: 0.33,
      }),
      singleChoiceQuestion({
        questionId: 3n,
        correctOptionIds: ['30'],
        marks: 1,
        negativeMarks: 0.33,
      }),
    ];
    const answers = new Map([
      ['1', answer({ selectedOptionId: '99' })], // wrong
      ['2', answer({ selectedOptionId: '99' })], // wrong
      ['3', answer({ selectedOptionId: '99' })], // wrong
    ]);

    const summary = evaluateAttempt(questions, answers);

    expect(summary.obtainedScore).toBe(-0.99);
  });
});
