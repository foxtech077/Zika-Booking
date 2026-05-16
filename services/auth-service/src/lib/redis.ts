import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });

    redisClient.on("error", (err) => {
      console.error("[Redis] connection error:", err.message);
    });

    redisClient.on("connect", () => {
      console.log("[Redis] connected");
    });
  }
  return redisClient;
}

// ── Rate-limit helpers ────────────────────────────────────────────────────────

/**
 * Increment a sliding-window counter in Redis.
 * Returns the new count. The key is set to expire after `windowSeconds`.
 */
export async function incrementCounter(
  key: string,
  windowSeconds: number,
): Promise<number> {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  return count;
}

/**
 * Set a value with TTL (used for cooldown flags).
 */
export async function setCooldown(key: string, ttlSeconds: number): Promise<void> {
  await getRedis().set(key, "1", "EX", ttlSeconds);
}

export async function getCooldown(key: string): Promise<boolean> {
  const val = await getRedis().get(key);
  return val !== null;
}

/**
 * Store a WebAuthn challenge with a short TTL.
 */
export async function setChallenge(
  key: string,
  challenge: string,
  ttlSeconds = 300,
): Promise<void> {
  await getRedis().set(key, challenge, "EX", ttlSeconds);
}

export async function getAndDeleteChallenge(key: string): Promise<string | null> {
  const redis = getRedis();
  const val = await redis.get(key);
  if (val) await redis.del(key);
  return val;
}
