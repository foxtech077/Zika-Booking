import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { stripe, toStripeAmount } from "../lib/stripe.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireUser, requireAdminPermission, requireInternalService, requireAccount, type GuestRequest } from "../middleware/auth.js";
import { AdminPermission } from "@zika/types";
import { cancelPayout } from "../services/payout.service.js";
import { issueRefund, RefundLimitExceededError, InvalidPaymentStatusError, handleConfirmFailure } from "../services/refund.service.js";
import { initiateTaraPayment } from "../lib/tara.js";
import { computeTaraCharge, getTaraPhoneCountry, TaraNotAllowedError } from "../lib/taraEligibility.js";
import { sendPaymentLinkEmail } from "../services/email.services.js";
import { resolveEurCharge, EurQuoteUnavailableError, type EurChargeResult } from "../services/eurCharge.service.js";
import { bookingConfirmedHandler } from "../handler/bookingConfirmed.handler.js";
import { extractCountryCode, generateDisplayId, resolvePaymentCountry } from "../lib/paymentReference.js";

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"];

const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

function internalHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", "x-service-key": INTERNAL_SERVICE_KEY };
}

async function fetchBookingInternal(bookingId: string) {
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/${bookingId}`, {
    headers: internalHeaders(),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
  if (!json.success || !json.data) return null;
  return json.data;
}

async function updateBookingStatus(bookingId: string, status: string): Promise<boolean> {
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/${bookingId}/status`, {
    method: "PATCH",
    headers: internalHeaders(),
    body: JSON.stringify({ status }),
  });
  return res.ok;
}

