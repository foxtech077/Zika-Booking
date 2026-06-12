import { prisma } from "./prisma.js";

// PRD §8.4 — Audit logs are retained for 7 years.
// This purger runs daily and hard-deletes records older than 7 years.
// Note: In production, consider archiving to cold storage (e.g. S3)
// before deleting, to satisfy compliance requirements.

const RETENTION_YEARS = 7;
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

export function startAuditLogPurger() {
  async function purge() {
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

  // Run once at startup (delayed 15 s to let DB connections settle)
  setTimeout(() => {
    purge().catch(() => null);
  }, 15_000);

  // Then run every 24 hours
  setInterval(() => {
    purge().catch(() => null);
  }, PURGE_INTERVAL_MS);

  console.log(`[Audit Purger] Started — retention policy: ${RETENTION_YEARS} years, runs daily.`);
}
