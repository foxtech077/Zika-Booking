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

  app.post("/create-intent", { preHandler: [requireUser], schema: {
    tags: ["Payments"],
    summary: "Create Stripe PaymentIntent (New Card Flow)",
    body: {
      type: "object",
      required: ["bookingId"],
      properties: {
        bookingId: { type: "string", format: "uuid" },
      },
    },
  }}, async (req, reply) => {
    const { userId } = req as GuestRequest;
    const { bookingId } = req.body as { bookingId: string };
    const authHeader = req.headers.authorization ?? "";
  
    // ── 1. Fetch booking ────────────────────────────────────────────────────
    const booking = await fetchBooking(bookingId, authHeader);
    if (!booking) {
      return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found.");
    }
  
    const amount = booking["totalAmount"] as number;
    const currency = (booking["currency"] as string).toLowerCase();
  
    if (amount <= 0) {
      return sendError(reply, 400, "INVALID_AMOUNT", "Payment amount must be greater than 0.");
    }
  
    // ── 2. Idempotency check ────────────────────────────────────────────────
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId,
        status: { in: ["initiated", "captured"] },
      },
    });
  
    if (existingPayment?.providerPaymentId) {
      const existingIntent = await stripe.paymentIntents.retrieve(
        existingPayment.providerPaymentId
      );
  
      if (!["canceled", "succeeded"].includes(existingIntent.status)) {
        return sendSuccess(reply, 200, {
          paymentId: existingPayment.id,
          clientSecret: existingIntent.client_secret,
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        });
      }
    }
  
    // ── 3. Customer account ─────────────────────────────────────────────────
    let customerAccount = await prisma.customerAccount.findUnique({
      where: {
        userId_paymentProvider: { userId, paymentProvider: "stripe" },
      },
    });
  
    if (customerAccount) {
      try {
        await stripe.customers.retrieve(customerAccount.providerCustomerId);
      } catch {
        customerAccount = null;
      }
    }
  
    if (!customerAccount) {
      const customer = await stripe.customers.create({ metadata: { userId } });
  
      const existingAccount = await prisma.customerAccount.findUnique({
        where: {
          userId_paymentProvider: { userId, paymentProvider: "stripe" },
        },
      });
  
      if (existingAccount) {
        customerAccount = await prisma.customerAccount.update({
          where: {
            userId_paymentProvider: { userId, paymentProvider: "stripe" },
          },
          data: { providerCustomerId: customer.id },
        });
      } else {
        customerAccount = await prisma.customerAccount.create({
          data: { userId, paymentProvider: "stripe", providerCustomerId: customer.id },
        });
      }
    }
  
    // ── 4. Create payment record ────────────────────────────────────────────
    const payment = await prisma.payment.create({
      data: {
        bookingId,
        paymentProvider: "stripe",
        status: "initiated",
        amount,
        currency,
        idempotencyKey: `pi-${bookingId}`,
      },
    });
  
    // ── 5. Create Stripe intent ─────────────────────────────────────────────
    const intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(Number(amount) * 100),
        currency,
        customer: customerAccount.providerCustomerId,
        automatic_payment_methods: { enabled: true },
        metadata: { bookingId },
      },
      { idempotencyKey: `pi-${bookingId}` }
    );
  
    // ── 6. Save intent ID to payment record ────────────────────────────────
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: intent.id },
    });
  
    return sendSuccess(reply, 200, {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  });
  // ── POST /payments/initiate ───────────────────────────────────────────────
  app.post("/initiate", { preHandler: [requireUser], schema: {
    tags: ["Payments"],
    summary: "Pay using saved card or Tara",
    body: {
      type: "object",
      required: ["bookingId", "paymentProvider"],
      properties: {
        bookingId: { type: "string", format: "uuid" },
        paymentProvider: { type: "string", enum: ["stripe", "tara"] },
        paymentMethodId: { type: "string" },
        mobileNumber: { type: "string" },
      },
    },
  }}, async (req, reply) => {
    const { userId } = req as GuestRequest;
  
    // ── 1. Validate body ──────────────────────────────────────────────────
    const parsed = initiatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.");
    }
  
    const { bookingId, paymentProvider, paymentMethodId, mobileNumber } = parsed.data;
  
    // ── 2. Fetch booking ──────────────────────────────────────────────────
    const authHeader = req.headers.authorization ?? "";
    const booking = await fetchBooking(bookingId, authHeader);
    if (!booking) {
      return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found.");
    }
  
    const amount = booking["totalAmount"] as number;
    const currency = (booking["currency"] as string).toLowerCase();
  
    // ── 3. Idempotency check ──────────────────────────────────────────────
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId,
        status: { in: ["initiated", "captured", "pending"] },
      },
    });
  
    if (existingPayment) {
      return sendError(reply, 409, "DUPLICATE_PAYMENT", "A payment for this booking already exists.");
    }
  
    // ── 4. Calculate attempt number ───────────────────────────────────────
    const failedCount = await prisma.payment.count({
      where: {
        bookingId,
        status: { in: ["failed", "timed_out"] },
      },
    });
  
    const attemptNumber = failedCount + 1;
    const idempotencyKey = `pay-${bookingId}-${attemptNumber}`;
  
    // ── 5. Create payment record ──────────────────────────────────────────
    const payment = await prisma.payment.create({
      data: {
        bookingId,
        paymentProvider,
        status: "initiated",
        amount,
        currency,
        attemptNumber,
        idempotencyKey,
      },
    });
  
    // ── 6. Stripe flow ────────────────────────────────────────────────────
    if (paymentProvider === "stripe") {
  
      // Customer lookup
      const customerAccount = await prisma.customerAccount.findUnique({
        where: {
          userId_paymentProvider: { userId, paymentProvider: "stripe" },
        },
      });
  
      if (!customerAccount) {
        return sendError(reply, 404, "CUSTOMER_NOT_FOUND", "Stripe customer account not found.");
      }
  
      // Saved card lookup
      const savedMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: paymentMethodId,
          userId,
          isDeleted: false,
          paymentProvider: "stripe",
        },
      });
  
      if (!savedMethod?.providerPmId) {
        return sendError(reply, 404, "PAYMENT_METHOD_NOT_FOUND", "Saved payment method not found.");
      }
  
      // Create Stripe intent
      let intent;
      try {
        intent = await stripe.paymentIntents.create(
          {
            amount: Math.round(Number(amount) * 100),
            currency,
            customer: customerAccount.providerCustomerId,
            payment_method: savedMethod.providerPmId,
            off_session: true,
            confirm: true,
            capture_method: "automatic",
            metadata: {
              bookingId,
              booking_reference: (booking["reference"] as string | undefined) ?? "",
            },
            statement_descriptor_suffix: "ZIKA",
          },
          { idempotencyKey: `pi-${bookingId}-${attemptNumber}` }, // ✅ attempt-aware
        );
      } catch (err: any) {
        if (err.code === "authentication_required") {
          const paymentIntent = err.raw?.payment_intent;
          return sendSuccess(reply, 200, {
            requiresAction: true,
            clientSecret: paymentIntent?.client_secret,
            paymentId: payment.id,
          });
        }
        throw err;
      }
  
      // Update payment row
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: intent.id,
          status: "captured",
          attemptNumber,
          idempotencyKey,
        },
      });
  
      return sendSuccess(reply, 201, { paymentId: payment.id });
    }
  
    // ── 7. Tara flow ──────────────────────────────────────────────────────
    if (paymentProvider === "tara") {
      const taraResult = await initiateTaraPayment({
        amount: Number(amount),
        currency,
        mobileNumber: mobileNumber!,
        reference: idempotencyKey,
        description: `Booking ${bookingId}`,
      });
  
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: taraResult.taraReference,
          status: "pending",
        },
      });
  
      return sendSuccess(reply, 201, {
        paymentId: payment.id,
        taraReference: taraResult.taraReference,
      });
    }
  });

  // ── GET /payments/:id/status ──────────────────────────────────────────────
  app.get("/:id/status", { preHandler: [requireUser],schema: {
    tags: ["Payments"],
    params: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
      },
    },
  },

 }, async (req: FastifyRequest, reply: FastifyReply) => {
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
  app.post("/refunds",{schema: {
    tags: ["Payments"],
    body: {
      type: "object",
      required: ["bookingId", "refundAmount"],
      properties: {
        bookingId: { type: "string", format: "uuid" },
        refundAmount: { type: "number" },
        reason: { type: "string" },
      },
    },
  },}, async (req: FastifyRequest, reply: FastifyReply) => {
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