async function revertBookingToDraft(bookingId: string): Promise<boolean> {
  const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/${bookingId}/revert-to-draft`, {
    method: "PATCH",
    headers: internalHeaders(),
  });
  return res.ok;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const initiatePaymentSchema = z.object({
  bookingId: z.string().uuid(),
  paymentProvider: z.enum(["stripe", "tara"]),
  paymentMethodId: z.string().optional(),
  mobileNumber: z.string().optional(),
  network: z.string().optional(),
});

const refundSchema = z.object({
  bookingId: z.string().uuid(),
  refundAmount: z.number().positive(),
  reason: z.string().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchBooking(bookingId: string, userId: string) {
  const booking = await fetchBookingInternal(bookingId);
  if (!booking) return null;
  if (booking["guestId"] !== userId) return null;
  return booking;
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function paymentRoutes(app: FastifyInstance) {

  // ── POST /payments/stripe/payment-link ─────────────────────────────────────
  app.post("/payments/stripe/payment-link", {
    schema: {
      tags: ["Payments"],
      summary: "Generate a Stripe payment link for a draft booking and email it",
      body: {
        type: "object",
        required: ["bookingId"],
        properties: { bookingId: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          type: "object",
          properties: { success: { type: "boolean" }, data: { type: "object", properties: { paymentUrl: { type: "string" } } } },
        },
      },
    },
  }, async (req, reply) => {
    const { bookingId } = req.body as { bookingId: string };
    const booking = await fetchBookingInternal(bookingId);
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking["status"] !== "draft") return sendError(reply, 409, "INVALID_STATUS", "Booking is not in DRAFT status.");

    const amount = Number(booking["totalAmount"]);
    const currency = (booking["currency"] as string).toLowerCase();

    // EUR is the money-of-record for Stripe charges (booking price is display-only).
    let eur: EurChargeResult;
    try {
      eur = await resolveEurCharge(amount, currency);
    } catch (err: any) {
      if (err instanceof EurQuoteUnavailableError) {
        return sendError(reply, 503, err.code, err.message);
      }
      throw err;
    }

    // Step 1: Create Stripe Checkout Session (charged in EUR)
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: `Booking ${booking["reference"]}` },
            unit_amount: toStripeAmount(eur.amountEur, "EUR"),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "https://zikabooking.com/success",
      cancel_url: "https://zikabooking.com/cancel",
      payment_intent_data: { metadata: { bookingId } },
    });

    //  Validate session URL
    if (!session.url) {
      return sendError(reply, 502, "STRIPE_ERROR", "Stripe did not return a payment URL.");
    }

    //  Create payment record
    const cc = extractCountryCode((booking["reference"] as string) ?? "");
    const displayId = await generateDisplayId(cc);
    await prisma.payment.create({
      data: {
        displayId,
        bookingId,
        countryCode: resolvePaymentCountry(booking as any),
        paymentProvider: "stripe",
        status: "initiated",
        amount,
        currency,
        chargedAmount: eur.amountEur,
        chargedCurrency: "EUR",
        chargedRate: eur.rate,
        idempotencyKey: `sess-${bookingId}-${Date.now()}`,
        providerPaymentId: null,
      },
    });

    //  Send email
    await sendPaymentLinkEmail(
      booking["guestEmail"] as string,
      booking["guestFirstName"] as string,
      eur.amountEur,
      "EUR",
      session.url,
      booking["reference"] as string
    );

    //  Only after all steps succeed, update status to pending_payment
    await updateBookingStatus(bookingId, "pending_payment");

    return sendSuccess(reply, 200, { paymentUrl: session.url });
  });

  // ── POST /payments/tara/payment-link ───────────────────────────────────────
  app.post("/payments/tara/payment-link", {
    schema: {
      tags: ["Payments"],
      summary: "Generate a Tara backend trigger URL for a draft booking and email it",
      body: {
        type: "object",
        required: ["bookingId"],
        properties: { bookingId: { type: "string", format: "uuid" } },
      },
      response: {
        200: {
          type: "object",
          properties: { success: { type: "boolean" }, data: { type: "object", properties: { paymentUrl: { type: "string" } } } },
        },
      },
    },
  }, async (req, reply) => {
    const { bookingId } = req.body as { bookingId: string };
    const booking = await fetchBookingInternal(bookingId);
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");
    if (booking["status"] !== "draft") return sendError(reply, 409, "INVALID_STATUS", "Booking is not in DRAFT status.");

    const amount = Number(booking["totalAmount"]);
    const currency = (booking["currency"] as string).toLowerCase();

    const bookingReference = (booking["reference"] as string | undefined) ?? bookingId;
    const bookingCountry = (booking["listing"] as any)?.country ?? extractCountryCode(bookingReference) ?? null;

    let charge: { amountXaf: number; rate: number; phoneCountry: string };
    try {
      charge = await computeTaraCharge({
        totalAmount: amount,
        currency,
        listingCountry: bookingCountry,
        phoneCountry: getTaraPhoneCountry((booking["guestPhone"] as string) ?? ""),
      });
    } catch (err: any) {
      if (err instanceof TaraNotAllowedError) {
        return sendError(reply, 400, err.code, err.message);
      }
      throw err;
    }

    // Step 1: Create payment record
    const cc = extractCountryCode(bookingReference);
    const displayId = await generateDisplayId(cc);
    await prisma.payment.create({
      data: {
        displayId,
        bookingId,
        countryCode: resolvePaymentCountry(booking as any),
        paymentProvider: "tara",
        status: "initiated",
        amount,
        currency,
        chargedAmount: charge.amountXaf,
        chargedCurrency: "XAF",
        chargedRate: charge.rate,
        idempotencyKey: `tara-link-${bookingId}-${Date.now()}`,
        paymentMethodType: "mobile_money",
        mobileNumber: (booking["guestPhone"] as string | undefined) ?? undefined,
      },
    });

    // Step 2: Build trigger URL and send email
    const host = req.headers.host ?? "api.zikabooking.com";
    const protocol = req.headers["x-forwarded-proto"] ?? "https";
    const triggerUrl = `${protocol}://${host}/payments/tara/trigger/${bookingId}`;

    await sendPaymentLinkEmail(
      booking["guestEmail"] as string,
      booking["guestFirstName"] as string,
      charge.amountXaf,
      "XAF",
      triggerUrl,
      bookingReference
    );

    // Step 3: Only after all steps succeed, update status to pending_payment
    await updateBookingStatus(bookingId, "pending_payment");

    return sendSuccess(reply, 200, { paymentUrl: triggerUrl });
  });

  // ── POST /payments/tara/trigger/:bookingId ─────────────────────────────────
  app.post("/payments/tara/trigger/:bookingId", {
    schema: {
      tags: ["Payments"],
      summary: "Trigger STK push for Tara payment link",
      body: {
        type: "object",
        properties: {},
      },
    },
  }, async (req, reply) => {
    const { bookingId } = req.params as { bookingId: string };
    const { network } = (req.body ?? {}) as { network?: string };

    const booking = await fetchBookingInternal(bookingId);
    if (!booking) return sendError(reply, 404, "NOT_FOUND", "Booking not found.");

    if (booking["status"] !== "pending_payment") {
      return sendError(reply, 409, "INVALID_STATUS", "Booking is not awaiting payment.");
    }

    const rawPhone = booking["guestPhone"] as string | undefined;
    if (!rawPhone) {
      return sendError(reply, 400, "MISSING_PHONE", "Guest phone number is required for Tara STK push.");
    }

    const phoneCountry = getTaraPhoneCountry(rawPhone);
    if (!phoneCountry) {
      return sendError(reply, 400, "INVALID_PHONE", "Guest phone number is invalid or unrecognised.");
    }

    const bookingReference = (booking["reference"] as string | undefined) ?? bookingId;
    const bookingCountry = (booking["listing"] as any)?.country ?? extractCountryCode(bookingReference) ?? null;

    let charge: { amountXaf: number; rate: number; phoneCountry: string };
    try {
      charge = await computeTaraCharge({
        totalAmount: Number(booking["totalAmount"]),
        currency: (booking["currency"] as string) ?? "",
        listingCountry: bookingCountry,
        phoneCountry,
      });
    } catch (err: any) {
      if (err instanceof TaraNotAllowedError) {
        return sendError(reply, 400, err.code, err.message);
      }
      throw err;
    }

    // Find the existing initiated payment record (created by /payments/tara/payment-link)
    const existingPayment = await prisma.payment.findFirst({
      where: { bookingId, paymentProvider: "tara", status: "initiated" },
      orderBy: { createdAt: "desc" },
    });

    if (!existingPayment) {
      return sendError(reply, 404, "NO_PAYMENT", "No payment record found for this booking.");
    }

    // Idempotency: if already pending or captured, don't trigger again
    if (existingPayment.status === "captured") {
      return reply.type("text/html").send("<h2>Payment already completed.</h2>");
    }
    if (existingPayment.status === "pending") {
      return reply.type("text/html").send("<h2>A payment request was already sent to your phone. Please check your phone.</h2>");
    }

    const taraResult = await initiateTaraPayment({
      amount: charge.amountXaf,
      currency: "XAF",
      mobileNumber: rawPhone,
      reference: bookingReference,
      description: `Booking ${bookingReference}`,
      attemptNumber: 1,
      network,
    });

    // Update the existing payment record instead of creating a duplicate
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: "pending",
        providerPaymentId: taraResult.taraReference,
        chargedAmount: charge.amountXaf,
        chargedCurrency: "XAF",
        chargedRate: charge.rate,
        mobileNumber: rawPhone,
      },
    });

    return reply.type("text/html").send("<h2>A payment request has been sent to your phone. Please enter your PIN to confirm.</h2>");
  });

  app.post("/payments/create-intent", {
    preHandler: [requireUser], schema: {
      tags: ["Payments"],
      summary: "Create Stripe PaymentIntent (New Card Flow)",
      body: {
        type: "object",
        required: ["bookingId"],
        properties: {
          bookingId: { type: "string", format: "uuid" },
        },
      },
    }
  }, async (req, reply) => {
    const { userId } = req as GuestRequest;
    const { bookingId } = req.body as { bookingId: string };

    // ── 1. Fetch booking ────────────────────────────────────────────────────
    const booking = await fetchBooking(bookingId, userId);
    if (!booking) {
      return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    const amount = booking["totalAmount"] as number;
    const currency = (booking["currency"] as string).toLowerCase();

    if (amount <= 0) {
      return sendError(reply, 400, "INVALID_AMOUNT", "Payment amount must be greater than 0.");
    }

    // EUR is the money-of-record for Stripe charges (booking price is display-only).
    let eur: EurChargeResult;
    try {
      eur = await resolveEurCharge(amount, currency);
    } catch (err: any) {
      if (err instanceof EurQuoteUnavailableError) {
        return sendError(reply, 503, err.code, err.message);
      }
      throw err;
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
      const customer = await stripe.customers.create(
        { metadata: { userId } },
        { idempotencyKey: `stripe-cust-${userId}` }
      );

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
    const bookingRef = (booking["reference"] as string) ?? "";
    const displayId = await generateDisplayId(extractCountryCode(bookingRef));
    const payment = await prisma.payment.create({
      data: {
        displayId,
        bookingId,
        countryCode: resolvePaymentCountry(booking as any),
        paymentProvider: "stripe",
        status: "initiated",
        amount,
        currency,
        chargedAmount: eur.amountEur,
        chargedCurrency: "EUR",
        chargedRate: eur.rate,
        idempotencyKey: `pi-${bookingId}`,
      },
    });

    // ── 5. Create Stripe intent (charged in EUR) ─────────────────────────────
    const intent = await stripe.paymentIntents.create(
      {
        amount: toStripeAmount(eur.amountEur, "EUR"),
        currency: "eur",
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
      displayId: payment.displayId,
      clientSecret: intent.client_secret,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  });
  // ── POST /payments/initiate ───────────────────────────────────────────────
  app.post("/payments/initiate", {
    preHandler: [requireUser], schema: {
      tags: ["Payments"],
      summary: "Initiate payment — saved Stripe card or Tara mobile money",
      description:
        "**Stripe (saved card):** pass `paymentProvider: \"stripe\"` and `paymentMethodId` (from GET /guests/me/payment-methods).\n\n" +
        "**Tara (mobile money):** pass `paymentProvider: \"tara\"` and `mobileNumber` in E.164 format (e.g. `+254712345678`). " +
        "An STK push is sent to the handset — the guest approves within 60 seconds and the booking is confirmed via webhook.",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["bookingId", "paymentProvider"],
        properties: {
          bookingId: {
            type: "string",
            format: "uuid",
            description: "ID of the booking to pay for (must be in pending_payment status)",
          },
          paymentProvider: {
            type: "string",
            enum: ["stripe", "tara"],
            description: "Use \"stripe\" for saved card, \"tara\" for mobile money (Africa)",
          },
          paymentMethodId: {
            type: "string",
            description: "Required when paymentProvider is \"stripe\" — ID from GET /guests/me/payment-methods",
          },
          mobileNumber: {
            type: "string",
            description: "Required when paymentProvider is \"tara\" — E.164 format e.g. +254712345678",
          },
        },
      },
      response: {
        201: {
          description: "Payment initiated",
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                paymentId: { type: "string", description: "Internal payment record ID" },
                taraReference: { type: "string", description: "Tara transaction reference (Tara flow only)" },
                message: { type: "string", description: "STK push status message (Tara flow only)" },
                requiresAction: { type: "boolean", description: "true when Stripe 3DS is required (Stripe flow only)" },
                clientSecret: { type: "string", description: "Stripe client secret for 3DS re-auth (Stripe flow only)" },
              },
            },
          },
        },
        404: {
          description: "Booking not found",
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        409: {
          description: "Duplicate payment",
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
        422: {
          description: "Validation error",
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                fields: { type: "object", additionalProperties: { type: "string" } },
              },
            },
          },
        },
      },
    }
  }, async (req, reply) => {
    const { userId } = req as GuestRequest;

    // ── 1. Validate body ──────────────────────────────────────────────────
    const parsed = initiatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.");
    }

    const { bookingId, paymentProvider, paymentMethodId, mobileNumber, network } = parsed.data;

    // ── 2. Fetch booking ──────────────────────────────────────────────────
    const booking = await fetchBooking(bookingId, userId);
    if (!booking) {
      return sendError(reply, 404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    const amount = booking["totalAmount"] as number;
    const currency = (booking["currency"] as string).toLowerCase();

    // EUR is the money-of-record for Stripe charges (booking price is display-only).
    let eur: EurChargeResult | null = null;
    if (paymentProvider === "stripe") {
      try {
        eur = await resolveEurCharge(amount, currency);
      } catch (err: any) {
        if (err instanceof EurQuoteUnavailableError) {
          return sendError(reply, 503, err.code, err.message);
        }
        throw err;
      }
    }

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
    const bookingRef = (booking["reference"] as string) ?? "";
    const displayId = await generateDisplayId(extractCountryCode(bookingRef));
    const payment = await prisma.payment.create({
      data: {
        displayId,
        bookingId,
        countryCode: resolvePaymentCountry(booking as any),
        paymentProvider,
        status: "initiated",
        amount,
        currency,
        ...(eur ? { chargedAmount: eur.amountEur, chargedCurrency: "EUR", chargedRate: eur.rate } : {}),
        attemptNumber,
        idempotencyKey,
        paymentMethodType: paymentProvider === "tara" ? "mobile_money" : undefined,
        ...(paymentProvider === "tara" && mobileNumber ? { mobileNumber } : {}),
      },
    });

    try {
      // ── 6. Stripe flow ────────────────────────────────────────────────────
      if (paymentProvider === "stripe") {

        // Customer lookup
        const customerAccount = await prisma.customerAccount.findUnique({
          where: {
            userId_paymentProvider: { userId, paymentProvider: "stripe" },
          },
        });

        if (!customerAccount) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "failed", failureCode: "CUSTOMER_NOT_FOUND", failureMessage: "Stripe customer account not found." }
          });
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
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "failed", failureCode: "PAYMENT_METHOD_NOT_FOUND", failureMessage: "Saved payment method not found." }
          });
          return sendError(reply, 404, "PAYMENT_METHOD_NOT_FOUND", "Saved payment method not found.");
        }

        // Create Stripe intent
        let intent;
        try {
          intent = await stripe.paymentIntents.create(
            {
              amount: eur ? toStripeAmount(eur.amountEur, "EUR") : toStripeAmount(Number(amount), currency),
              currency: eur ? "eur" : currency,
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
              displayId: payment.displayId,
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

        // Confirm the booking (set status → confirmed, send emails, generate PDF)
        bookingConfirmedHandler({ id: payment.id, metadata: { bookingId } }).catch(async (err) => {
          // Money is already captured here. If the booking can no longer be
          // confirmed (cancelled, dates taken, grace expired), auto-refund it.
          const paymentRow = await prisma.payment.findUnique({ where: { id: payment.id } });
          if (!paymentRow) {
            console.error("[payments/initiate] Payment row missing for confirm failure:", err);
            return;
          }
          const handled = await handleConfirmFailure(paymentRow, err);
          if (!handled) {
            console.error("[payments/initiate] bookingConfirmedHandler failed:", err);
          }
        });

        return sendSuccess(reply, 201, { paymentId: payment.id, displayId: payment.displayId });
      }

      // ── 7. Tara flow ──────────────────────────────────────────────────────
      if (paymentProvider === "tara") {
        if (!mobileNumber) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: "failed", failureCode: "VALIDATION_ERROR", failureMessage: "mobileNumber is required for Tara payments." }
          });
          return sendError(reply, 422, "VALIDATION_ERROR", "mobileNumber is required for Tara payments.");
        }

        const bookingReference = (booking["reference"] as string | undefined) ?? bookingId;
        const bookingCountry = (booking["listing"] as any)?.country ?? extractCountryCode(bookingReference) ?? null;

        let charge: { amountXaf: number; rate: number; phoneCountry: string };
        try {
          charge = await computeTaraCharge({
            totalAmount: Number(amount),
            currency,
            listingCountry: bookingCountry,
            phoneCountry: getTaraPhoneCountry(mobileNumber),
          });
        } catch (err: any) {
          if (err instanceof TaraNotAllowedError) {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: "failed", failureCode: err.code, failureMessage: err.message }
            });
            return sendError(reply, 400, err.code, err.message);
          }
          throw err;
        }

        const taraResult = await initiateTaraPayment({
          amount: charge.amountXaf,
          currency: "XAF",
          mobileNumber,
          reference: bookingReference,
          description: `Booking ${bookingReference}`,
          attemptNumber,
          network,
        });

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerPaymentId: taraResult.taraReference,
            status: "pending",
            attemptNumber,
            idempotencyKey: `${bookingReference}-${attemptNumber}`,
            chargedAmount: charge.amountXaf,
            chargedCurrency: "XAF",
            chargedRate: charge.rate,
            mobileNumber,
          },
        });

        return sendSuccess(reply, 201, {
          paymentId: payment.id,
          displayId: payment.displayId,
          taraReference: taraResult.taraReference,
          message: "STK push sent. Please approve on your handset within 60 seconds.",
        });
      }
    } catch (err: any) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          failureMessage: err.message ?? "Payment initiation failed",
        },
      });
      throw err;
    }
  });

  // ── GET /payments/:id/status ──────────────────────────────────────────────
  app.get("/payments/:id/status", {
    preHandler: [requireUser], schema: {
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
    const { id } = req.params as { id: string };

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return sendError(reply, 404, "NOT_FOUND", "Payment not found.");
    }

    // Verify ownership by checking booking belongs to user
    const booking = await fetchBooking(payment.bookingId, userId);
    if (!booking) {
      return sendError(reply, 403, "FORBIDDEN", "You do not have access to this payment.");
    }

    return sendSuccess(reply, 200, {
      id: payment.id,
      displayId: payment.displayId,
      status: payment.status,
      bookingId: payment.bookingId,
      amount: Number(payment.amount),
      currency: payment.currency,
      capturedAt: payment.capturedAt?.toISOString() ?? null,
    });
  });

  // ── POST /payments/:id/cancel ─────────────────────────────────────────────
  // Cancels an abandoned Stripe PaymentIntent. Called by the client when the
  // user navigates away from checkout. Only cancels intents that have not yet
  // been paid; an in-flight or successful payment is never cancelled.
  app.post("/payments/:id/cancel", {
    preHandler: [requireUser], schema: {
      tags: ["Payments"],
      summary: "Cancel an abandoned Stripe payment",
      description:
        "Cancels the Stripe PaymentIntent for a payment still awaiting confirmation. " +
        "Safe to call multiple times. If the payment already succeeded or is processing, no action is taken.",
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const { id } = req.params as { id: string };

    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) {
      return sendError(reply, 404, "NOT_FOUND", "Payment not found.");
    }

    if (payment.paymentProvider !== "stripe") {
      return sendError(reply, 400, "UNSUPPORTED_PROVIDER", "Only Stripe payments can be cancelled via this endpoint.");
    }

    // Verify ownership by checking booking belongs to user
    const booking = await fetchBooking(payment.bookingId, userId);
    if (!booking) {
      return sendError(reply, 403, "FORBIDDEN", "You do not have access to this payment.");
    }

    // Already terminal — nothing to cancel
    if (["captured", "failed", "timed_out", "refunded", "partially_refunded"].includes(payment.status)) {
      return sendSuccess(reply, 200, { id: payment.id, status: payment.status });
    }

    if (payment.providerPaymentId) {
      const intent = await stripe.paymentIntents.retrieve(payment.providerPaymentId);

      // Never cancel a payment that is already paid, processing, or awaiting capture.
      if (!["requires_payment_method", "requires_confirmation", "requires_action"].includes(intent.status)) {
        return sendSuccess(reply, 200, { id: payment.id, status: payment.status, intentStatus: intent.status });
      }

      await stripe.paymentIntents.cancel(payment.providerPaymentId);
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "timed_out",
        failureCode: "CANCELLED_BY_USER",
        failureMessage: "Payment was cancelled by the user before completion.",
      },
    });

    // Best-effort: release the booking back to draft so the guest can retry.
    await revertBookingToDraft(payment.bookingId).catch(() => {});

    return sendSuccess(reply, 200, { id: payment.id, status: "timed_out" });
  });

  // ── POST /payments/refunds (internal) ─────────────────────────────────────
  app.post("/payments/refunds", {
    preHandler: [
      async (req, reply) => {
        const serviceKey = req.headers["x-service-key"];
        if (serviceKey && serviceKey === process.env["INTERNAL_SERVICE_KEY"]) {
          return;
        }
        await requireAdminPermission(AdminPermission.RefundsProcess)(req, reply);
      }
    ],
    schema: {
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
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
    }

    const { bookingId, refundAmount, reason } = parsed.data;

    // Reject non-positive refund amounts immediately
    if (refundAmount <= 0) {
      return sendError(reply, 400, "INVALID_AMOUNT", "Refund amount must be greater than zero.");
    }

    // 1. Find the most recent payment for this booking
    const payment = await prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { attemptNumber: "desc" },
    });

    if (!payment) {
      return sendError(reply, 404, "PAYMENT_NOT_FOUND", "No payment found for this booking.");
    }

    // 2. Idempotency via idempotency-key header + atomic issue (shared logic).
    const idempotencyKey = (req.headers["idempotency-key"] as string) ?? null;
    try {
      const refund = await issueRefund(payment, {
        amount: refundAmount,
        reason: reason ?? null,
        idempotencyKey,
      });
      return sendSuccess(reply, refund.status === "submitted" ? 201 : 200, {
        refundId: refund.id,
        status: refund.status,
      });
    } catch (err: any) {
      if (err instanceof RefundLimitExceededError) {
        return sendError(reply, 400, "INVALID_AMOUNT", "Refund amount exceeds captured payment amount.");
      }
      if (err instanceof InvalidPaymentStatusError) {
        return sendError(
          reply,
          400,
          "INVALID_PAYMENT_STATUS",
          "Only captured or partially refunded payments can be refunded."
        );
      }
      req.log.error({ err }, "Failed to issue refund");
      return sendError(reply, 502, "REFUND_FAILED", err?.message ?? "Failed to submit refund.");
    }
  });

  // ── POST /payments/internal/bookings/:bookingId/cancel-payout ─────────────────
  app.post("/payments/internal/bookings/:bookingId/cancel-payout", {
    preHandler: [requireInternalService],
    schema: {
      tags: ["Payments"],
      summary: "Internal: cancel scheduled payout for a booking",
      params: {
        type: "object",
        required: ["bookingId"],
        properties: { bookingId: { type: "string", format: "uuid" } },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { bookingId } = req.params as { bookingId: string };
    try {
      await cancelPayout(bookingId);
      return sendSuccess(reply, 200, { message: "Payout cancelled successfully." });
    } catch (err: any) {
      return sendError(reply, 500, "DATABASE_ERROR", err.message);
    }
  });

  // ── GET /provider/me/bookings/payment-summary ──────────────────────────────
  // Provider-facing payment + payout status keyed by bookingId. Lives in the
  // payment service (which owns the payments schema) so the provider app can
  // render real payment/payout state without a cross-schema join.
  app.get("/provider/me/bookings/payment-summary", {
    schema: {
      tags: ["Provider Payments"],
      summary: "Get payment/payout summary for the provider's bookings",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        required: ["bookingIds"],
        properties: {
          bookingIds: { type: "string", description: "Comma-separated booking UUIDs (max 200)" },
        },
      },
    },
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const { bookingIds } = req.query as { bookingIds?: string };
    const ids = [...new Set((bookingIds ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 200);

    if (ids.length === 0) {
      return sendSuccess(reply, 200, { data: {} });
    }

    // Authorization: only return payment/refund/payout state for bookings the
    // caller actually owns. Ownership lives in the listing schema, so the
    // booking service verifies it; on failure we fail closed for security.
    let ownedIds: string[];
    try {
      const res = await fetch(`${BOOKING_SERVICE_URL}/bookings/internal/verify-ownership`, {
        method: "POST",
        headers: internalHeaders(),
        body: JSON.stringify({ bookingIds: ids, providerId: userId }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        req.log.error({ status: res.status }, "[payment-summary] Ownership verification failed (non-2xx)");
        return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Could not verify booking ownership. Please try again shortly.");
      }
      const json = (await res.json()) as { data?: { owned?: string[] } };
      ownedIds = json?.data?.owned ?? [];
    } catch (err) {
      req.log.error({ err }, "[payment-summary] Ownership verification errored");
      return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Could not verify booking ownership. Please try again shortly.");
    }

    if (ownedIds.length === 0) {
      return sendSuccess(reply, 200, { data: {} });
    }

    // Pick the payment that best reflects the current state: captured first,
    // then partially_refunded/refunded, then the latest pending/initiated
    // attempt, then the latest failed/timed_out attempt (so an old failed
    // attempt never masks a newer in-flight one).
    const STATUS_PRIORITY: Record<string, number> = {
      captured: 0,
      partially_refunded: 1,
      refunded: 2,
      pending: 3,
      initiated: 4,
      timed_out: 5,
      failed: 6,
    };

    const payments = await prisma.payment.findMany({
      where: { bookingId: { in: ownedIds } },
    });
    const payouts = await prisma.payout.findMany({
      where: { providerId: userId, bookingId: { in: ownedIds } },
    });
    const refunds = await prisma.refund.findMany({
      where: { bookingId: { in: ownedIds } },
    });

    const toNum = (v: unknown): number | null => (v == null ? null : Number(v));

    const data: Record<string, unknown> = {};
    for (const id of ownedIds) {
      const bookingPayments = payments
        .filter((p) => p.bookingId === id)
        .sort((a, b) => {
          const pa = STATUS_PRIORITY[a.status] ?? 9;
          const pb = STATUS_PRIORITY[b.status] ?? 9;
          if (pa !== pb) return pa - pb;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      const payment = bookingPayments[0] ?? null;
      const payout = payouts.find((p) => p.bookingId === id) ?? null;
      const bookingRefunds = refunds
        .filter((r) => r.bookingId === id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      data[id] = {
        payment: payment
          ? {
              id: payment.id,
              displayId: payment.displayId,
              status: payment.status,
              amount: toNum(payment.amount),
              currency: payment.currency,
              chargedAmount: toNum(payment.chargedAmount),
              chargedCurrency: payment.chargedCurrency,
              chargedRate: toNum(payment.chargedRate),
              paymentMethodType: payment.paymentMethodType,
              cardBrand: payment.cardBrand,
              cardLast4: payment.cardLast4,
              mobileNumberMasked: payment.mobileNumberMasked,
              providerPaymentId: payment.providerPaymentId,
              failureCode: payment.failureCode,
              failureMessage: payment.failureMessage,
              capturedAt: payment.capturedAt?.toISOString() ?? null,
              createdAt: payment.createdAt.toISOString(),
            }
          : null,
        refunds: bookingRefunds.map((r) => ({
          id: r.id,
          amount: toNum(r.amount),
          currency: r.currency,
          status: r.status,
          reason: r.reason,
          providerRefundId: r.providerRefundId,
          failureReason: r.failureReason,
          refundedAt: r.refundedAt?.toISOString() ?? null,
        })),
        payout: payout
          ? {
              id: payout.id,
              status: payout.status,
              amount: toNum(payout.amount),
              currency: payout.currency,
              scheduledAt: payout.scheduledAt?.toISOString() ?? null,
              processedAt: payout.processedAt?.toISOString() ?? null,
              providerPayoutId: payout.providerPayoutId,
              failureReason: payout.failureReason,
              priceBreakdownJson: payout.priceBreakdownJson,
            }
          : null,
      };
    }

    return sendSuccess(reply, 200, data);
  });
}