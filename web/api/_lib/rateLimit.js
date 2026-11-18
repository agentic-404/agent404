// In-memory per-IP rate limiter for POST endpoints (v1).
//
// Window: 20 POSTs per IP per 10 minutes (see config.js RATE_LIMIT).
// It lives in module memory, so it resets on cold start — that is
// acceptable for v1 (documented in the README). It is a spam brake, not
// a security boundary: Agent ID is proven on-chain at create/submit time,
// not by this API.

import { RATE_LIMIT } from './config.js';

const buckets = new Map(); // ip -> { count, resetAt }

export function checkPostRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.maxPosts) {
    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    const err = new Error(
      `Rate limit exceeded: at most ${RATE_LIMIT.maxPosts} POSTs per IP per ${RATE_LIMIT.windowMs / 60000} minutes.`,
    );
    err.name = 'RateLimited';
    err.status = 429;
    err.retryAfterSeconds = retryAfterSeconds;
    throw err;
  }
  return bucket;
}

/** Test hook: clear all buckets. */
export function resetRateLimits() {
  buckets.clear();
}
