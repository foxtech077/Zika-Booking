import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireUser, requireAdmin, type GuestRequest, type AdminRequest } from "../middleware/auth.js";
import { sendError } from "../lib/errors.js";

export async function merchantRoutes(app: FastifyInstance) {
  // ── GET /merchant/me ────────────────────────────────────────────────────────
  // Returns the authenticated provider's merchant profile (creates a bare one if missing)
  app.get("/merchant/me", {
    schema: {
      tags: ["Merchants"],
      description: "Get the authenticated provider's merchant profile",
      security: [{ bearerAuth: [] }],
    },
    preHandler: [requireUser],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId, userType } = req as GuestRequest;
    if (userType !== "provider") return sendError(reply, 403, "FORBIDDEN", "Provider access required.");

    const merchant = await prisma.merchant.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { payouts: { orderBy: { createdAt: "desc" }, take: 5 } },
    });

    reply.send({ success: true, data: merchant });
  });

  // ── PATCH /merchant/me ──────────────────────────────────────────────────────
  // Providers update their payout details (bank, mobile money, or Stripe Connect)
  app.patch("/merchant/me", {
    schema: {
      tags: ["Merchants"],
      description: "Update the authenticated provider's merchant/payout profile",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        properties: {
          businessName: { type: "string" },
          country: { type: "string" },
          payoutMethod: { type: "string", enum: ["stripe_connect", "mobile_money", "bank_transfer", "manual"] },
          stripeConnectAccountId: { type: "string" },
          mobileMoneyNumber: { type: "string" },
          bankName: { type: "string" },
          bankAccountNumber: { type: "string" },
          bankAccountName: { type: "string" },
        },
      },
    },
    preHandler: [requireUser],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId, userType } = req as GuestRequest;
    if (userType !== "provider") return sendError(reply, 403, "FORBIDDEN", "Provider access required.");

    const body = req.body as {
      businessName?: string;
      country?: string;
      payoutMethod?: "stripe_connect" | "mobile_money" | "bank_transfer" | "manual";
      stripeConnectAccountId?: string;
      mobileMoneyNumber?: string;
      bankName?: string;
      bankAccountNumber?: string;
      bankAccountName?: string;
    };

    const merchant = await prisma.merchant.upsert({
      where: { userId },
      create: { userId, ...body },
      update: { ...body, updatedAt: new Date() },
    });

    reply.send({ success: true, data: merchant });
  });

  // ── GET /admin/merchants ────────────────────────────────────────────────────
  app.get("/admin/merchants", {
    schema: {
      tags: ["Admin Merchants"],
      description: "List all merchant profiles",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          page: { type: "string" },
          limit: { type: "string" },
          verified: { type: "string" },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { page?: string; limit?: string; verified?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.verified !== undefined) where.isVerified = query.verified === "true";

    const [merchants, total] = await Promise.all([
      prisma.merchant.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      prisma.merchant.count({ where }),
    ]);

    reply.send({
      success: true,
      data: merchants,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // ── GET /admin/merchants/:id ────────────────────────────────────────────────
  app.get("/admin/merchants/:id", {
    schema: {
      tags: ["Admin Merchants"],
      description: "Get a merchant profile by ID",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: { payouts: { orderBy: { createdAt: "desc" } } },
    });
    if (!merchant) return sendError(reply, 404, "NOT_FOUND", "Merchant not found.");
    reply.send({ success: true, data: merchant });
  });

  // ── PATCH /admin/merchants/:id/verify ──────────────────────────────────────
  // Admin verifies a merchant so automatic payouts can proceed
  app.patch("/admin/merchants/:id/verify", {
    schema: {
      tags: ["Admin Merchants"],
      description: "Verify or unverify a merchant",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
      body: {
        type: "object",
        required: ["isVerified"],
        properties: { isVerified: { type: "boolean" } },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { isVerified } = req.body as { isVerified: boolean };

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant) return sendError(reply, 404, "NOT_FOUND", "Merchant not found.");

    const updated = await prisma.merchant.update({
      where: { id },
      data: { isVerified, updatedAt: new Date() },
    });

    reply.send({ success: true, data: updated });
  });
}
