import Redis from "ioredis";

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    redisClient.on("error", (err) => console.error("[Redis] error:", (err as Error).message));
  }
  return redisClient;
}

/**
 * Acquire a Redis mutex lock and run `fn` while held.
 * Returns immediately without running `fn` if another instance holds the lock.
 * Falls back to running `fn` if Redis is unreachable (optimistic lock is the real guard).
 */
export async function withRedisLock(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<void>,
): Promise<void> {
  let acquired = false;
  try {
    acquired = (await getRedis().set(key, "1", "EX", ttlSeconds, "NX")) === "OK";
  } catch {
    // Redis down — run anyway; the DB-level optimistic lock prevents double-processing
    console.warn(`[Redis] lock ${key}: Redis unreachable, proceeding without distributed lock`);
    acquired = true;
  }

  if (!acquired) return;

  try {
    await fn();
  } finally {
    try {
      await getRedis().del(key);
    } catch {
      // lock will expire via TTL — safe to ignore
    }
  }
}
