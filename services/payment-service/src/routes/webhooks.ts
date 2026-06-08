import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHmac } from "crypto";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { sendError } from "../lib/errors.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
const TARA_WEBHOOK_SECRET = process.env["TARA_WEBHOOK_SECRET"] ?? "";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string) {
  try {
    await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, paymentProvider }),
    });
  } catch (err) {
    console.error("[webhook] Failed to confirm booking", bookingId, err);
  }
}

async function failBooking(bookingId: string) {
  try {
    await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/fail`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ failureReason: "Payment failed after maximum attempts." }),
    });
  } catch (err) {
    console.error("[webhook] Failed to mark booking as failed", bookingId, err);
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function webhookRoutes(app: FastifyInstance) {

  // ── POST /payments/stripe/webhook ─────────────────────────────────────────
  app.post("/payments/stripe/webhook",{schema: {
    tags: ["Webhooks"],
    summary: "Stripe webhook endpoint",
    description:
      "Receives Stripe events such as payment_intent.succeeded and payment_intent.payment_failed.",

  },}, async (req: FastifyRequest, reply: FastifyReply) => {
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      return sendError(reply, 400, "MISSING_SIGNATURE", "Missing Stripe-Signature header.");
    }

    // req.body is a Buffer because of the raw content-type parser registered in index.ts
    const rawBody = req.body as Buffer;

    let event: ReturnType<typeof stripe.webhooks.constructEvent>;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      app.log.warn(`[stripe-webhook] Signature verification failed: ${(err as Error).message}`);
      return sendError(reply, 400, "INVALID_SIGNATURE", "Stripe signature verification failed.");
    }

    app.log.info(`[stripe-webhook] Received event: ${event.type}`);

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as { id: string; charges?: { data?: Array<{ payment_method_details?: { card?: { brand?: string; last4?: string }; type?: string } }> } };

      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: intent.id },
      });

      if (!payment) {
        app.log.warn(`[stripe-webhook] Payment not found for intent ${intent.id}`);
        return reply.status(200).send({ received: true });
      }

      // Idempotent: if already captured, do nothing
      if (payment.status === "captured") {
        return reply.status(200).send({ received: true });
      }

      // Extract card details from charge if available
      const charge = intent.charges?.data?.[0];
      const cardDetails = charge?.payment_method_details?.card;
      const pmType = charge?.payment_method_details?.type ?? null;

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "captured",
          capturedAt: new Date(),
          paymentMethodType: pmType,
          cardBrand: cardDetails?.brand ?? null,
          cardLast4: cardDetails?.last4 ?? null,
        },
      });

      await confirmBooking(payment.bookingId, payment.id, "stripe");

    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as {
        id: string;
        last_payment_error?: { code?: string; message?: string };
      };

      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: intent.id },
      });

      if (!payment) {
        app.log.warn(`[stripe-webhook] Payment not found for intent ${intent.id}`);
        return reply.status(200).send({ received: true });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          failureCode: intent.last_payment_error?.code ?? null,
          failureMessage: intent.last_payment_error?.message ?? null,
        },
      });

      // If max attempts exceeded, fail the booking
      if (payment.attemptNumber >= 3) {
        await failBooking(payment.bookingId);
      }

    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as {
        refunds?: { data?: Array<{ id: string }> };
      };

      const providerRefundId = charge.refunds?.data?.[0]?.id;
      if (!providerRefundId) {
        return reply.status(200).send({ received: true });
      }

      const refund = await prisma.refund.findFirst({
        where: { providerRefundId },
      });

      if (refund && refund.status !== "succeeded") {
        await prisma.refund.update({
          where: { id: refund.id },
          data: { status: "succeeded", refundedAt: new Date() },
        });
      }
    }

    //Setup intent code
    else if (event.type === "setup_intent.succeeded") {
      const setupIntent = event.data.object as any;

      const paymentMethodId = setupIntent.payment_method;
      const customerId = setupIntent.customer;

      try {
        // attach payment method
        await stripe.paymentMethods
          .attach(paymentMethodId, {
            customer: customerId,
          })
          .catch(() => {}); // ignore already attached error

        // set default payment method
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });

        // find customer in DB
        const customerAccount = await prisma.customerAccount.findFirst({
          where: {
            providerCustomerId: customerId,
            paymentProvider: "stripe",
          },
        });

        if (customerAccount) {
          const exists = await prisma.paymentMethod.findFirst({
            where: {
              providerPmId: paymentMethodId,
            },
          });

          if (!exists) {
            await prisma.paymentMethod.create({
              data: {
                userId: customerAccount.userId,
                providerPmId: paymentMethodId,
                type: "card",
                paymentProvider: "stripe",
              },
            });
          }
        }

        app.log.info(
          `[stripe-webhook] Card saved for customer ${customerId}`
        );
      } catch (err) {
        app.log.error(`[stripe-webhook] SetupIntent error: ${err}`);
      }
    }

    return reply.status(200).send({ received: true });
  });

  // ── POST /payments/tara/webhook ───────────────────────────────────────────
  app.post("/payments/tara/webhook",{schema: {
    tags: ["Webhooks"],
    summary: "Tara webhook endpoint",
    description:
      "Receives Tara payment status updates.",
  },}, async (req: FastifyRequest, reply: FastifyReply) => {
    const signature = req.headers["x-tara-signature"];
    if (!signature || typeof signature !== "string") {
      return sendError(reply, 400, "MISSING_SIGNATURE", "Missing X-Tara-Signature header.");
    }

    // Verify HMAC-SHA256 of raw body
    const rawBody = JSON.stringify(req.body);
    const expectedSig = createHmac("sha256", TARA_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSig) {
      app.log.warn("[tara-webhook] Signature verification failed");
      return sendError(reply, 400, "INVALID_SIGNATURE", "Tara signature verification failed.");
    }

    const body = req.body as {
      event: string;
      reference?: string;
      taraReference?: string;
      failureCode?: string;
      failureMessage?: string;
    };

    app.log.info(`[tara-webhook] Received event: ${body.event}`);

    const taraReference = body.taraReference ?? body.reference;

    if (body.event === "payment_successful") {
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: taraReference },
      });

      if (!payment) {
        app.log.warn(`[tara-webhook] Payment not found for taraReference ${taraReference}`);
        return reply.status(200).send({ received: true });
      }

      if (payment.status === "captured") {
        return reply.status(200).send({ received: true });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "captured",
          capturedAt: new Date(),
          paymentMethodType: "mobile_money",
        },
      });

      await confirmBooking(payment.bookingId, payment.id, "tara");

    } else if (body.event === "payment_failed") {
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: taraReference },
      });

      if (!payment) {
        app.log.warn(`[tara-webhook] Payment not found for taraReference ${taraReference}`);
        return reply.status(200).send({ received: true });
      }

      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          failureCode: body.failureCode ?? null,
          failureMessage: body.failureMessage ?? null,
        },
      });

      if (payment.attemptNumber >= 3) {
        await failBooking(payment.bookingId);
      }
    }

    return reply.status(200).send({ received: true });
  });
}
