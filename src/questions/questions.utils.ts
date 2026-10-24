/**
 * Converts a free-text tag label into its canonical slug — lowercase,
 * alphanumeric segments joined by single hyphens. Used to deduplicate tags
 * that differ only in case/whitespace (e.g. "React JS" and "react js" both
 * resolve to the same `Tag` row).
 */
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
