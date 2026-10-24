import { z } from 'zod';
import { CreateQuestionSchema } from './create-question.dto';
import { MAX_BULK_QUESTIONS } from '../questions.constants';

export const BulkCreateQuestionsSchema = z
  .object({
    questions: z.array(CreateQuestionSchema).min(1).max(MAX_BULK_QUESTIONS),
  })
  .strict();

export type BulkCreateQuestionsDto = z.infer<typeof BulkCreateQuestionsSchema>;
