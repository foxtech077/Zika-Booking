import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";
import type { AdminRequest } from "../middleware/auth.js";

export interface AuditEntry {
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

/**
 * Append an immutable audit row to the shared auth."AuditLog" table.
 * Every sensitive admin mutation should record one of these.
 */
export async function writeAdminAudit(
  req: FastifyRequest,
  entry: AuditEntry,
): Promise<void> {
  const { admin } = req as AdminRequest;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO auth."AuditLog" (id, "adminId", role, action, "targetType", "targetId", "oldValue", "newValue", "ipAddress", "timestamp")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      admin.adminId,
      admin.role,
      entry.action,
      entry.targetType ?? null,
      entry.targetId ?? null,
      entry.oldValue ?? null,
      entry.newValue ?? null,
      req.ip ?? "",
    );
  } catch (err) {
    // Audit failures must not break the business operation, but must be visible.
    req.log?.error?.({ err }, "[admin-audit] Failed to write audit log");
  }
}
