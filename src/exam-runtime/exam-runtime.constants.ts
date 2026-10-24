/** Redis Hash of an attempt's autosaved answers — field = questionId, value = JSON `RedisAnswerState`. */
export function answersKey(attemptId: string): string {
  return `exam:attempt:${attemptId}:answers`;
}

/** Redis String holding the JSON-serialized sanitized question paper for an exam. */
export function paperKey(examId: bigint): string {
  return `exam:paper:${examId}`;
}

/** Redis distributed lock guarding against a double-submission race. */
export function submitLockKey(attemptId: string): string {
  return `lock:submit:${attemptId}`;
}

/** Flat TTL for the cached exam paper — questions rarely change once an exam
 * is published (and when they do, the versioning policy handles it), so a
 * generous fixed TTL is simpler than computing time-until-exam-end. */
export const PAPER_CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Submit-lock hold time — long enough to cover one evaluation transaction,
 * short enough that a crashed request doesn't block a legitimate retry. */
export const SUBMIT_LOCK_TTL_SECONDS = 15;

/** Extra buffer (beyond the exam's own duration) kept on the Redis answers
 * hash's TTL so a slightly-late final sync/submit is never lost to expiry. */
export const ANSWERS_TTL_BUFFER_SECONDS = 2 * 60 * 60;

/** Network grace window for `sync`/`submit` after `expiresAt` has technically passed. */
export const EXPIRY_GRACE_MS = 10_000;

export const TAB_SWITCH_EVENT = 'TAB_SWITCH';
export const FULLSCREEN_EXIT_EVENT = 'FULLSCREEN_EXIT';
export const COPY_PASTE_ATTEMPT_EVENT = 'COPY_PASTE_ATTEMPT';
