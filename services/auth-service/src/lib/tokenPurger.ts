import { prisma } from "./prisma.js";

export function startTokenPurger() {
  const PURGE_INTERVAL_MS = 60 * 60 * 1000; // hourly

  async function purge() {
    try {
      const now = new Date();
      const result = await prisma.verificationToken.deleteMany({
        where: {
          expiresAt: { lt: now },
        },
      });
      if (result.count > 0) {
        console.log(`[Token Purger] Purged ${result.count} expired verification tokens.`);
      }
    } catch (error) {
      console.error("[Token Purger] Error purging expired tokens:", error instanceof Error ? error.message : error);
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
