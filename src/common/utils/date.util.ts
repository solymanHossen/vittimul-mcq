/**
 * Shared calendar-day helpers for the `@db.Date` columns used across the
 * retention/learning modules (SRS, vocabulary, streaks, syllabus tracking).
 * All operate in UTC so a "day" means the same thing regardless of the
 * server's local timezone.
 */

/** Midnight UTC on the same calendar day as `date` — matches how Prisma
 * reads/writes `@db.Date` columns. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function daysAgo(days: number, from: Date = new Date()): Date {
  return addDays(startOfUtcDay(from), -days);
}
