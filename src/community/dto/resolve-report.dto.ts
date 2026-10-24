import { z } from 'zod';

export const ResolveReportSchema = z
  .object({
    status: z.enum(['RESOLVED', 'REJECTED']),
    resolutionNotes: z.string().trim().min(1).optional(),
  })
  .strict();

export type ResolveReportDto = z.infer<typeof ResolveReportSchema>;
