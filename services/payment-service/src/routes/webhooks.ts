import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { createHmac } from "crypto";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { sendError } from "../lib/errors.js";
import { bookingConfirmedHandler } from "../handler/bookingConfirmed.handler.js";
import Stripe from "stripe";
import rawBody from "fastify-raw-body";


const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
const TARA_WEBHOOK_SECRET = process.env["TARA_WEBHOOK_SECRET"] ?? "";

import { failBooking, fetchBooking } from "../lib/booking.js";

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function webhookRoutes(app: FastifyInstance) {

  app.post("/stripe/webhook", async (req, reply) => {
    const sig = req.headers["stripe-signature"];
  
    if (!sig || typeof sig !== "string") {
      return reply.code(400).send({
        error: "Missing Stripe signature",
      });
    }
  
    const rawBody = req.rawBody;
  
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
  
      const payment = await prisma.payment.findFirst({
        where: { providerPaymentId: intent.id },
      });
  
      if (!payment) {
        console.log("Payment not found");
        return reply.send({ received: true });
      }
  
      //  IDEMPOTENCY CHECK — must be FIRST, before any side effects
      const result = await prisma.payment.updateMany({
        where: {
          id: payment.id,
          status: { not: "captured" }
        },
        data: {
          status: "captured",
          capturedAt: new Date(),
        },
      });
      
      if (result.count === 0) {
        try {
          const booking = await fetchBooking(payment.bookingId);
          if (booking && booking.status !== "confirmed") {
            console.log(`[stripe] Retrying bookingConfirmedHandler for captured payment: ${payment.id}`);
            await bookingConfirmedHandler({
              id: payment.id,
              paymentProvider: payment.paymentProvider,
              metadata: { bookingId: payment.bookingId },
            });
          }
        } catch (e) {
          console.error("Retry handler check failed", e);
        }
        return reply.send({ received: true });
      }
  
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
  
      //  emails + PDF + confirm booking — runs only once
      await bookingConfirmedHandler({
        id: payment.id,
        paymentProvider: payment.paymentProvider,
        metadata: { bookingId: payment.bookingId },
      });
  
      return reply.send({ received: true });
    }
  
  
    // PAYMENT FAILED
   
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
  

    // REFUND
   
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
  
    // SETUP INTENT
 
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
 app.post("/tara/webhook",{schema: {
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
        try {
          const booking = await fetchBooking(payment.bookingId);
          if (booking && booking.status !== "confirmed") {
            console.log(`[tara] Retrying bookingConfirmedHandler for captured payment: ${payment.id}`);
            await bookingConfirmedHandler({
              id: payment.id,
              paymentProvider: "tara",
              metadata: { bookingId: payment.bookingId },
            });
          }
        } catch (e) {
          console.error("Retry handler check failed", e);
        }
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

      await bookingConfirmedHandler({
        id: payment.id,
        paymentProvider: "tara",
        metadata: { bookingId: payment.bookingId },
      });

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
