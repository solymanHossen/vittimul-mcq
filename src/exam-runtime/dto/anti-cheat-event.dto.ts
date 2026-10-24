import { AntiCheatSeverity } from '@prisma/client';
import { z } from 'zod';

export const AntiCheatEventSchema = z
  .object({
    eventName: z.string().trim().min(1).max(50),
    severity: z.nativeEnum(AntiCheatSeverity),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type AntiCheatEventDto = z.infer<typeof AntiCheatEventSchema>;
