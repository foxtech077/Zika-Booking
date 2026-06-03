import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireUser, type GuestRequest } from "../middleware/auth.js";
import { initiateTaraPayment, initiateTaraReversal } from "../lib/tara.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  paymentProvider: z.enum(["stripe", "tara"]),
  paymentMethodId: z.string().optional(),
  mobileNumber: z.string().optional(),
});

const refundSchema = z.object({
  bookingId: z.string().uuid(),
  refundAmount: z.number().positive(),
  reason: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchBooking(bookingId: string, authHeader: string) {
  const res = await fetch(`${BOOKING_SERVICE_URL}/guests/me/bookings/${bookingId}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
  if (!json.success || !json.data) return null;
  return json.data;
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function paymentRoutes(app: FastifyInstance) {

  // ── POST /payments/initiate ───────────────────────────────────────────────
  app.post("/payments/initiate", {
    preHandler: [requireUser],
    schema: {
      tags: ["Payments"],
      summary: "Initiate a payment",

      security: [{ bearerAuth: [] }],

      body: {
        type: "object",
        required: ["bookingId", "paymentProvider"],
        properties: {
          bookingId: {
            type: "string",
            format: "uuid",
          
          },
          paymentProvider: {
            type: "string",
            enum: ["stripe", "tara"],
          },
          paymentMethodId: {
            type: "string",
          },
          mobileNumber: {
            type: "string",
           
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const authHeader = req.headers.authorization ?? "";

    const parsed = initiatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
    }

    const { bookingId, paymentProvider, paymentMethodId, mobileNumber } = parsed.data;

    // 1. Fetch booking from booking service
    const booking = await fetchBooking(bookingId, authHeader);
    if (!booking) {
      return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found.");
    }
    if (booking["status"] !== "pending_payment") {
      return sendError(reply, 409, "INVALID_BOOKING_STATUS", "Booking is not awaiting payment.");
    }

    // 2. Count existing failed/timed_out attempts
    const existingCount = await prisma.payment.count({
      where: {
        bookingId,
        status: { in: ["failed", "timed_out"] },
      },
    });

    if (existingCount >= 3) {
      return sendError(reply, 429, "PAYMENT_ATTEMPTS_EXCEEDED", "Maximum payment attempts reached for this booking.");
    }

    // 3. Build idempotency key and attempt number
    const attemptNumber = existingCount + 1;
    const idempotencyKey = `pay-${bookingId}-${attemptNumber}`;

    // 4. Extract amount and currency from booking
    const amount = booking["totalAmount"] as number;
    const currency = booking["currency"] as string;

    // 5. Create payment row
    const payment = await prisma.payment.create({
      data: {
        bookingId,
        paymentProvider,
        status: "initiated",
        attemptNumber,
        idempotencyKey,
        amount,
        currency,
      },
    });

    // 6. Provider-specific logic
    if (paymentProvider === "stripe") {
      const intent = await stripe.paymentIntents.create(
        {
          amount: Math.round(Number(amount) * 100), // cents
          currency: currency.toLowerCase(),
          capture_method: "automatic",
          metadata: {
            bookingId,
            booking_reference: (booking["reference"] as string | undefined) ?? "",
          },
          statement_descriptor_suffix: "ZIKA",
        },
        { idempotencyKey },
      );

      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerPaymentId: intent.id, status: "pending" },
      });

      return sendSuccess(reply, 201, {
        paymentId: payment.id,
        clientSecret: intent.client_secret,
        publishableKey: process.env["STRIPE_PUBLISHABLE_KEY"] ?? "",
      });
    }

    // Tara flow
    if (!mobileNumber) {
      return sendError(reply, 422, "MISSING_MOBILE", "mobileNumber is required for Tara payments.");
    }

    const taraResult = await initiateTaraPayment({
      amount: Number(amount),
      currency,
      mobileNumber,
      reference: idempotencyKey,
      description: `ZikaBooking payment for booking ${bookingId}`,
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: taraResult.taraReference,
        mobileNumberMasked: mobileNumber.slice(-4),
        status: "pending",
      },
    });

    return sendSuccess(reply, 201, {
      paymentId: payment.id,
      taraReference: taraResult.taraReference,
      message: "Check your phone for a payment prompt",
    });
  });

  // ── GET /payments/:id/status ──────────────────────────────────────────────
  app.get("/payments/:id/status", {
    preHandler: [requireUser],
    schema: {
      tags: ["Payments"],
      summary: "Get payment status",

      security: [{ bearerAuth: [] }],

      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string",
            description: "Payment ID",
          },
        },
      },
    },
  },
   async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const authHeader = req.headers.authorization ?? "";
    const { id } = req.params as { id: string };

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return sendError(reply, 404, "NOT_FOUND", "Payment not found.");
    }

    // Verify ownership by checking booking belongs to user
    const booking = await fetchBooking(payment.bookingId, authHeader);
    if (!booking) {
      return sendError(reply, 403, "FORBIDDEN", "You do not have access to this payment.");
    }

    // The booking service returns the booking only if it belongs to the authenticated user
    // If userId in token doesn't match booking guestId the booking service returns 403/404
    void userId; // ownership is enforced by booking service

    return sendSuccess(reply, 200, {
      id: payment.id,
      status: payment.status,
      bookingId: payment.bookingId,
      amount: Number(payment.amount),
      currency: payment.currency,
      capturedAt: payment.capturedAt?.toISOString() ?? null,
    });
  });

  // ── POST /payments/refunds (internal) ─────────────────────────────────────
  app.post("/payments/refunds", {
    schema: {
      tags: ["Payments"],
      summary: "Create refund",

      body: {
        type: "object",
        required: ["bookingId", "refundAmount"],
        properties: {
          bookingId: {
            type: "string",
            format: "uuid",
          },
          refundAmount: {
            type: "number",
            
          },
          reason: {
            type: "string",
           
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
    }

    const { bookingId, refundAmount, reason } = parsed.data;

    // 1. Find the most recent captured payment for this booking
    const payment = await prisma.payment.findFirst({
      where: { bookingId, status: "captured" },
      orderBy: { attemptNumber: "desc" },
    });

    if (!payment) {
      return sendError(reply, 404, "PAYMENT_NOT_FOUND", "No captured payment found for this booking.");
    }

    // 2. Check no existing refund for this payment
    const existingRefund = await prisma.refund.findUnique({ where: { paymentId: payment.id } });
    if (existingRefund) {
      return sendError(reply, 409, "REFUND_EXISTS", "A refund already exists for this payment.");
    }

    // 3. Insert refund row
    const refund = await prisma.refund.create({
      data: {
        paymentId: payment.id,
        bookingId,
        amount: refundAmount,
        currency: payment.currency,
        reason: reason ?? null,
        status: "pending",
      },
    });

    // 4. Provider-specific refund logic
    if (payment.paymentProvider === "stripe") {
      try {
        const re = await stripe.refunds.create({
          payment_intent: payment.providerPaymentId ?? undefined,
          amount: Math.round(refundAmount * 100),
          reason: "requested_by_customer",
        });

        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: "submitted", providerRefundId: re.id },
        });

        return sendSuccess(reply, 201, { refundId: refund.id, status: "submitted" });
      } catch (err) {
        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: "failed", failureReason: (err as Error).message },
        });
        return sendError(reply, 502, "REFUND_FAILED", "Failed to submit refund to Stripe.");
      }
    }

    // Tara reversal
    try {
      const reversal = await initiateTaraReversal({
        taraReference: payment.providerPaymentId ?? "",
        amount: refundAmount,
        reason: reason ?? "requested_by_customer",
      });

      await prisma.refund.update({
        where: { id: refund.id },
        data: { status: "submitted", providerRefundId: reversal.reversalId },
      });

      return sendSuccess(reply, 201, { refundId: refund.id, status: "submitted" });
    } catch (err) {
      await prisma.refund.update({
        where: { id: refund.id },
        data: { status: "failed", failureReason: (err as Error).message },
      });
      return sendError(reply, 502, "REFUND_FAILED", "Failed to submit Tara reversal.");
    }
  });
}
