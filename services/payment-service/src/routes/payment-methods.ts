import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireUser, type GuestRequest } from "../middleware/auth.js";
import { initiateTaraPayment } from "../lib/tara.js";

// ── Constants & helpers for Tara payment ────────────────────────────────────

const BOOKING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";

async function bindCommission(bookingId: string, authHeader: string) {
  const res = await fetch(`${BOOKING_SERVICE_URL}/guests/me/bookings/${bookingId}/bind-commission`, {
    method: "PATCH",
    headers: { Authorization: authHeader },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { success: boolean; data?: Record<string, unknown> };
  if (!json.success || !json.data) return null;
  return json.data;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const confirmStripeSchema = z.object({
  paymentMethodId: z.string().min(1),
});

const addTaraSchema = z.object({
  mobileNumber: z.string().regex(/^\+\d{7,15}$/, "Must be E.164 format (e.g. +254712345678)"),
});

const patchMethodSchema = z.object({
  isDefault: z.boolean().optional(),
});

// ── Helper ────────────────────────────────────────────────────────────────────

function formatMethod(m: {
  id: string;
  type: string;
  paymentProvider: string;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
  mobileNumberMasked: string | null;
  isDefault: boolean;
}) {
  return {
    id: m.id,
    type: m.type,
    paymentProvider: m.paymentProvider,
    cardBrand: m.cardBrand,
    cardLast4: m.cardLast4,
    cardExpMonth: m.cardExpMonth,
    cardExpYear: m.cardExpYear,
    mobileNumberMasked: m.mobileNumberMasked,
    isDefault: m.isDefault,
  };
}

// ── Route plugin ──────────────────────────────────────────────────────────────

export async function paymentMethodRoutes(app: FastifyInstance) {

  // ── GET /guests/me/payment-methods ───────────────────────────────────────
  app.get("/guests/me/payment-methods", { preHandler: [requireUser], schema: {
    tags: ["Payment Methods"],
    summary: "List saved payment methods",
  }, }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;

    try {
      const methods = await prisma.paymentMethod.findMany({
        where: { userId, isDeleted: false },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          type: true,
          paymentProvider: true,
          cardBrand: true,
          cardLast4: true,
          cardExpMonth: true,
          cardExpYear: true,
          mobileNumberMasked: true,
          isDefault: true,
        },
      });

      return sendSuccess(reply, 200, { paymentMethods: methods.map(formatMethod) });
    } catch (err) {
      return sendError(reply, 400, "DATABASE_ERROR", (err as Error).message);
    }
  });


  // ── POST /guests/me/payment-methods/stripe/setup ─────────────────────────
  app.post(
    "/guests/me/payment-methods/stripe/setup", { preHandler: [requireUser], schema: {
      tags: ["Payment Methods"],
      summary: "Create Stripe SetupIntent",
    }, }, async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req as GuestRequest;

      try {
        // 1. Get or create Stripe customer
        let customerAccount = await prisma.customerAccount.findUnique({
          where: {
            userId_paymentProvider: {
              userId,
              paymentProvider: "stripe",
            },
          },
        });

        let stripeCustomerId: string; //  declared only once now

        if (!customerAccount) {
          const customer = await stripe.customers.create(
            { metadata: { userId } },
            { idempotencyKey: `stripe-cust-${userId}` }
          );

          customerAccount = await prisma.customerAccount.create({
            data: {
              userId,
              paymentProvider: "stripe",
              providerCustomerId: customer.id,
            },
          });

          stripeCustomerId = customer.id;
        } else {
          stripeCustomerId = customerAccount.providerCustomerId;
        }

        // 2. Create SetupIntent (PRODUCTION SAFE)
        const setupIntent = await stripe.setupIntents.create(
          {
            customer: stripeCustomerId,
            payment_method_types: ["card"],
            automatic_payment_methods: { enabled: false },
            usage: "off_session",
          },
          {
            idempotencyKey: `setup_${userId}_${Date.now()}`, //  unique per request
          }
        );

        // 3. Return response
        return reply.code(200).send({
          success: true,
          data: {
            setupIntentId: setupIntent.id,
            clientSecret: setupIntent.client_secret,
          },
        });
      } catch (err) {
        return sendError(
          reply,
          400,
          "SETUP_INTENT_FAILED",
          (err as Error).message
        );
      }
    }
  );

  // ── POST /guests/me/payment-methods/stripe/confirm ───────────────────────
  app.post("/guests/me/payment-methods/stripe/confirm", { preHandler: [requireUser], schema: {
    tags: ["Payment Methods"],
    summary: "Save Stripe payment method",
    body: {
      type: "object",
      required: ["paymentMethodId"],
      properties: {
        paymentMethodId: {
          type: "string",
        },
      },
    },
  }, }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;

    const parsed = confirmStripeSchema.safeParse(req.body);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
      return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
    }

    const { paymentMethodId } = parsed.data;

    try {
      const customerAccount = await prisma.customerAccount.findUnique({
        where: {
          userId_paymentProvider: {
            userId,
            paymentProvider: "stripe",
          },
        },
      });

      if (!customerAccount) {
        return sendError(
          reply,
          404,
          "CUSTOMER_NOT_FOUND",
          "Stripe customer account not found."
        );
      }

      try {
        await stripe.paymentMethods.attach(
          paymentMethodId,
          {
            customer: customerAccount.providerCustomerId,
          }
        );
      } catch (err: any) {
        if (err.code !== "payment_method_unexpected_state") {
          throw err;
        }
      }

      // Retrieve the Stripe PM to get card details
      let pm: Awaited<ReturnType<typeof stripe.paymentMethods.retrieve>>;
      try {
        pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      } catch (err) {
        return sendError(reply, 422, "INVALID_PAYMENT_METHOD", `Could not retrieve payment method: ${(err as Error).message}`);
      }

      const card = pm.card;
      if (!card) {
        return sendError(reply, 422, "UNSUPPORTED_PM_TYPE", "Only card payment methods are supported via this endpoint.");
      }

      // Check if this is the user's first saved method (to set as default)
      const existingCount = await prisma.paymentMethod.count({
        where: { userId, isDeleted: false },
      });

      const isDefault = existingCount === 0;

      if (isDefault) {
        await stripe.customers.update(
          customerAccount.providerCustomerId,
          {
            invoice_settings: {
              default_payment_method: paymentMethodId,
            },
          }
        );
      }

      // Upsert by providerPmId — if the same card was added before, update it
      const existing = await prisma.paymentMethod.findFirst({
        where: { userId, providerPmId: paymentMethodId, isDeleted: false },
      });

      let method;
      if (existing) {
        method = await prisma.paymentMethod.update({
          where: { id: existing.id },
          data: {
            cardBrand: card.brand,
            cardLast4: card.last4,
            cardExpMonth: card.exp_month,
            cardExpYear: card.exp_year,
          },
        });
      } else {
        method = await prisma.paymentMethod.create({
          data: {
            userId,
            paymentProvider: "stripe",
            type: "card",
            providerPmId: paymentMethodId,
            cardBrand: card.brand,
            cardLast4: card.last4,
            cardExpMonth: card.exp_month,
            cardExpYear: card.exp_year,
            isDefault,
          },
        });
      }

      return sendSuccess(reply, 201, formatMethod(method));
    } catch (err) {
      return sendError(reply, 400, "CONFIRM_PAYMENT_METHOD_FAILED", (err as Error).message);
    }
  },
  );

  // ── POST /guests/me/payment-methods/tara ─────────────────────────────────
  app.post("/guests/me/payment-methods/tara", { preHandler: [requireUser], schema: {
    tags: ["Payment Methods"],
    summary: "Add Tara mobile money account",
    body: {
      type: "object",
      required: ["mobileNumber"],
      properties: {
        mobileNumber: {
          type: "string"
        },
      },
    },
  }, },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req as GuestRequest;

      const parsed = addTaraSchema.safeParse(req.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
        return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
      }

      const { mobileNumber } = parsed.data;
      const mobileNumberMasked = mobileNumber.slice(-4);

      try {
        // Check if first saved method
        const existingCount = await prisma.paymentMethod.count({
          where: { userId, isDeleted: false },
        });
        const isDefault = existingCount === 0;

        const method = await prisma.paymentMethod.create({
          data: {
            userId,
            paymentProvider: "tara",
            type: "mobile_money",
            mobileNumberMasked,
            isDefault,
          },
        });

        return sendSuccess(reply, 201, formatMethod(method));
      } catch (err) {
        return sendError(reply, 400, "ADD_TARA_METHOD_FAILED", (err as Error).message);
      }
    },
  );

