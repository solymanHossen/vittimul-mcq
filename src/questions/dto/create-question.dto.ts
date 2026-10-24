import { DifficultyLevel } from '@prisma/client';
import { z } from 'zod';
import { CreateQuestionOptionSchema } from './create-question-option.dto';

/** Scalar Question fields shared by create and update — kept as a plain
 * ZodObject (no `.refine()`) so `UpdateQuestionSchema` can `.partial()` it. */
export const QuestionScalarFieldsSchema = z.object({
  topicId: z.number().int().positive(),
  passageId: z.number().int().positive().optional(),
  questionText: z.string().trim().min(1),
  questionImageUrl: z.string().url().max(2048).optional(),
  textExplanation: z.string().trim().min(1).optional(),
  explanationImageUrl: z.string().url().max(2048).optional(),
  audioExplanationUrl: z.string().url().max(2048).optional(),
  videoExplanationUrl: z.string().url().max(2048).optional(),
  sourceReference: z.string().trim().min(1).max(200).optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  isMultipleChoice: z.boolean().optional(),
  defaultMarks: z.number().positive().optional(),
  defaultNegative: z.number().min(0).optional(),
});

function hasAtLeastOneCorrectOption(data: { options: { isCorrect: boolean }[] }): boolean {
  return data.options.some((option) => option.isCorrect);
}

function singleChoiceHasExactlyOneCorrectOption(data: {
  isMultipleChoice?: boolean;
  options: { isCorrect: boolean }[];
}): boolean {
  if (data.isMultipleChoice === true) return true;
  return data.options.filter((option) => option.isCorrect).length === 1;
}

export const CreateQuestionSchema = QuestionScalarFieldsSchema.extend({
  tags: z.array(z.string().trim().min(1).max(100)).optional(),
  options: z.array(CreateQuestionOptionSchema).min(2),
})
  .strict()
  .refine(hasAtLeastOneCorrectOption, {
    message: 'At least one option must be marked as correct',
    path: ['options'],
  })
  .refine(singleChoiceHasExactlyOneCorrectOption, {
    message: 'Single-choice questions must have exactly one correct option',
    path: ['options'],
  });

export type CreateQuestionDto = z.infer<typeof CreateQuestionSchema>;
