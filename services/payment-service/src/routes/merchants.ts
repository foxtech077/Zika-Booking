import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { requireAccount, requireAdminPermission, assertResourceCountryScope, countryScopeFilter, type GuestRequest, type AdminRequest } from "../middleware/auth.js";
import { sendError } from "../lib/errors.js";
import { AdminPermission } from "@zika/types";
import { writeAdminAudit } from "../lib/audit.js";

const PROVIDER_BASE_URL = process.env["PROVIDER_BASE_URL"] ?? "http://localhost:3005";

export async function merchantRoutes(app: FastifyInstance) {
  // ── GET /merchant/me ────────────────────────────────────────────────────────
  // Returns the authenticated provider's merchant profile (creates a bare one if missing)
  app.get("/merchant/me", {
    schema: {
      tags: ["Merchants"],
      description: "Get the authenticated provider's merchant profile",
      security: [{ bearerAuth: [] }],
    },
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
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
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
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
    preHandler: [requireAdminPermission(AdminPermission.MerchantsRead)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as { page?: string; limit?: string; verified?: string };
    const page = Math.max(1, parseInt(query.page ?? "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(query.limit ?? "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = { ...countryScopeFilter(req) };
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
    preHandler: [requireAdminPermission(AdminPermission.MerchantsRead)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const merchant = await prisma.merchant.findUnique({
      where: { id },
      include: { payouts: { orderBy: { createdAt: "desc" } } },
    });
    if (!merchant) return sendError(reply, 404, "NOT_FOUND", "Merchant not found.");
    if (!assertResourceCountryScope(req, reply, merchant.country)) return;
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
    preHandler: [requireAdminPermission(AdminPermission.MerchantsManage)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { isVerified } = req.body as { isVerified: boolean };

    const merchant = await prisma.merchant.findUnique({ where: { id } });
    if (!merchant) return sendError(reply, 404, "NOT_FOUND", "Merchant not found.");
    if (!assertResourceCountryScope(req, reply, merchant.country)) return;

    const updated = await prisma.merchant.update({
      where: { id },
      data: { isVerified, updatedAt: new Date() },
    });

    // When verifying, clear stale "Merchant is not verified" failureReason on pending payouts
    if (isVerified) {
      await prisma.payout.updateMany({
        where: {
          merchantId: id,
          failureReason: "Merchant is not verified",
        },
        data: {
          failureReason: null,
          updatedAt: new Date(),
        },
      });
    }

    await writeAdminAudit(req, {
      action: "merchant_verify_changed",
      targetType: "merchant",
      targetId: id,
      oldValue: `isVerified:${merchant.isVerified}`,
      newValue: `isVerified:${isVerified}`,
    });

    reply.send({ success: true, data: updated });
  });

  // ── POST /merchant/me/stripe/connect ────────────────────────────────────────
  // Step 1 of Stripe Connect onboarding:
  // Creates a Stripe Express account (idempotent) and returns a hosted onboarding URL.
  // The provider is redirected to Stripe to fill in their bank details / KYC.
  app.post("/merchant/me/stripe/connect", {
    schema: {
      tags: ["Merchants"],
      description: "Start Stripe Connect onboarding — returns a Stripe-hosted onboarding URL",
      security: [{ bearerAuth: [] }],
    },
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    // Upsert merchant row so we always have one to update
    let merchant = await prisma.merchant.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    // Re-use existing Stripe Connect account if already created
    let stripeAccountId = merchant.stripeConnectAccountId;

    if (!stripeAccountId) {
      // Fresh idempotency key per attempt: Stripe replays a cached 4xx for
      // ~24h on a fixed key, so a retry after enabling Connect on the
      // platform account would keep returning the old failure. The
      // stripeConnectAccountId column is the real dedup guard.
      const account = await stripe.accounts.create(
        {
          type: "express",
          metadata: { userId },
        },
        { idempotencyKey: `stripe-connect-acc-${merchant.id}-${Date.now()}` }
      );
      stripeAccountId = account.id;

      // Persist the account ID immediately so we can re-use it on refresh
      merchant = await prisma.merchant.update({
        where: { userId },
        data: { stripeConnectAccountId: stripeAccountId },
      });
      console.log(`[stripe-connect] Created Express account ${stripeAccountId} for provider ${userId}`);
    } else {
      console.log(`[stripe-connect] Re-using existing Express account ${stripeAccountId} for provider ${userId}`);
    }

    // Generate a fresh onboarding link (they expire after a few minutes)
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${PROVIDER_BASE_URL}/stripe/connect/refresh`,
      return_url: `${PROVIDER_BASE_URL}/stripe/connect/complete`,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
      },
    });

    reply.send({ success: true, data: { onboardingUrl: accountLink.url } });
  });

  // ── GET /merchant/me/stripe/connect/refresh ─────────────────────────────────
  // Called when Stripe redirects back with ?expired=true (link expired mid-flow).
  // Generates a new onboarding link for the existing Stripe account.
  app.get("/merchant/me/stripe/connect/refresh", {
    schema: {
      tags: ["Merchants"],
      description: "Re-generate an expired Stripe Connect onboarding link",
      security: [{ bearerAuth: [] }],
    },
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const merchant = await prisma.merchant.findUnique({ where: { userId } });
    if (!merchant?.stripeConnectAccountId) {
      return sendError(reply, 400, "NO_STRIPE_ACCOUNT", "No Stripe Connect account found. Call POST /merchant/me/stripe/connect first.");
    }

    const accountLink = await stripe.accountLinks.create({
      account: merchant.stripeConnectAccountId,
      refresh_url: `${PROVIDER_BASE_URL}/stripe/connect/refresh`,
      return_url:  `${PROVIDER_BASE_URL}/stripe/connect/complete`,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
      },
    });

    reply.send({ success: true, data: { onboardingUrl: accountLink.url } });
  });

  // ── GET /merchant/me/stripe/connect/status ──────────────────────────────────
  // Called after the provider returns from Stripe's onboarding page.
  // Checks whether onboarding is fully complete; if so, sets payoutMethod = stripe_connect.
  app.get("/merchant/me/stripe/connect/status", {
    schema: {
      tags: ["Merchants"],
      description: "Check Stripe Connect onboarding status and activate the payout method if complete",
      security: [{ bearerAuth: [] }],
    },
    preHandler: [requireAccount],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { userId } = req as GuestRequest;
    const merchant = await prisma.merchant.findUnique({ where: { userId } });
    if (!merchant?.stripeConnectAccountId) {
      return sendError(reply, 400, "NO_STRIPE_ACCOUNT", "No Stripe Connect account found. Call POST /merchant/me/stripe/connect first.");
    }

    // Fetch the live account status from Stripe
    const account = await stripe.accounts.retrieve(merchant.stripeConnectAccountId);

    const chargesEnabled   = account.charges_enabled   ?? false;
    const payoutsEnabled   = account.payouts_enabled   ?? false;
    const detailsSubmitted = account.details_submitted ?? false;

    // Activate Stripe payouts once the account is fully onboarded
    if (chargesEnabled && payoutsEnabled && detailsSubmitted) {
      await prisma.merchant.update({
        where: { userId },
        data: { payoutMethod: "stripe_connect", updatedAt: new Date() },
      });
      merchant.payoutMethod = "stripe_connect";
      console.log(`[stripe-connect] Account ${merchant.stripeConnectAccountId} fully onboarded — payoutMethod set to stripe_connect`);
    }

    reply.send({
      success: true,
      data: {
        stripeAccountId: merchant.stripeConnectAccountId,
        chargesEnabled,
        payoutsEnabled,
        detailsSubmitted,
        onboardingComplete: chargesEnabled && payoutsEnabled && detailsSubmitted,
        payoutMethod: merchant.payoutMethod,
      },
    });
  });
}
