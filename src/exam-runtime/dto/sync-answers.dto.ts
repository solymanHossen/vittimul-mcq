import { QuestionNavState } from '@prisma/client';
import { z } from 'zod';

const BIGINT_STRING = /^\d+$/;

const SyncAnswerSchema = z
  .object({
    questionId: z.string().regex(BIGINT_STRING, 'questionId must be a numeric string'),
    selectedOptionId: z
      .string()
      .regex(BIGINT_STRING, 'selectedOptionId must be a numeric string')
      .nullable()
      .optional(),
    selectedOptionIds: z
      .array(z.string().regex(BIGINT_STRING, 'selectedOptionIds must be numeric strings'))
      .optional(),
    navState: z.nativeEnum(QuestionNavState),
    timeSpentSeconds: z.number().int().min(0),
  })
  .strict();

export const SyncAnswersSchema = z
  .object({
    answers: z.array(SyncAnswerSchema).min(1),
  })
  .strict();

export type SyncAnswersDto = z.infer<typeof SyncAnswersSchema>;
export type SyncAnswerDto = z.infer<typeof SyncAnswerSchema>;
