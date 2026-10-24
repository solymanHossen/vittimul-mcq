import { z } from 'zod';

export const CreateQuestionOptionSchema = z
  .object({
    optionLabel: z.string().trim().min(1).max(10),
    optionText: z.string().trim().min(1),
    optionImageUrl: z.string().url().max(2048).optional(),
    isCorrect: z.boolean(),
    displayOrder: z.number().int().min(1).optional(),
  })
  .strict();

export type CreateQuestionOptionDto = z.infer<typeof CreateQuestionOptionSchema>;

/**
 * Update variant: `id` (the existing `QuestionOption.id`, carried as a numeric
 * string since BigInt isn't JSON-native) is optional. Present → update that
 * row in place. Absent → create a new option. See
 * `QuestionsService.reconcileFrozenOptions` for why frozen questions can
 * never have an existing option *removed* via this shape.
 */
export const UpdateQuestionOptionSchema = CreateQuestionOptionSchema.extend({
  id: z.string().regex(/^\d+$/, 'option id must be a numeric string').optional(),
}).strict();

export type UpdateQuestionOptionDto = z.infer<typeof UpdateQuestionOptionSchema>;
