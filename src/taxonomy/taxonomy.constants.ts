/** Redis key backing the cached, public `Category -> Subject -> Topic` tree. */
export const TAXONOMY_TREE_CACHE_KEY = 'taxonomy:tree:v1';

/**
 * How long a cached tree snapshot is trusted before the next read falls back
 * to Postgres. Every mutating endpoint (create/update/delete on Category,
 * Subject, or Topic) invalidates this key immediately, so this only bounds
 * staleness for the rare case another process changes the data out-of-band.
 */
export const TAXONOMY_TREE_CACHE_TTL_SECONDS = 3_600;