// ── POST /payments/tara ─────────────────────────────────
  app.post(
    "/payments/tara",
    { preHandler: [requireUser] },
    async (req, reply) => {
      const { bookingId, mobileNumber } = req.body as {
        bookingId: string;
        mobileNumber: string;
      };

      const authHeader = req.headers.authorization ?? "";
      
      try {
        const booking = (await bindCommission(bookingId, authHeader)) as any;

        if (!booking) {
          return sendError(
            reply,
            404,
            "BOOKING_NOT_FOUND",
            "Booking not found"
          );
        }

        const currency = (booking.currency as string).toLowerCase();
        const taraResult = await initiateTaraPayment({
          amount: Number(booking.totalAmount),
          currency,
          mobileNumber,
          reference: booking.reference ?? `tara-${bookingId}-${Date.now()}`,
          description: `Booking ${bookingId}`,
        });

        const failedCount = await prisma.payment.count({
          where: {
            bookingId,
            status: { in: ["failed", "timed_out"] },
          },
        });
        const attemptNumber = failedCount + 1;
        const idempotencyKey = `pay-${bookingId}-${attemptNumber}`;

        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            status: "pending",
            paymentProvider: "tara",
            amount: Number(booking.totalAmount),
            currency,
            attemptNumber,
            idempotencyKey,
            providerPaymentId: taraResult.taraReference,
          },
        });

        return sendSuccess(reply, 200, taraResult);
      } catch (err) {
        return sendError(reply, 400, "TARA_PAYMENT_FAILED", (err as Error).message);
      }
    }
  );

  // ── PATCH /guests/me/payment-methods/:id ─────────────────────────────────
  app.patch(
    "/guests/me/payment-methods/:id",
    { preHandler: [requireUser], schema: {
      tags: ["Payment Methods"],
      summary: "Update payment method",

      params: {
        type: "object",
        required: ["id"],
        properties: {
          id: {
            type: "string",
            description: "Payment Method ID",
          },
        },
      },

      body: {
        type: "object",
        properties: {
          isDefault: {
            type: "boolean",
            description: "Set as default payment method",
          },
        },
      },
    }, },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req as GuestRequest;
      const { id } = req.params as { id: string };

      const parsed = patchMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
        return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
      }

      try {
        const method = await prisma.paymentMethod.findFirst({
          where: { id, userId, isDeleted: false },
        });
        if (!method) {
          return sendError(reply, 404, "NOT_FOUND", "Payment method not found.");
        }

        const { isDefault } = parsed.data;

        if (isDefault === true) {
          // Clear existing defaults for this user, then set this one
          await prisma.$transaction([
            prisma.paymentMethod.updateMany({
              where: { userId, isDeleted: false, isDefault: true },
              data: { isDefault: false },
            }),
            prisma.paymentMethod.update({
              where: { id },
              data: { isDefault: true },
            }),
          ]);
        }

        const updated = await prisma.paymentMethod.findUniqueOrThrow({ where: { id } });
        return sendSuccess(reply, 200, formatMethod(updated));
      } catch (err) {
        return sendError(reply, 400, "UPDATE_METHOD_FAILED", (err as Error).message);
      }
    },
  );

  // ── DELETE /guests/me/payment-methods/:id ────────────────────────────────
  app.delete("/guests/me/payment-methods/:id", { preHandler: [requireUser], schema: {
    tags: ["Payment Methods"],
    summary: "Delete payment method",
    params: {
      type: "object",
      required: ["id"],
      properties: {
        id: {
          type: "string",
        },
      },
    },
  }, },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req as GuestRequest;
      const { id } = req.params as { id: string };

      try {
        const method = await prisma.paymentMethod.findFirst({
          where: { id, userId, isDeleted: false },
        });
        if (!method) {
          return sendError(reply, 404, "NOT_FOUND", "Payment method not found.");
        }

        // Soft-delete
        await prisma.paymentMethod.update({
          where: { id },
          data: { isDefault: false, isDeleted: true },
        });

        // For Stripe: detach the payment method (ignore errors)
        if (method.paymentProvider === "stripe" && method.providerPmId) {
          stripe.paymentMethods.detach(method.providerPmId).catch((err: unknown) => {
            console.warn("[payment-methods] Failed to detach Stripe PM:", (err as Error).message);
          });
        }

        // If deleted method was the default, promote the next available one
        if (method.isDefault) {
          const next = await prisma.paymentMethod.findFirst({
            where: { userId, isDeleted: false },
            orderBy: { createdAt: "asc" },
          });
          if (next) {
            await prisma.paymentMethod.update({
              where: { id: next.id },
              data: { isDefault: true },
            });
          }
        }

        return reply.status(204).send();
      } catch (err) {
        return sendError(reply, 400, "DELETE_METHOD_FAILED", (err as Error).message);
      }
    },
  );
}