import { ExamType } from '@prisma/client';
import { z } from 'zod';
import { CreateExamSectionSchema } from './create-exam-section.dto';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateExamSchema = z
  .object({
    categoryId: z.number().int().positive().optional(),
    tournamentId: z.number().int().positive().optional(),
    title: z.string().trim().min(1).max(255),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric segments separated by hyphens'),
    examType: z.nativeEnum(ExamType).optional(),
    durationMinutes: z.number().int().positive(),
    negativeMarkingRate: z.number().min(0).optional(),
    isOmrMode: z.boolean().optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    isPremiumOnly: z.boolean().optional(),
    allowMultipleRetakes: z.boolean().optional(),
    maxRetakesAllowed: z.number().int().positive().optional(),
    maxTabSwitchesAllowed: z.number().int().min(0).optional(),
    accessPin: z.string().trim().min(1).max(20).optional(),
    syllabusDescription: z.string().trim().min(1).optional(),
    studyMaterials: z.record(z.string(), z.unknown()).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    resultPublishTime: z.coerce.date().optional(),
    passMarks: z.number().min(0).optional(),
    sections: z.array(CreateExamSectionSchema).optional(),
  })
  .strict()
  .refine((data) => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  })
  .refine((data) => !data.resultPublishTime || data.resultPublishTime >= data.endTime, {
    message: 'resultPublishTime must not be before endTime',
    path: ['resultPublishTime'],
  });

export type CreateExamDto = z.infer<typeof CreateExamSchema>;
