/** Upper bound enforced by `BulkCreateQuestionsSchema` — keeps one bulk-create
 * transaction's query count and lock duration bounded. */
export const MAX_BULK_QUESTIONS = 100;

/** Default and maximum page size for `GET /questions`. */
export const DEFAULT_QUESTIONS_PAGE_SIZE = 20;
export const MAX_QUESTIONS_PAGE_SIZE = 100;
