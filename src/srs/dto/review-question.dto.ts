import { z } from 'zod';

export const ReviewQuestionSchema = z
  .object({
    questionId: z.string().regex(/^\d+$/, 'questionId must be a numeric string'),
    qualityGrade: z.number().int().min(0).max(5),
  })
  .strict();

export type ReviewQuestionDto = z.infer<typeof ReviewQuestionSchema>;
