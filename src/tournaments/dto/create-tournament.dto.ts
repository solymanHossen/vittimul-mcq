import { z } from 'zod';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateTournamentSchema = z
  .object({
    seasonName: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(150)
      .regex(SLUG_PATTERN, 'slug must be lowercase alphanumeric segments separated by hyphens'),
    description: z.string().trim().min(1).optional(),
    bannerUrl: z.string().url().max(2048).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    prizePoolMeta: z.record(z.string(), z.unknown()).optional(),
    rulesMeta: z.record(z.string(), z.unknown()).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.endsAt > data.startsAt, {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

export type CreateTournamentDto = z.infer<typeof CreateTournamentSchema>;
