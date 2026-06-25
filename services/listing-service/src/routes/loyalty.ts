import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireAdmin, type ProviderRequest, type AdminRequest } from "../middleware/auth.js";

// ── Shared helper: insert a loyalty transaction row ───────────────────────────
export async function logLoyaltyTransaction(opts: {
  userId: string;
  type: string;
  points: number;
  balanceAfter: number;
  bookingId?: string;
  description?: string;
}) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO auth.loyalty_transactions
       (id, user_id, type, points, balance_after, booking_id, description, created_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NOW())`,
    opts.userId,
    opts.type,
    opts.points,
    opts.balanceAfter,
    opts.bookingId ?? null,
    opts.description ?? null,
  );
}

export async function loyaltyRoutes(app: FastifyInstance) {

  // ── GET /guests/me/loyalty ────────────────────────────────────────────────
  app.get(
    "/guests/me/loyalty",
    {
      schema: {
        tags: ["Loyalty"],
        summary: "Get current guest loyalty profile — tier, points balance and progress to next tier",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  userId:         { type: "string" },
                  currentTier:    { type: "string" },
                  loyaltyPoints:  { type: "integer" },
                  nextTier:       { type: "string", nullable: true },
                  pointsToNextTier: { type: "integer", nullable: true },
                  tierProgressPct:  { type: "number", nullable: true },
                  tierBenefits: {
                    type: "object",
                    properties: {
                      multiplier:   { type: "number" },
                      label:        { type: "string" },
                    },
                  },
                },
                required: ["userId", "currentTier", "loyaltyPoints"],
              },
            },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req as ProviderRequest).providerId;

      const rows = await prisma.$queryRawUnsafe<
        { loyaltyPoints: number; currentTier: string }[]
      >(`SELECT "loyaltyPoints", "currentTier" FROM auth."User" WHERE id = $1`, userId);

      if (!rows[0]) return sendError(reply, 404, "NOT_FOUND", "User not found.");

      const { loyaltyPoints, currentTier } = rows[0];
      const tier = currentTier.toLowerCase();

      const TIERS: Record<string, { min: number; max: number | null; multiplier: number; label: string }> = {
        bronze:  { min: 0,    max: 499,  multiplier: 1.0,  label: "Starting tier · all-tier vouchers" },
        silver:  { min: 500,  max: 1999, multiplier: 1.15, label: "Silver+ vouchers unlocked" },
        gold:    { min: 2000, max: 4999, multiplier: 1.25, label: "Gold+ vouchers · priority support" },
        diamond: { min: 5000, max: null, multiplier: 1.40, label: "All vouchers · early access · free upgrades" },
      };

      const NEXT: Record<string, { name: string; threshold: number } | null> = {
        bronze:  { name: "silver",  threshold: 500 },
        silver:  { name: "gold",    threshold: 2000 },
        gold:    { name: "diamond", threshold: 5000 },
        diamond: null,
      };

      const nextInfo    = NEXT[tier] ?? null;
      const tierInfo    = TIERS[tier]!;
      const nextTier    = nextInfo?.name ?? null;
      const pointsToNextTier = nextInfo ? nextInfo.threshold - loyaltyPoints : null;

      let tierProgressPct: number | null = null;
      if (nextInfo && tierInfo.max !== null) {
        const rangeSize = nextInfo.threshold - tierInfo.min;
        const progress  = loyaltyPoints - tierInfo.min;
        tierProgressPct = Math.min(100, Math.round((progress / rangeSize) * 100));
      } else if (!nextInfo) {
        tierProgressPct = 100;
      }

      return sendSuccess(reply, 200, {
        userId,
        currentTier: tier,
        loyaltyPoints,
        nextTier,
        pointsToNextTier,
        tierProgressPct,
        tierBenefits: {
          multiplier: tierInfo?.multiplier ?? 1,
          label:      tierInfo?.label ?? "",
        },
      });
    },
  );

  // ── GET /guests/me/points-history ─────────────────────────────────────────
  app.get(
    "/guests/me/points-history",
    {
      schema: {
        tags: ["Loyalty"],
        summary: "Paginated AfriPoints transaction history for the authenticated guest",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page:  { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  transactions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id:           { type: "string" },
                        type:         { type: "string" },
                        points:       { type: "integer" },
                        balanceAfter: { type: "integer" },
                        bookingId:    { type: "string", nullable: true },
                        description:  { type: "string", nullable: true },
                        createdAt:    { type: "string" },
                      },
                    },
                  },
                  pagination: {
                    type: "object",
                    properties: {
                      total:      { type: "integer" },
                      page:       { type: "integer" },
                      limit:      { type: "integer" },
                      totalPages: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req as ProviderRequest).providerId;
      const q      = req.query as { page?: number; limit?: number };
      const page   = Number(q.page  ?? 1);
      const limit  = Number(q.limit ?? 20);
      const offset = (page - 1) * limit;

      const [rows, countRows] = await Promise.all([
        prisma.$queryRawUnsafe<{
          id: string; type: string; points: number;
          balance_after: number; booking_id: string | null;
          description: string | null; created_at: Date;
        }[]>(
          `SELECT id, type, points, balance_after, booking_id, description, created_at
           FROM auth.loyalty_transactions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          userId, limit, offset,
        ),
        prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*) AS count FROM auth.loyalty_transactions WHERE user_id = $1`,
          userId,
        ),
      ]);

      const total = Number(countRows[0]?.count ?? 0);

      return sendSuccess(reply, 200, {
        transactions: rows.map((r) => ({
          id:           r.id,
          type:         r.type,
          points:       r.points,
          balanceAfter: r.balance_after,
          bookingId:    r.booking_id ?? null,
          description:  r.description ?? null,
          createdAt:    r.created_at.toISOString(),
        })),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  // ── PATCH /admin/guests/:id/points — manual points adjustment ────────────
  app.patch(
    "/admin/guests/:id/points",
    {
      schema: {
        tags: ["Admin Loyalty"],
        summary: "Manually add or deduct AfriPoints for a guest (admin)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["points", "reason"],
          properties: {
            points: {
              type: "integer",
              description: "Positive to credit, negative to debit",
            },
            reason: {
              type: "string",
              description: "Reason for the manual adjustment (stored as description)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  userId:        { type: "string" },
                  previousBalance: { type: "integer" },
                  adjustment:    { type: "integer" },
                  newBalance:    { type: "integer" },
                  newTier:       { type: "string" },
                },
              },
            },
          },
          400: { type: "object", properties: { success: { type: "boolean" }, error: { type: "object" } } },
          404: { type: "object", properties: { success: { type: "boolean" }, error: { type: "object" } } },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const adminReq = req as AdminRequest;
      const { id }   = req.params as { id: string };
      const { points: adjustment, reason } = req.body as { points: number; reason: string };

      if (adjustment === 0) {
        return sendError(reply, 400, "VALIDATION_ERROR", "Adjustment points cannot be 0.");
      }

      const rows = await prisma.$queryRawUnsafe<
        { loyaltyPoints: number; currentTier: string }[]
      >(`SELECT "loyaltyPoints", "currentTier" FROM auth."User" WHERE id = $1`, id);

      if (!rows[0]) return sendError(reply, 404, "NOT_FOUND", "Guest not found.");

      const previousBalance = rows[0].loyaltyPoints;
      const newBalance      = Math.max(0, previousBalance + adjustment);

      // Recalculate tier
      let newTier = "bronze";
      if (newBalance >= 5000)      newTier = "diamond";
      else if (newBalance >= 2000) newTier = "gold";
      else if (newBalance >= 500)  newTier = "silver";

      // Never downgrade tier on admin adjustment
      const tierRank: Record<string, number> = { bronze: 0, silver: 1, gold: 2, diamond: 3 };
      const currentRank = tierRank[rows[0].currentTier.toLowerCase()] ?? 0;
      const finalTier   = (tierRank[newTier] ?? 0) > currentRank ? newTier : rows[0].currentTier.toLowerCase();

      await prisma.$executeRawUnsafe(
        `UPDATE auth."User"
         SET "loyaltyPoints" = $1, "currentTier" = $2::auth."LoyaltyTier", "updatedAt" = NOW()
         WHERE id = $3`,
        newBalance, finalTier, id,
      );

      await logLoyaltyTransaction({
        userId:      id,
        type:        "admin_adjustment",
        points:      adjustment,
        balanceAfter: newBalance,
        description: `Admin adjustment by ${adminReq.adminId}: ${reason}`,
      });

      return sendSuccess(reply, 200, {
        userId:          id,
        previousBalance,
        adjustment,
        newBalance,
        newTier: finalTier,
      });
    },
  );

  // ── GET /admin/guests/:id/points-history ─────────────────────────────────
  app.get(
    "/admin/guests/:id/points-history",
    {
      schema: {
        tags: ["Admin Loyalty"],
        summary: "View full AfriPoints transaction history for any guest (admin)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        querystring: {
          type: "object",
          properties: {
            page:  { type: "integer", minimum: 1, default: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const q      = req.query as { page?: number; limit?: number };
      const page   = Number(q.page  ?? 1);
      const limit  = Number(q.limit ?? 20);
      const offset = (page - 1) * limit;

      const userRows = await prisma.$queryRawUnsafe<
        { loyaltyPoints: number; currentTier: string }[]
      >(`SELECT "loyaltyPoints", "currentTier" FROM auth."User" WHERE id = $1`, id);

      if (!userRows[0]) return sendError(reply, 404, "NOT_FOUND", "Guest not found.");

      const [rows, countRows] = await Promise.all([
        prisma.$queryRawUnsafe<{
          id: string; type: string; points: number;
          balance_after: number; booking_id: string | null;
          description: string | null; created_at: Date;
        }[]>(
          `SELECT id, type, points, balance_after, booking_id, description, created_at
           FROM auth.loyalty_transactions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          id, limit, offset,
        ),
        prisma.$queryRawUnsafe<{ count: bigint }[]>(
          `SELECT COUNT(*) AS count FROM auth.loyalty_transactions WHERE user_id = $1`,
          id,
        ),
      ]);

      const total = Number(countRows[0]?.count ?? 0);

      return sendSuccess(reply, 200, {
        userId:        id,
        loyaltyPoints: userRows[0].loyaltyPoints,
        currentTier:   userRows[0].currentTier,
        transactions:  rows.map((r) => ({
          id:           r.id,
          type:         r.type,
          points:       r.points,
          balanceAfter: r.balance_after,
          bookingId:    r.booking_id ?? null,
          description:  r.description ?? null,
          createdAt:    r.created_at.toISOString(),
        })),
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    },
  );
}
