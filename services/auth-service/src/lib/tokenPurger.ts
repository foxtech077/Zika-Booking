import { prisma } from "./prisma.js";

export function startTokenPurger() {
  const PURGE_INTERVAL_MS = 60 * 60 * 1000; // hourly

  async function purge() {
    try {
      const now = new Date();

      // 1. Delete expired verification tokens
      const tokenResult = await prisma.verificationToken.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });
      if (tokenResult.count > 0) {
        console.log(`[Token Purger] Purged ${tokenResult.count} expired verification tokens.`);
      }

      // 2. Delete users stuck in pending_verification for > 48 hours
      //    (token TTL is 24h, so 48h is a generous buffer)
      const STALE_CUTOFF = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      const userResult = await prisma.user.deleteMany({
        where: {
          status: "pending_verification",
          createdAt: { lt: STALE_CUTOFF },
        },
      });
      if (userResult.count > 0) {
        console.log(`[Token Purger] Purged ${userResult.count} stale unverified users (pending > 48h).`);
      }
    } catch (error) {
      console.error("[Token Purger] Error during purge:", error instanceof Error ? error.message : error);
    }
  }

  // Run immediately on startup with a small delay
  setTimeout(() => {
    purge().catch(() => null);
  }, 10000);

  // Then run every hour
  setInterval(() => {
    purge().catch(() => null);
  }, PURGE_INTERVAL_MS);
}
