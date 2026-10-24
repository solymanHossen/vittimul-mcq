import { ReportReason } from '@prisma/client';
import { z } from 'zod';

export const CreateReportSchema = z
  .object({
    reason: z.nativeEnum(ReportReason),
    userNotes: z.string().trim().min(1).optional(),
    screenshotUrl: z.string().url().max(2048).optional(),
  })
  .strict();

export type CreateReportDto = z.infer<typeof CreateReportSchema>;
