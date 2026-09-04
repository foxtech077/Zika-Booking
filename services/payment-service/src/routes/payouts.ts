import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAccount, requireAdminPermission, assertResourceCountryScope, countryScopeFilter, type GuestRequest } from "../middleware/auth.js";
import { sendError } from "../lib/errors.js";
import { AdminPermission } from "@zika/types";
import { processEligiblePayouts } from "../services/payout.service.js";
import { writeAdminAudit } from "../lib/audit.js";
import { enrichPayoutsWithFlowState } from "../services/payoutFlowState.js";

export async function payoutRoutes(app: FastifyInstance) {
  // ── GET /provider/me/payouts ────────────────────────────────────────────────
  app.get("/provider/me/payouts", {
    schema: {
      tags: ["Payouts"],
      description: "List all payouts for the authenticated provider",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "string" },
          limit: { type: "string" },
          status: { type: "string" },
        },
      },
    },
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const query = req.query as { page?: string; limit?: string; status?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = { providerId: userId };
    if (query.status) where.status = query.status;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          merchant: {
            select: { payoutMethod: true, isVerified: true },
          },
        },
      }),
      prisma.payout.count({ where }),
    ]);

    reply.send({
      success: true,
      data: payouts,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── GET /provider/me/payouts/:id ────────────────────────────────────────────
  app.get("/provider/me/payouts/:id", {
    schema: {
      tags: ["Payouts"],
      description: "Get a specific payout by ID",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const { id } = req.params as { id: string };
    const payout = await prisma.payout.findFirst({
      where: { id, providerId: userId },
      include: { merchant: true },
    });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");

    reply.send({ success: true, data: payout });
  });

  // ── GET /admin/payouts ──────────────────────────────────────────────────────
  app.get("/admin/payouts", {
    schema: {
      tags: ["Admin Payouts"],
      description: "List all payouts with optional filters",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "string" },
          limit: { type: "string" },
          status: { type: "string" },
          providerId: { type: "string" },
        },
      },
    },
    preHandler: [requireAdminPermission(AdminPermission.PayoutsRead)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { page?: string; limit?: string; status?: string; providerId?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = { ...countryScopeFilter(req) };
    if (query.status) where.status = query.status;
    if (query.providerId) where.providerId = query.providerId;

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { merchant: true },
      }),
      prisma.payout.count({ where }),
    ]);

    const enriched = await enrichPayoutsWithFlowState(payouts as never[]);

    reply.send({
      success: true,
      data: enriched,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── GET /admin/payouts/:id ──────────────────────────────────────────────────
  app.get("/admin/payouts/:id", {
    schema: {
      tags: ["Admin Payouts"],
      description: "Get a payout by ID",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    preHandler: [requireAdminPermission(AdminPermission.PayoutsRead)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { merchant: true },
    });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
    if (!assertResourceCountryScope(req, reply, payout.countryCode)) return;

    const enriched = await enrichPayoutsWithFlowState([payout as never]);
    reply.send({ success: true, data: enriched[0] });
  });

  // ── POST /admin/payouts/:id/mark-paid ──────────────────────────────────────
  // Admin manually marks a payout as paid (for bank transfer / mobile money)
  app.post("/admin/payouts/:id/mark-paid", {
    schema: {
      tags: ["Admin Payouts"],
      description: "Manually mark a payout as paid (for offline bank/mobile-money transfers)",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        properties: {
          providerPayoutId: { type: "string", description: "External reference (bank ref, transaction ID, etc.)" },
        },
      },
    },
    preHandler: [requireAdminPermission(AdminPermission.PayoutsManage)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { providerPayoutId } = (req.body ?? {}) as { providerPayoutId?: string };

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
    if (!assertResourceCountryScope(req, reply, payout.countryCode)) return;
    if (payout.status === "paid") return sendError(reply, 400, "ALREADY_PAID", "Payout is already marked as paid.");
    if (payout.status === "cancelled") return sendError(reply, 400, "CANCELLED", "Cannot mark a cancelled payout as paid.");

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status: "paid",
        processedAt: new Date(),
        providerPayoutId: providerPayoutId ?? null,
        failureReason: null,
        updatedAt: new Date(),
      },
    });

    // Dispatch payout_sent push/in-app notification
    await prisma.$executeRawUnsafe(
      `INSERT INTO auth."Notification" (id, "userId", type, title, body, data, "createdAt")
       VALUES (gen_random_uuid()::text, $1, 'payout_sent', $2, $3, $4::jsonb, NOW())`,
      updated.providerId,
      "Payout Disbursed! 💰",
      `Your payout of ${updated.amount} ${updated.currency} for booking ${updated.bookingId} has been successfully processed.`,
      JSON.stringify({ bookingId: updated.bookingId, amount: Number(updated.amount), currency: updated.currency })
    ).catch((err: any) => req.log.error({ err }, "Failed to send payout notification"));

    await writeAdminAudit(req, {
      action: "payout_marked_paid",
      targetType: "payout",
      targetId: id,
      oldValue: `status:${payout.status}`,
      newValue: `status:paid;providerPayoutId:${providerPayoutId ?? ""}`,
    });

    reply.send({ success: true, data: updated });
  });

  // ── POST /admin/payouts/:id/cancel ──────────────────────────────────────────
  app.post("/admin/payouts/:id/cancel", {
    schema: {
      tags: ["Admin Payouts"],
      description: "Cancel a scheduled or processing payout",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    preHandler: [requireAdminPermission(AdminPermission.PayoutsManage)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
    if (!assertResourceCountryScope(req, reply, payout.countryCode)) return;
    if (payout.status === "paid") return sendError(reply, 400, "ALREADY_PAID", "Cannot cancel a paid payout.");
    if (payout.status === "cancelled") return sendError(reply, 400, "ALREADY_CANCELLED", "Payout is already cancelled.");
    if (payout.status === "processing") {
      return sendError(reply, 400, "PROCESSING", "Cannot cancel a payout that is currently processing.");
    }

    const updated = await prisma.payout.update({
      where: { id },
      data: { status: "cancelled", updatedAt: new Date() },
    });

    await writeAdminAudit(req, {
      action: "payout_cancelled",
      targetType: "payout",
      targetId: id,
      oldValue: `status:${payout.status}`,
      newValue: "status:cancelled",
    });

    reply.send({ success: true, data: updated });
  });

  // ── POST /admin/payouts/process-now ────────────────────────────────────────
  // Manually trigger the payout processor (run the job immediately)
  app.post("/admin/payouts/process-now", {
    schema: {
      tags: ["Admin Payouts"],
      description: "Trigger the payout processor immediately (runs all eligible scheduled payouts)",
      security: [{ bearerAuth: [] }],
    },
    preHandler: [requireAdminPermission(AdminPermission.PayoutsManage)],
  }, async (_req: FastifyRequest, reply: FastifyReply) => {
    void processEligiblePayouts().catch((err) =>
      console.error("[payout] Manual trigger failed:", err),
    );
    reply.send({ success: true, message: "Payout processor triggered." });
  });

  // ── POST /admin/payouts/:id/retry ───────────────────────────────────────────
  // Re-schedule a failed payout so the job picks it up again
  app.post("/admin/payouts/:id/retry", {
    schema: {
      tags: ["Admin Payouts"],
      description: "Reset a failed payout back to scheduled so it will be retried",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    preHandler: [requireAdminPermission(AdminPermission.PayoutsManage)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
    if (!assertResourceCountryScope(req, reply, payout.countryCode)) return;
    if (payout.status !== "failed") return sendError(reply, 400, "NOT_FAILED", "Only failed payouts can be retried.");

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status: "scheduled",
        failureReason: null,
        scheduledAt: new Date(), // process on next job run
        updatedAt: new Date(),
      },
    });

    await writeAdminAudit(req, {
      action: "payout_retried",
      targetType: "payout",
      targetId: id,
      oldValue: `status:${payout.status}`,
      newValue: "status:scheduled",
    });

    reply.send({ success: true, data: updated });
  });
}
