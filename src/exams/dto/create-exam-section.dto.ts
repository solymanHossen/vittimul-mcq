import { z } from 'zod';

export const CreateExamSectionSchema = z
  .object({
    subjectId: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(150),
    displayOrder: z.number().int().min(1).optional(),
    sectionalCutoff: z.number().min(0).optional(),
    durationMinutes: z.number().int().positive().optional(),
  })
  .strict();

export type CreateExamSectionDto = z.infer<typeof CreateExamSectionSchema>;
