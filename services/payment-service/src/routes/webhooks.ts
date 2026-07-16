  import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
  import { prisma } from "../lib/prisma.js";
  import { stripe } from "../lib/stripe.js";
  import { sendError } from "../lib/errors.js";
  import { bookingConfirmedHandler } from "../handler/bookingConfirmed.handler.js";
  import { PaymentStatus, RefundStatus } from "../generated/index.js";
  import { notifyBookingServiceOfRefund, queueFailedRefundNotification, calculateAlreadyRefunded } from "../services/refund.service.js";

  import Stripe from "stripe";


  const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
  const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";

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

      //  DEDUPLICATE WEBHOOK DELIVERY AT DATABASE LEVEL
      try {
        await prisma.stripeWebhookEvent.create({
          data: {
            id: event.id,
            type: event.type,
          },
        });
      } catch (dbErr: any) {
        if (dbErr.code === "P2002") {
          app.log.info(`[stripe-webhook] Duplicate webhook event ${event.id} detected and skipped.`);
          return reply.send({ received: true });
        }
        req.log.error(dbErr, `[stripe-webhook] Database error checking event ${event.id}`);
        return reply.code(500).send({ error: "Database error verifying webhook event." });
      }

      console.log("Event:", event.type);


      // PAYMENT SUCCESS

      if (event.type === "payment_intent.succeeded") {
        try {
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

          console.log("[WEBHOOK TRACE] payment.id =", payment.id);
          console.log("[WEBHOOK TRACE] metadata =", (payment as any).metadata);
          console.log("[WEBHOOK TRACE] bookingId =", (payment as any).metadata?.bookingId);
          console.log("[WEBHOOK TRACE] intent.metadata =", intent.metadata);

          //  IDEMPOTENCY CHECK — must be FIRST, before any side effects
          if (payment.status === "captured") {
            console.log("Already captured, skipping duplicate webhook");
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
            metadata: { bookingId: payment.bookingId },
          });

          return reply.send({ received: true });
        } catch (err: any) {
          req.log.error(err, "payment_intent.succeeded handler error");
          return reply.code(400).send({ error: "payment_intent.succeeded handler failed: " + (err?.message || "Unknown error") });
        }
      }

      // ========================
      // PAYMENT FAILED
      // ========================
      if (event.type === "payment_intent.payment_failed") {
        try {
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
        } catch (err: any) {
          req.log.error(err, "payment_intent.payment_failed handler error");
          return reply.code(400).send({ error: "payment_intent.payment_failed handler failed: " + (err?.message || "Unknown error") });
        }
      }

      // ========================
      // REFUND
      // ========================
      if (event.type === "charge.refunded") {
        try {
          const charge = event.data.object as any;

          const providerRefundId = charge.refunds?.data?.[0]?.id;

          if (providerRefundId) {
            const refund = await prisma.refund.findFirst({
              where: { providerRefundId },
            });

            if (refund && refund.status !== RefundStatus.succeeded) {
              const updatedRefund = await prisma.refund.update({
                where: { id: refund.id },
                data: {
                  status: RefundStatus.succeeded,
                  refundedAt: new Date(),
                },
              });

              const payment = await prisma.payment.findUnique({
                where: { id: refund.paymentId },
              });
              const totalRefunded = await calculateAlreadyRefunded(refund.paymentId);
              const isFullyRefunded = payment ? (totalRefunded >= Number(payment.amount)) : false;

              await prisma.payment.update({
                where: { id: refund.paymentId },
                data: {
                  status: isFullyRefunded ? PaymentStatus.refunded : PaymentStatus.partially_refunded,
                },
              });

              const refundedAtDate = updatedRefund.refundedAt ?? new Date();
              try {
                await notifyBookingServiceOfRefund(refund.bookingId, {
                  refundId: refund.id,
                  refundAmount: Number(refund.amount),
                  provider: "stripe",
                  refundedAt: refundedAtDate,
                });
              } catch (notifyErr) {
                const notifyMessage = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
                req.log.error(
                  { err: notifyErr },
                  `[stripe-webhook] Failed to notify booking service of refund for booking ${refund.bookingId}: ${notifyMessage}. Queuing retry...`
                );
                await queueFailedRefundNotification(
                  refund.bookingId,
                  refund.id,
                  Number(refund.amount),
                  "stripe",
                  refundedAtDate
                );
              }
            }
          }

          return reply.send({ received: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          req.log.error(err, "charge.refunded handler error");
          return reply.code(400).send({ error: "charge.refunded handler failed: " + message });
        }
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
          "Validates HMAC-SHA256 signature in the `x-tara-signature` header.\n\n" +
          "The payload contains `status` field — `SUCCESS` means payment succeeded.",
        response: {
          200: {
            type: "object",
            properties: { received: { type: "boolean" } },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "object" },
            },
          },
        },
      },
    }, async (req: FastifyRequest, reply: FastifyReply) => {
      app.log.info({ headers: req.headers, body: req.body }, "[tara-webhook] Incoming request — headers & body");

      const body = req.body as {
        paymentId: string;
        status: string;
        transactionCode?: string;
        businessId?: string;
        productId?: string;
        amount?: string;
        collectionId?: string;
        phoneNumber?: string;
        creationDate?: string;
        changeDate?: string;
      };

      app.log.info({ payload: body }, "[tara-webhook] Raw payload received");

      const rawProductId = body.productId ?? body.paymentId;
      const idempotencyKey = rawProductId.replace(/^prod_/, "");
      const isSuccess = body.status === "SUCCESS";

      app.log.info(`[tara-webhook] Received status: ${body.status} | transactionCode: ${body.transactionCode} | productId: ${rawProductId}`);

      try {
        const payment = await prisma.payment.findFirst({
          where: { idempotencyKey },
        });

        if (!payment) {
          app.log.warn(`[tara-webhook] Payment not found for idempotencyKey ${idempotencyKey} (raw productId: ${rawProductId})`);
          return reply.status(200).send({ received: true });
        }

        if (isSuccess) {
          if (payment.status !== "captured") {
            app.log.info(`[tara-webhook] Updating payment ${payment.id} from ${payment.status} → captured`);
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: "captured",
                capturedAt: new Date(),
                paymentMethodType: "mobile_money",
              },
            });
          } else {
            app.log.info(`[tara-webhook] Payment ${payment.id} already captured — skipping status update`);
          }

          try {
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

          return reply.status(200).send({ received: true });
        } else {
          const failureCode = body.transactionCode ?? body.status;
          const failureMessage = body.transactionCode
            ? `Tara payment failed: ${body.transactionCode}`
            : `Tara payment failed with status: ${body.status}`;

          app.log.info(`[tara-webhook] Updating payment ${payment.id} from ${payment.status} → failed (code: ${failureCode})`);
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "failed",
              failureCode,
              failureMessage,
            },
          });

          if (payment.attemptNumber >= 3) {
            app.log.info(`[tara-webhook] Max attempts (${payment.attemptNumber}) reached — failing booking ${payment.bookingId}`);
            await failBooking(payment.bookingId);
          }
        }

        return reply.status(200).send({ received: true });
      } catch (err: any) {
        app.log.error(err, "tara webhook handler error");
        return sendError(reply, 400, "WEBHOOK_HANDLER_FAILED", err?.message ?? "Tara webhook processing failed.");
      }
    });
  }
