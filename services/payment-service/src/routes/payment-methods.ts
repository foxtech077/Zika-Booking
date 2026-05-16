import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { sendError, sendSuccess } from "../lib/errors.js";
import { requireUser, type GuestRequest } from "../middleware/auth.js";

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
  app.get("/guests/me/payment-methods", { preHandler: [requireUser] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;

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
  });

  // ── POST /guests/me/payment-methods/stripe/setup ─────────────────────────
  app.post(
    "/guests/me/payment-methods/stripe/setup",
    { preHandler: [requireUser] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      // requireUser sets userId but we don't need it for setup intent creation
      void (req as GuestRequest).userId;

      const setupIntent = await stripe.setupIntents.create({
        usage: "off_session",
      });

      return sendSuccess(reply, 201, {
        setupIntentId: setupIntent.id,
        clientSecret: setupIntent.client_secret,
      });
    },
  );

  // ── POST /guests/me/payment-methods/stripe/confirm ───────────────────────
  app.post(
    "/guests/me/payment-methods/stripe/confirm",
    { preHandler: [requireUser] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req as GuestRequest;

      const parsed = confirmStripeSchema.safeParse(req.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
        return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
      }

      const { paymentMethodId } = parsed.data;

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
    },
  );

  // ── POST /guests/me/payment-methods/tara ─────────────────────────────────
  app.post(
    "/guests/me/payment-methods/tara",
    { preHandler: [requireUser] },
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
    },
  );

  // ── PATCH /guests/me/payment-methods/:id ─────────────────────────────────
  app.patch(
    "/guests/me/payment-methods/:id",
    { preHandler: [requireUser] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req as GuestRequest;
      const { id } = req.params as { id: string };

      const parsed = patchMethodSchema.safeParse(req.body);
      if (!parsed.success) {
        const fields: Record<string, string> = {};
        for (const e of parsed.error.issues) fields[e.path.join(".")] = e.message;
        return sendError(reply, 422, "VALIDATION_ERROR", "Invalid request body.", fields);
      }

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
    },
  );

  // ── DELETE /guests/me/payment-methods/:id ────────────────────────────────
  app.delete(
    "/guests/me/payment-methods/:id",
    { preHandler: [requireUser] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { userId } = req as GuestRequest;
      const { id } = req.params as { id: string };

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
    },
  );
}
