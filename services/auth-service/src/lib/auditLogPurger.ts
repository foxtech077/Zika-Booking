import { prisma } from "./prisma.js";

const RETENTION_YEARS = 7;

export async function purgeExpiredAuditLogs(): Promise<void> {
  try {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      console.log(
        `[Audit Purger] Deleted ${result.count} audit log(s) older than ${RETENTION_YEARS} years (cutoff: ${cutoff.toISOString()}).`
      );
    } else {
      console.log(`[Audit Purger] No expired audit logs found (cutoff: ${cutoff.toISOString()}).`);
    }
  } catch (error) {
    console.error(
      "[Audit Purger] Error purging expired audit logs:",
      error instanceof Error ? error.message : error
    );
  }
}
