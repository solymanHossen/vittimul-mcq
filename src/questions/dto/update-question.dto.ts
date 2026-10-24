import { z } from 'zod';
import { QuestionScalarFieldsSchema } from './create-question.dto';
import { UpdateQuestionOptionSchema } from './create-question-option.dto';

export const UpdateQuestionSchema = QuestionScalarFieldsSchema.partial()
  .extend({
    tags: z.array(z.string().trim().min(1).max(100)).optional(),
    options: z.array(UpdateQuestionOptionSchema).min(2).optional(),
  })
  .strict()
  .refine((data) => !data.options || data.options.some((option) => option.isCorrect), {
    // The complementary "exactly one correct option for single-choice
    // questions" rule is intentionally NOT checked here: when `options` is
    // sent without `isMultipleChoice` in the same request, only the service
    // (which knows the question's current isMultipleChoice from the
    // database) can resolve the effective value. See
    // QuestionsService.updateQuestion.
    message: 'At least one option must be marked as correct',
    path: ['options'],
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateQuestionDto = z.infer<typeof UpdateQuestionSchema>;
