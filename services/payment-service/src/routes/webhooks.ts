import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { sendError } from "../lib/errors.js";
import { verifyTaraWebhookSignature } from "../lib/tara.js";
import { bookingConfirmedHandler } from "../handler/bookingConfirmed.handler.js";
import Stripe from "stripe";


const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
const TARA_WEBHOOK_SECRET = process.env["TARA_WEBHOOK_SECRET"] ?? "";

// ── Internal helpers ──────────────────────────────────────────────────────────

async function confirmBooking(bookingId: string, paymentId: string, paymentProvider: string) {
  const response = await fetch(`${BOOKING_SERVICE_URL}/bookings/${bookingId}/confirm`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentId, paymentProvider }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Failed to confirm booking ${bookingId}: status ${response.status}. Response: ${errorText}`);
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

  app.post("/stripe/webhook", async (req, reply) => {
    const sig = req.headers["stripe-signature"];
  
    if (!sig || typeof sig !== "string") {
      return reply.code(400).send({
        error: "Missing Stripe signature",
      });
    }
  
    const rawBody = (req as any).rawBody as Buffer | undefined;
  
    if (!rawBody) {
      return reply.code(400).send({
        error: "Missing raw body",
      });
    }
  
    console.log("Webhook hit");
    console.log("Is Buffer:", Buffer.isBuffer(rawBody));
  
    let event: Stripe.Event;
  
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Signature error:", err);
      return reply.code(400).send({
        error: "Invalid signature",
      });
    }
  
    console.log("Event:", event.type);
  

    // PAYMENT SUCCESS
   
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
  
      let payment = await prisma.payment.findFirst({
        where: { providerPaymentId: intent.id },
      });
  
      if (!payment && intent.metadata?.bookingId) {
        payment = await prisma.payment.findFirst({
          where: { bookingId: intent.metadata.bookingId, status: { in: ["initiated", "pending"] } }
        });
        if (payment) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { providerPaymentId: intent.id }
          });
        }
      }

      if (!payment) {
        console.log("Payment not found");
        return reply.send({ received: true });
      }
  
      try {
        if (payment.status !== "captured") {
          const chargeId = intent.latest_charge as string | null;
          let cardDetails = null;
          let pmType = null;
      
          if (chargeId) {
            const charge = await stripe.charges.retrieve(chargeId);
            cardDetails = charge.payment_method_details?.card ?? null;
            pmType = charge.payment_method_details?.type ?? null;
          }
      
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
        }
    
        //  emails + PDF + confirm booking
        await bookingConfirmedHandler({
          id: payment.id,
          paymentProvider: payment.paymentProvider,
          metadata: { bookingId: payment.bookingId },
        });
      } catch (err: any) {
        console.error(`[stripe-webhook] Error processing successful payment: ${err.message}`, err);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: err.message,
        });
      }
  
      return reply.send({ received: true });
    }
  
    // ========================
    // PAYMENT FAILED
    // ========================
    if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as any;
  
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: intent.id },
      });
  
      if (!payment) {
        return reply.send({ received: true });
      }
  
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          failureCode: intent.last_payment_error?.code ?? null,
          failureMessage: intent.last_payment_error?.message ?? null,
        },
      });
  
      if (payment.attemptNumber >= 3) {
        await failBooking(payment.bookingId);
      }
  
      return reply.send({ received: true });
    }
  
    // ========================
    // REFUND
    // ========================
    if (event.type === "charge.refunded") {
      const charge = event.data.object as any;
  
      const providerRefundId = charge.refunds?.data?.[0]?.id;
  
      if (providerRefundId) {
        const refund = await prisma.refund.findFirst({
          where: { providerRefundId },
        });
  
        if (refund && refund.status !== "succeeded") {
          await prisma.refund.update({
            where: { id: refund.id },
            data: {
              status: "succeeded",
              refundedAt: new Date(),
            },
          });
        }
      }
  
      return reply.send({ received: true });
    }
  
    // ========================
    // SETUP INTENT
    // ========================
    if (event.type === "setup_intent.succeeded") {
      const setupIntent = event.data.object as any;
  
      const paymentMethodId = setupIntent.payment_method;
      const customerId = setupIntent.customer;
  
      try {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
  
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
  
        const customerAccount = await prisma.customerAccount.findFirst({
          where: { providerCustomerId: customerId },
        });
  
        if (customerAccount) {
          const exists = await prisma.paymentMethod.findFirst({
            where: { providerPmId: paymentMethodId },
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
  
        console.log("Card saved:", customerId);
      } catch (err) {
        console.error("SetupIntent error:", err);
      }
  
      return reply.send({ received: true });
    }
  
    // default fallback
    return reply.send({ received: true });
  });
  // ── POST /payments/tara/webhook ───────────────────────────────────────────
  app.post("/tara/webhook", {
    schema: {
      tags: ["Webhooks"],
      summary: "Tara webhook — receive payment status events",
      description:
        "Called by Tara when a mobile money payment succeeds or fails. " +
        "Validates HMAC-SHA256 signature in the `X-Tara-Signature` header.\n\n" +
        "**To simulate in Swagger (dev only):** generate the signature with:\n" +
        "`echo -n '{\"event\":\"payment_successful\",\"taraReference\":\"TARA-xxx\"}' | openssl dgst -sha256 -hmac YOUR_TARA_WEBHOOK_SECRET`",
      headers: {
        type: "object",
        required: ["x-tara-signature"],
        properties: {
          "x-tara-signature": {
            type: "string",
            description: "HMAC-SHA256 hex digest of the raw JSON body signed with TARA_WEBHOOK_SECRET",
          },
        },
      },
      body: {
        type: "object",
        required: ["event"],
        properties: {
          event: {
            type: "string",
            enum: ["payment_successful", "payment_failed"],
            description: "Event type from Tara",
          },
          taraReference: {
            type: "string",
            description: "Tara's own transaction reference (returned from /payments/initiate)",
          },
          reference: {
            type: "string",
            description: "Your idempotency reference (booking reference + attempt number)",
          },
          failureCode: {
            type: "string",
            description: "Error code on payment_failed events",
          },
          failureMessage: {
            type: "string",
            description: "Human-readable failure reason",
          },
        },
      },
      response: {
        200: {
          type: "object",
          properties: { received: { type: "boolean" } },
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error:   { type: "object" },
          },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const signature = req.headers["x-tara-signature"];
    if (!signature || typeof signature !== "string") {
      return sendError(reply, 400, "MISSING_SIGNATURE", "Missing X-Tara-Signature header.");
    }

    const rawBodyStr = JSON.stringify(req.body);

    if (!verifyTaraWebhookSignature(rawBodyStr, signature, TARA_WEBHOOK_SECRET)) {
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

      try {
        if (payment.status !== "captured") {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "captured",
              capturedAt: new Date(),
              paymentMethodType: "mobile_money",
            },
          });
        }
  
        await bookingConfirmedHandler({
          id: payment.id,
          paymentProvider: payment.paymentProvider,
          metadata: { bookingId: payment.bookingId },
        });
      } catch (err: any) {
        app.log.error(`[tara-webhook] Error processing successful payment: ${err.message}`, err);
        return reply.status(500).send({
          error: "Internal Server Error",
          message: err.message,
        });
      }

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
