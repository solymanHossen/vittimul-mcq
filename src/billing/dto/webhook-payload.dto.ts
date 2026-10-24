import { z } from 'zod';

/**
 * Generic normalized webhook body this implementation expects — real
 * providers each send their own distinct payload shape (bKash, Stripe, etc.
 * do not agree on field names), so a production integration needs a
 * per-provider adapter that maps the real callback body into this shape
 * before it reaches `BillingService.handleWebhook`.
 */
export const WebhookPayloadSchema = z
  .object({
    transactionReference: z.string().trim().min(1),
    gatewayTransactionId: z.string().trim().min(1).optional(),
    status: z.enum(['SUCCESS', 'FAILED']),
    failureReason: z.string().trim().min(1).optional(),
    rawPayload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type WebhookPayloadDto = z.infer<typeof WebhookPayloadSchema>;
