export const DEFAULT_VOCABULARY_PAGE_SIZE = 20;
export const MAX_VOCABULARY_PAGE_SIZE = 100;

/** Cap on how many due cards one `/vocabulary/due` call returns — matches
 * common SRS-app UX (e.g. a daily review-queue limit) and keeps the query
 * bounded regardless of deck size. */
export const MAX_DUE_CARDS = 50;
