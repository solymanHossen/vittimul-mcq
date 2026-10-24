import { z } from 'zod';

export const UpdateSyllabusSchema = z
  .object({
    isCompleted: z.boolean().optional(),
    confidenceRating: z.number().int().min(1).max(5).optional(),
    notes: z.string().trim().min(1).optional(),
    revisionCount: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateSyllabusDto = z.infer<typeof UpdateSyllabusSchema>;
