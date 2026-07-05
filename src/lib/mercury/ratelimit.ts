// Minimal in-memory sliding-window rate limiter. Per-instance (resets on deploy /
// is per-serverless-instance), which is enough to blunt abuse and runaway email
// cost on a single-employer MVP. Swap for a shared store (Upstash/Redis) when
// running multiple instances.

type Bucket = { count: number; resetAt: number };
const globalForRl = globalThis as unknown as { __mercuryRl?: Map<string, Bucket> };
const buckets = globalForRl.__mercuryRl ?? new Map<string, Bucket>();
globalForRl.__mercuryRl = buckets;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

// Opportunistic eviction: without it the Map accumulates one entry per distinct
// key (e.g. per source IP on the inbound endpoint) forever, an unbounded memory
// leak an attacker could drive by rotating keys. Sweeping expired buckets on a
// coarse interval keeps the Map to roughly the count of currently-active keys.
const globalForSweep = globalThis as unknown as { __mercuryRlSweep?: number };
const SWEEP_INTERVAL_MS = 60_000;

function sweepExpired(now: number): void {
  if (now - (globalForSweep.__mercuryRlSweep ?? 0) < SWEEP_INTERVAL_MS) return;
  globalForSweep.__mercuryRlSweep = now;
  for (const [k, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(k);
  }
}

/**
 * Allow up to `max` events per `windowMs` for a given key. Returns ok=false once
 * the window is exhausted.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweepExpired(now);
  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }
  if (existing.count >= max) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }
  existing.count += 1;
  return { ok: true, remaining: max - existing.count, resetAt: existing.resetAt };
}
