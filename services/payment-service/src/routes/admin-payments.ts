import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";

export async function adminPaymentRoutes(app: FastifyInstance) {
  // ── GET /admin/payments ─────────────────────────────────────────────────────
  app.get("/admin/payments", {
    schema: {
      tags: ["Admin Payments"],
      description: "Get paginated list of payments",
      querystring: {
        type: "object",
        properties: {
          page: { type: "string" },
          limit: { type: "string" },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { page?: string; limit?: string };
    const page = Math.max(1, parseInt(query.page || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit || "20", 10)));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count(),
    ]);

    reply.send({
      success: true,
      data: payments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // ── GET /admin/refunds/pending ──────────────────────────────────────────────
  app.get("/admin/refunds/pending", {
    schema: {
      tags: ["Admin Payments"],
      description: "Get pending refunds",
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const refunds = await prisma.refund.findMany({
      where: { status: "pending" },
      include: { payment: true },
      orderBy: { createdAt: "desc" },
    });

    reply.send({
      success: true,
      data: refunds,
    });
  });

  // ── POST /admin/refunds/:id/process ─────────────────────────────────────────
  app.post("/admin/refunds/:id/process", {
    schema: {
      tags: ["Admin Payments"],
      description: "Approve or deny a refund",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        required: ["action"],
        properties: {
          action: { type: "string", enum: ["approve", "deny"] },
          reason: { type: "string" },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { action, reason } = req.body as { action: "approve" | "deny"; reason?: string };

    const refund = await prisma.refund.findUnique({ where: { id } });
    if (!refund) {
      reply.status(404).send({ success: false, error: { message: "Refund not found" } });
      return;
    }
    if (refund.status !== "pending") {
      reply.status(400).send({ success: false, error: { message: "Refund is not pending" } });
      return;
    }

    if (action === "deny") {
      const updated = await prisma.refund.update({
        where: { id },
        data: {
          status: "failed",
          failureReason: reason || "Denied by admin",
          updatedAt: new Date(),
        },
      });
      reply.send({ success: true, data: updated });
      return;
    }

    // "approve" action
    // In a real system, call Stripe API to execute refund here.
    const updated = await prisma.refund.update({
      where: { id },
      data: {
        status: "succeeded",
        refundedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    
    // Update the payment status to refunded
    await prisma.payment.update({
      where: { id: refund.paymentId },
      data: { status: "refunded" }
    });

    reply.send({ success: true, data: updated });
  });
}
