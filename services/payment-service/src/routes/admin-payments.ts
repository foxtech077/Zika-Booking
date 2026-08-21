import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAdminPermission, assertResourceCountryScope, countryScopeFilter, type AdminRequest } from "../middleware/auth.js";
import { sendError } from "../lib/errors.js";
import { AdminPermission } from "@zika/types";
import { PaymentStatus, RefundStatus } from "../generated/index.js";
import { notifyBookingServiceOfRefund, queueFailedRefundNotification, calculateAlreadyRefunded } from "../services/refund.service.js";
import { writeAdminAudit } from "../lib/audit.js";

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
    preHandler: [requireAdminPermission(AdminPermission.PaymentsRead)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as { page?: string; limit?: string };
      const page = Math.max(1, parseInt(query.page || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt(query.limit || "20", 10)));
      const skip = (page - 1) * limit;

      const scope = countryScopeFilter(req);

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: scope,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.payment.count({ where: scope }),
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
    preHandler: [requireAdminPermission(AdminPermission.RefundsRead)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const scope = countryScopeFilter(req);
      const refunds = await prisma.refund.findMany({
        where: {
          status: "pending",
          ...(scope ? { payment: { is: scope } } : {}),
        },
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

  // ── GET /admin/refunds/manual ──────────────────────────────────────────────
  app.get("/admin/refunds/manual", {
    schema: {
      tags: ["Admin Payments"],
      description: "Get mobile-money refunds requiring manual processing",
      querystring: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "completed", "failed"] },
          page: { type: "string" },
          limit: { type: "string" },
        },
      },
    },
    preHandler: [requireAdminPermission(AdminPermission.RefundsRead)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = req.query as { status?: string; page?: string; limit?: string };
      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "50", 10)));
      const scope = countryScopeFilter(req);
      const where = {
        ...(query.status ? { status: query.status as "pending" | "completed" | "failed" } : {}),
        ...(scope ? { payment: { is: scope } } : {}),
      };
      const [refunds, total] = await Promise.all([
        prisma.manualRefund.findMany({
          where,
          include: {
            payment: {
              select: {
                countryCode: true,
                paymentProvider: true,
                providerPaymentId: true,
                paymentMethodType: true,
                mobileNumberMasked: true,
                amount: true,
                currency: true,
                chargedAmount: true,
                chargedCurrency: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.manualRefund.count({ where }),
      ]);
      return reply.send({ success: true, data: refunds, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
      return sendError(reply, 400, "GET_MANUAL_REFUNDS_FAILED", (err as Error).message);
    }
  });

  // ── POST /admin/refunds/manual/:id/complete ────────────────────────────────
  app.post("/admin/refunds/manual/:id/complete", {
    schema: {
      tags: ["Admin Payments"],
      description: "Record a completed mobile-money refund",
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      body: { type: "object", required: ["refundReference"], properties: { refundReference: { type: "string" }, note: { type: "string" } } },
    },
    preHandler: [requireAdminPermission(AdminPermission.RefundsProcess)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { refundReference, note } = req.body as { refundReference: string; note?: string };
    try {
      const manualRefund = await prisma.manualRefund.findUnique({ where: { id }, include: { payment: true } });
      if (!manualRefund) return sendError(reply, 404, "MANUAL_REFUND_NOT_FOUND", "Manual refund not found.");
      if (!assertResourceCountryScope(req, reply, manualRefund.payment.countryCode)) return;
      if (!refundReference?.trim()) return sendError(reply, 400, "REFUND_REFERENCE_REQUIRED", "A mobile-money refund reference is required.");
      if (manualRefund.status !== "pending") return sendError(reply, 400, "MANUAL_REFUND_NOT_PENDING", "Only pending manual refunds can be completed.");

      const processedAt = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.manualRefund.updateMany({
          where: { id, status: "pending" },
          data: {
            status: "completed",
            refundReference: refundReference.trim(),
            note: note?.trim() || null,
            processedBy: (req as AdminRequest).admin.adminId,
            processedAt,
          },
        });
        if (claimed.count === 0) throw new Error("Only pending manual refunds can be completed.");

        await tx.refund.create({
          data: {
            paymentId: manualRefund.paymentId,
            bookingId: manualRefund.bookingId,
            amount: manualRefund.amount,
            currency: manualRefund.currency,
            status: RefundStatus.succeeded,
            reason: manualRefund.reason,
            providerRefundId: refundReference.trim(),
            refundedAt: processedAt,
            idempotencyKey: `manual-refund-record:${id}`,
          },
        });

        const refundTotal = await tx.refund.aggregate({
          where: { paymentId: manualRefund.paymentId, status: { not: RefundStatus.failed } },
          _sum: { amount: true },
        });
        const chargedAmount = Number(manualRefund.payment.chargedAmount ?? manualRefund.payment.amount);
        await tx.payment.update({
          where: { id: manualRefund.paymentId },
          data: { status: Number(refundTotal._sum.amount ?? 0) >= chargedAmount ? PaymentStatus.refunded : PaymentStatus.partially_refunded },
        });
        return tx.manualRefund.findUnique({ where: { id } });
      });

      try {
        await notifyBookingServiceOfRefund(manualRefund.bookingId, {
          refundId: `manual:${id}`,
          refundAmount: Number(manualRefund.amount),
          provider: manualRefund.payment.paymentProvider,
          refundedAt: processedAt,
        });
      } catch (notifyErr) {
        await queueFailedRefundNotification(manualRefund.bookingId, `manual:${id}`, Number(manualRefund.amount), manualRefund.payment.paymentProvider, processedAt);
        req.log.error({ err: notifyErr }, "Failed to notify booking service of manual refund");
      }

      await writeAdminAudit(req, {
        action: "manual_refund_completed",
        targetType: "manual_refund",
        targetId: id,
        oldValue: "status:pending",
        newValue: `status:completed;reference:${refundReference.trim()}`,
      });
      return reply.send({ success: true, data: updated });
    } catch (err) {
      return sendError(reply, 400, "COMPLETE_MANUAL_REFUND_FAILED", (err as Error).message);
    }
  });

  // ── POST /admin/refunds/manual/:id/fail ────────────────────────────────────
  app.post("/admin/refunds/manual/:id/fail", {
    schema: {
      tags: ["Admin Payments"],
      description: "Record a failed mobile-money refund attempt",
      params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      body: { type: "object", required: ["reason"], properties: { reason: { type: "string" } } },
    },
    preHandler: [requireAdminPermission(AdminPermission.RefundsProcess)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { reason } = req.body as { reason: string };
    try {
      const manualRefund = await prisma.manualRefund.findUnique({ where: { id }, include: { payment: true } });
      if (!manualRefund) return sendError(reply, 404, "MANUAL_REFUND_NOT_FOUND", "Manual refund not found.");
      if (!assertResourceCountryScope(req, reply, manualRefund.payment.countryCode)) return;
      if (!reason?.trim()) return sendError(reply, 400, "FAILURE_REASON_REQUIRED", "A failure reason is required.");
      if (manualRefund.status !== "pending") return sendError(reply, 400, "MANUAL_REFUND_NOT_PENDING", "Only pending manual refunds can be failed.");
      // Claim the pending status atomically so a concurrent /complete cannot
      // be overwritten by this update. Same guard as the complete endpoint.
      const updated = await prisma.$transaction(async (tx) => {
        const claimed = await tx.manualRefund.updateMany({
          where: { id, status: "pending" },
          data: { status: "failed", failureReason: reason.trim(), processedBy: (req as AdminRequest).admin.adminId, processedAt: new Date() },
        });
        if (claimed.count === 0) throw new Error("Only pending manual refunds can be failed.");
        return tx.manualRefund.findUnique({ where: { id } });
      });
      await writeAdminAudit(req, { action: "manual_refund_failed", targetType: "manual_refund", targetId: id, oldValue: "status:pending", newValue: `status:failed;reason:${reason.trim()}` });
      return reply.send({ success: true, data: updated });
    } catch (err) {
      return sendError(reply, 400, "FAIL_MANUAL_REFUND_FAILED", (err as Error).message);
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
    preHandler: [requireAdminPermission(AdminPermission.RefundsProcess)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { action, reason } = req.body as { action: "approve" | "deny"; reason?: string };

      const refund = await prisma.refund.findUnique({ where: { id } });
      if (!refund) {
        return sendError(reply, 404, "REFUND_NOT_FOUND", "Refund not found.");
      }
      const payment = await prisma.payment.findUnique({ where: { id: refund.paymentId } });
      if (!assertResourceCountryScope(req, reply, payment?.countryCode)) return;
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
        await writeAdminAudit(req, {
          action: "refund_denied",
          targetType: "refund",
          targetId: id,
          oldValue: `status:${refund.status}`,
          newValue: `status:${RefundStatus.failed};reason:${reason ?? ""}`,
        });
        reply.send({ success: true, data: updated });
        return;
      }
 
      // "approve" action
      // Execute the actual provider refund via the shared refund service so the
      // money is genuinely returned to the guest (Stripe refund / Tara reversal).
      const { issueRefund } = await import("../services/refund.service.js");
      const approved = await issueRefund(
        {
          id: payment!.id,
          bookingId: refund.bookingId,
          paymentProvider: payment!.paymentProvider,
          providerPaymentId: payment!.providerPaymentId,
          amount: payment!.amount,
          currency: payment!.currency,
          status: payment!.status,
        },
        {
          amount: Number(refund.amount),
          reason: reason ?? "Approved by admin",
          idempotencyKey: `refund:${refund.id}:admin-approve`,
        },
      );

      const updated = await prisma.refund.update({
        where: { id },
        data: {
          status: RefundStatus.succeeded,
          refundedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const provider = payment?.paymentProvider ?? "unknown";

      // Calculate total refunded amount to determine full or partial refund.
      // Refunds are stored in the platform charge currency, so compare against
      // the charged amount, not the listing-currency payment.amount.
      const totalRefunded = await calculateAlreadyRefunded(refund.paymentId);
      const isFullyRefunded = payment ? (totalRefunded >= Number(payment.chargedAmount ?? payment.amount)) : false;

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

      await writeAdminAudit(req, {
        action: "refund_approved",
        targetType: "refund",
        targetId: id,
        oldValue: `status:${refund.status};providerStatus:${approved.status}`,
        newValue: `status:${RefundStatus.succeeded};refundId:${approved.id}`,
      });

      reply.send({ success: true, data: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return sendError(reply, 400, "PROCESS_REFUND_FAILED", message);
    }
  });
}
