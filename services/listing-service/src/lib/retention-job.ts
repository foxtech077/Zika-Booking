import { prisma } from "./prisma.js";
import { Prisma } from "../generated/index.js";

// Run every 24 hours
const RETENTION_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
// 24 months in milliseconds (approx)
const RETENTION_PERIOD = 24 * 30 * 24 * 60 * 60 * 1000; 

export function startRetentionJob() {
  // Run immediately on start
  runCleanup();

  setInterval(runCleanup, RETENTION_CHECK_INTERVAL);
}

async function runCleanup() {
  try {
    const cutoffDate = new Date(Date.now() - RETENTION_PERIOD);

    // Update messages older than cutoff that haven't been deleted
    const result = await prisma.message.updateMany({
      where: {
        createdAt: { lt: cutoffDate },
        deletedAt: null,
      },
      data: {
        body: null,
        imageUrl: null,
        metadata: Prisma.DbNull,
        deletedAt: new Date(),
      },
    });

    if (result.count > 0) {
      console.log(`[Retention Job] Cleaned up ${result.count} messages older than 24 months.`);
    }
  } catch (err) {
    console.error("[Retention Job] Error running cleanup:", err);
  }
}
