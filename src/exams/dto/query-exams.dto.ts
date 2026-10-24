import { ExamType } from '@prisma/client';
import { z } from 'zod';
import { DEFAULT_EXAMS_PAGE_SIZE, MAX_EXAMS_PAGE_SIZE } from '../exams.constants';

export const QueryExamsSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(MAX_EXAMS_PAGE_SIZE)
      .default(DEFAULT_EXAMS_PAGE_SIZE),
    categoryId: z.coerce.number().int().positive().optional(),
    examType: z.nativeEnum(ExamType).optional(),
    status: z.enum(['upcoming', 'live', 'archived']).optional(),
  })
  .strict();

export type QueryExamsDto = z.infer<typeof QueryExamsSchema>;
