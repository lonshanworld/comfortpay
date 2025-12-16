// src/lib/redis-rate-limiter.ts
/**
 * Redis-based rate limiter for distributed rate limiting across multiple instances.
 * Tracks API usage per merchant and prevents abuse.
 */

import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;

async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL not set, falling back to in-memory rate limiter');
    return null;
  }

  try {
    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
    console.log('✅ Redis connected for rate limiting');
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    return null;
  }
}

/**
 * Check if a request is allowed based on rate limit using Redis
 * @param key - Unique identifier (e.g., 'api:merchant_123', 'plugin:example.com')
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Promise<boolean> - true if request is allowed, false if rate limit exceeded
 */
export async function isAllowedRedis(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const client = await getRedisClient();
  
  // Fallback to allowing request if Redis unavailable
  if (!client) {
    console.warn('Redis unavailable, allowing request');
    return true;
  }

  try {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
    
    // Increment counter
    const count = await client.incr(windowKey);
    
    // Set expiration on first increment
    if (count === 1) {
      await client.pExpire(windowKey, windowMs);
    }
    
    return count <= limit;
  } catch (error) {
    console.error('Redis rate limit check failed:', error);
    // Fail open - allow request if Redis fails
    return true;
  }
}

/**
 * Get current usage for a key
 */
export async function getUsage(key: string, windowMs: number): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;

  try {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
    const count = await client.get(windowKey);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Failed to get usage:', error);
    return 0;
  }
}

/**
 * Reset rate limit for a specific key
 */
export async function resetLimit(key: string, windowMs: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
    await client.del(windowKey);
  } catch (error) {
    console.error('Failed to reset limit:', error);
  }
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
