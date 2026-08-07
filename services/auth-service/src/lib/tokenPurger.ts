import { prisma } from "./prisma.js";

export async function purgeExpiredTokens(): Promise<void> {
  try {
    const now = new Date();

    const tokenResult = await prisma.verificationToken.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });
    if (tokenResult.count > 0) {
      console.log(`[Token Purger] Purged ${tokenResult.count} expired verification tokens.`);
    }

    const STALE_CUTOFF = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const userResult = await prisma.user.deleteMany({
      where: {
        status: "pending_verification",
        createdAt: { lt: STALE_CUTOFF },
      },
    });
    if (userResult.count > 0) {
      console.log(`[Token Purger] Purged ${userResult.count} stale unverified users (pending > 24h).`);
    }
  } catch (error) {
    console.error("[Token Purger] Error during purge:", error instanceof Error ? error.message : error);
  }
}
