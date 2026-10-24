/** Header carrying the shared webhook secret — see env.validation.ts for why
 * this is a generic stand-in rather than real per-provider signature
 * verification. */
export const WEBHOOK_TOKEN_HEADER = 'x-webhook-token';
