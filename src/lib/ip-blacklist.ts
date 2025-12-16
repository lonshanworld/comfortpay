/**
 * IP Blacklist Manager using Redis
 * Allows dynamic IP banning without server restart
 */

import { createClient } from 'redis';

const BLACKLIST_PREFIX = 'blacklist:ip:';
const BLACKLIST_TTL = 86400; // 24 hours in seconds

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('⚠️ REDIS_URL not configured. IP blacklist disabled.');
      return null;
    }

    redisClient = createClient({ url: redisUrl });
    redisClient.on('error', (err: any) => console.error('Redis Client Error', err));
    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Check if an IP is blacklisted
 */
export async function isIPBlacklisted(ip: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false; // If Redis unavailable, don't block

    const key = `${BLACKLIST_PREFIX}${ip}`;
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('Error checking IP blacklist:', error);
    return false; // On error, allow request
  }
}

/**
 * Add IP to blacklist
 * @param ip - IP address to block
 * @param durationSeconds - How long to block (default: 24 hours)
 * @param reason - Why this IP is blocked
 */
export async function blacklistIP(
  ip: string,
  durationSeconds: number = BLACKLIST_TTL,
  reason: string = 'Manual ban'
): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const key = `${BLACKLIST_PREFIX}${ip}`;
    const value = JSON.stringify({
      ip,
      reason,
      bannedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + durationSeconds * 1000).toISOString(),
    });

    await client.setEx(key, durationSeconds, value);
    console.log(`🚫 IP blacklisted: ${ip} for ${durationSeconds}s. Reason: ${reason}`);
    return true;
  } catch (error) {
    console.error('Error blacklisting IP:', error);
    return false;
  }
}

/**
 * Remove IP from blacklist
 */
export async function unblacklistIP(ip: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    if (!client) return false;

    const key = `${BLACKLIST_PREFIX}${ip}`;
    await client.del(key);
    console.log(`✅ IP unblacklisted: ${ip}`);
    return true;
  } catch (error) {
    console.error('Error removing IP from blacklist:', error);
    return false;
  }
}

/**
 * Get all blacklisted IPs
 */
export async function listBlacklistedIPs(): Promise<Array<{
  ip: string;
  reason: string;
  bannedAt: string;
  expiresAt: string;
}>> {
  try {
    const client = await getRedisClient();
    if (!client) return [];

    const keys = await client.keys(`${BLACKLIST_PREFIX}*`);
    const results = [];

    for (const key of keys) {
      const value = await client.get(key);
      if (value) {
        results.push(JSON.parse(value));
      }
    }

    return results;
  } catch (error) {
    console.error('Error listing blacklisted IPs:', error);
    return [];
  }
}

/**
 * Ban IP for repeated rate limit violations
 */
export async function autoBanOnRateLimit(ip: string, violations: number): Promise<boolean> {
  // Ban for longer periods based on number of violations
  let duration = 3600; // 1 hour
  if (violations > 10) duration = 86400; // 24 hours
  if (violations > 50) duration = 604800; // 7 days

  return await blacklistIP(
    ip,
    duration,
    `Automatic ban: ${violations} rate limit violations`
  );
}
