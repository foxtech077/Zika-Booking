import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireUser, requireAdmin, type GuestRequest } from "../middleware/auth.js";
import { sendError } from "../lib/errors.js";
import { processEligiblePayouts } from "../services/payout.service.js";

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
    preHandler: [requireUser],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId, userType } = req as GuestRequest;
    if (userType !== "provider") return sendError(reply, 403, "FORBIDDEN", "Provider access required.");

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
    preHandler: [requireUser],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId, userType } = req as GuestRequest;
    if (userType !== "provider") return sendError(reply, 403, "FORBIDDEN", "Provider access required.");

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
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { page?: string; limit?: string; status?: string; providerId?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
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

    reply.send({
      success: true,
      data: payouts,
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
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const payout = await prisma.payout.findUnique({
      where: { id },
      include: { merchant: true },
    });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
    reply.send({ success: true, data: payout });
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
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { providerPayoutId } = (req.body ?? {}) as { providerPayoutId?: string };

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
    if (payout.status === "paid") return sendError(reply, 400, "ALREADY_PAID", "Payout is already marked as paid.");
    if (payout.status === "cancelled") return sendError(reply, 400, "CANCELLED", "Cannot mark a cancelled payout as paid.");

    const updated = await prisma.payout.update({
      where: { id },
      data: {
        status: "paid",
        processedAt: new Date(),
        providerPayoutId: providerPayoutId ?? null,
        updatedAt: new Date(),
      },
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
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
    if (payout.status === "paid") return sendError(reply, 400, "ALREADY_PAID", "Cannot cancel a paid payout.");
    if (payout.status === "cancelled") return sendError(reply, 400, "ALREADY_CANCELLED", "Payout is already cancelled.");

    const updated = await prisma.payout.update({
      where: { id },
      data: { status: "cancelled", updatedAt: new Date() },
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
    preHandler: [requireAdmin],
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
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };

    const payout = await prisma.payout.findUnique({ where: { id } });
    if (!payout) return sendError(reply, 404, "NOT_FOUND", "Payout not found.");
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

    reply.send({ success: true, data: updated });
  });
}
