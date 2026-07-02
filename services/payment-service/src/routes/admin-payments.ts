import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
import { sendError } from "../lib/errors.js";
import { PaymentStatus, RefundStatus } from "../generated/index.js";
import { notifyBookingServiceOfRefund, queueFailedRefundNotification, calculateAlreadyRefunded } from "../services/refund.service.js";

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
    try {
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
    } catch (err) {
      return sendError(reply, 400, "GET_PAYMENTS_FAILED", (err as Error).message);
    }
  });

  // ── GET /admin/refunds/pending ──────────────────────────────────────────────
  app.get("/admin/refunds/pending", {
    schema: {
      tags: ["Admin Payments"],
      description: "Get pending refunds",
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const refunds = await prisma.refund.findMany({
        where: { status: "pending" },
        include: { payment: true },
        orderBy: { createdAt: "desc" },
      });

      reply.send({
        success: true,
        data: refunds,
      });
    } catch (err) {
      return sendError(reply, 400, "GET_PENDING_REFUNDS_FAILED", (err as Error).message);
    }
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
    try {
      const { id } = req.params as { id: string };
      const { action, reason } = req.body as { action: "approve" | "deny"; reason?: string };

      const refund = await prisma.refund.findUnique({ where: { id } });
      if (!refund) {
        return sendError(reply, 404, "REFUND_NOT_FOUND", "Refund not found.");
      }
      if (refund.status !== RefundStatus.pending && refund.status !== RefundStatus.submitted) {
        return sendError(reply, 400, "REFUND_NOT_PROCESSABLE", "Refund is not processable (must be pending or submitted).");
      }
 
      if (action === "deny") {
        const updated = await prisma.refund.update({
          where: { id },
          data: {
            status: RefundStatus.failed,
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
          status: RefundStatus.succeeded,
          refundedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const payment = await prisma.payment.findUnique({ where: { id: refund.paymentId } });
      const provider = payment?.paymentProvider ?? "unknown";

      // Calculate total refunded amount to determine full or partial refund
      const totalRefunded = await calculateAlreadyRefunded(refund.paymentId);
      const isFullyRefunded = payment ? (totalRefunded >= Number(payment.amount)) : false;

      // Update the payment status to refunded or partially_refunded
      await prisma.payment.update({
        where: { id: refund.paymentId },
        data: { status: isFullyRefunded ? PaymentStatus.refunded : PaymentStatus.partially_refunded }
      });

      const refundedAtDate = updated.refundedAt ?? new Date();
      try {
        await notifyBookingServiceOfRefund(refund.bookingId, {
          refundId: refund.id,
          refundAmount: Number(refund.amount),
          provider,
          refundedAt: refundedAtDate,
        });
      } catch (notifyErr) {
        const notifyMessage = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
        req.log.error(
          notifyErr,
          `[admin-payments] Failed to notify booking service of refund for booking ${refund.bookingId}. Message: ${notifyMessage}. Queuing retry...`
        );
        await queueFailedRefundNotification(
          refund.bookingId,
          refund.id,
          Number(refund.amount),
          provider,
          refundedAtDate
        );
      }

      reply.send({ success: true, data: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return sendError(reply, 400, "PROCESS_REFUND_FAILED", message);
    }
  });
}
