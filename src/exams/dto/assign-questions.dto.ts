import { z } from 'zod';

const BIGINT_STRING = /^\d+$/;

const AssignedQuestionSchema = z
  .object({
    questionId: z.string().regex(BIGINT_STRING, 'questionId must be a numeric string'),
    sectionId: z.string().regex(BIGINT_STRING, 'sectionId must be a numeric string').optional(),
    marks: z.number().positive(),
    negativeMarks: z.number().min(0),
    questionOrder: z.number().int().positive(),
  })
  .strict();

export const AssignQuestionsSchema = z
  .object({
    questions: z.array(AssignedQuestionSchema).min(1),
  })
  .strict()
  .refine(
    (data) => new Set(data.questions.map((q) => q.questionOrder)).size === data.questions.length,
    { message: 'questionOrder values must be unique within the request', path: ['questions'] },
  );

export type AssignQuestionsDto = z.infer<typeof AssignQuestionsSchema>;
