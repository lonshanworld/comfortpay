// src/lib/rate-limiter.ts
/**
 * Simple in-memory rate limiter for Edge runtime.
 * For production with multiple instances, replace with Redis-based rate limiter.
 * 
 * Usage: isAllowed(key, limit, windowMs)
 * Example: isAllowed('api:127.0.0.1', 100, 60000) - allows 100 requests per minute per IP
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (will not work across multiple processes/containers)
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request is allowed based on rate limit
 * @param key - Unique identifier (e.g., 'api:127.0.0.1')
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns true if request is allowed, false if rate limit exceeded
 */
export function isAllowed(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window or expired window
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count < limit) {
    // Within limit
    entry.count++;
    return true;
  }

  // Rate limit exceeded
  return false;
}

/**
 * Get current rate limit status for a key
 */
export function getStatus(key: string): { count: number; limit: number; resetAt: number } | null {
  const entry = store.get(key);
  if (!entry) return null;
  return { count: entry.count, limit: 0, resetAt: entry.resetAt };
}

/**
 * Reset rate limit for a specific key
 */
export function reset(key: string): void {
  store.delete(key);
}
