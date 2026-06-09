/**
 * VOUCHER & PROMOTION REQUIREMENTS ANALYSIS
 * 
 * Missing Requirements & Edge Cases Identified for Production Readiness:
 * 1. Concurrency/Race Conditions: "Voucher not consumed until payment confirmed" causes over-redemption if multiple 
 *    users check out simultaneously with a limited voucher. A reservation (lock) mechanism is needed at checkout.
 * 2. Currency Context: discount_value, minimum_booking_value, maximum_discount_cap lack explicit currency bindings. 
 *    A worldwide system must enforce currency matching or conversion.
 * 3. Cancellations/Refunds: No policy defined for reverting usage counts when a booking is cancelled.
 * 4. Timezones: valid_from/valid_until need explicit timezone definitions (usually UTC in DB, but evaluated against what?).
 * 5. Cart-level vs Item-level: If a cart has multiple categories (Hotel + Car), does the voucher apply to the total cart 
 *    or only the scoped items? The logic assumes totalAmount.
 * 6. Per-Guest Limits: Enforcing usage_limit_per_guest requires a separate relation (e.g., VoucherRedemption table) 
 *    to track counts per guest.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireAdmin, type ProviderRequest } from "../middleware/auth.js";
import { getRedis } from "../lib/redis.js";

const errSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" } },
      required: ["code", "message"],
    },
  },
  required: ["success", "error"],
};

const voucherItemSchema = {
  type: "object",
  properties: {
    id:            { type: "string" },
    code:          { type: "string" },
    title:         { type: "string" },
    description:   { type: "string", maxLength: 120 },
    activityScope: { type: "string", enum: ["hotels", "apartments", "cars", "hotels_apartments", "universal"] },
    discountType:  { type: "string", enum: ["percentage", "fixed"] },
    discountValue: { type: "number" },
    minOrderValue: { type: "number", nullable: true },
    maxDiscount:   { type: "number", nullable: true },
    usageLimit:    { type: "integer", nullable: true },
    usageLimitPerGuest: { type: "integer", default: 1 },
    usageCount:    { type: "integer" },
    validFrom:     { type: "string" },
    validUntil:    { type: "string" },
    status:        { type: "string", enum: ["active", "paused", "expired", "exhausted"] },
    applicableTiers: { type: "array", items: { type: "string" } },
    countryScope:  { type: "string", nullable: true },
    autoAssign:    { type: "boolean" },
    isActive:      { type: "boolean" },
    createdAt:     { type: "string" },
  },
  required: ["id", "code", "discountType", "discountValue", "usageCount", "validFrom", "validUntil", "isActive", "createdAt"],
};

export async function voucherRoutes(app: FastifyInstance) {
  const redis = getRedis();

  // ── POST /vouchers/validate — validate a voucher code ────────────────────
  app.post(
    "/vouchers/validate",
    {
      schema: {
        tags: ["Vouchers"],
        summary: "Validate a voucher code and compute the discount for a given total",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["code", "totalAmount", "activity", "guestId"],
          properties: {
            code:        { type: "string" },
            totalAmount: { type: "number", minimum: 0 },
            currency:    { type: "string", minLength: 3, maxLength: 3 },
            activity:    { type: "string", enum: ["hotels", "apartments", "cars", "hotels_apartments", "universal"] },
            guestId:     { type: "string" },
            guestTier:   { type: "string", enum: ["Bronze", "Silver", "Gold", "Diamond"], nullable: true },
            guestCountry:{ type: "string", nullable: true },
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
                  valid:          { type: "boolean" },
                  discountAmount: { type: "number" },
                  voucherDiscount: { type: "number" },
                  message:        { type: "string" },
                  voucher: {
                    type: "object",
                    nullable: true,
                    properties: {
                      code:          { type: "string" },
                      discountType:  { type: "string", enum: ["percentage", "fixed"] },
                      discountValue: { type: "number" },
                      maxDiscount:   { type: "number", nullable: true },
                      validUntil:    { type: "string" },
                    },
                    required: ["code", "discountType", "discountValue", "maxDiscount", "validUntil"],
                  },
                },
                required: ["valid", "discountAmount", "voucherDiscount", "message"],
              },
            },
            required: ["success", "data"],
          },
          400: errSchema,
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as { code: string; totalAmount: number; currency?: string; activity: string; guestId: string; guestTier?: string; guestCountry?: string };

      const now = new Date();
      // @ts-ignore - Assuming prisma schema is updated
      const voucher = await prisma.voucher.findUnique({ where: { code: body.code } });

      if (!voucher)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher code not found.", voucher: null });
      
      // Replaced isActive with status check based on PRD (falling back to isActive if status isn't there yet)
      if ((voucher as any).status === "paused" || (voucher as any).status === "expired" || (voucher as any).status === "exhausted" || (!voucher.isActive && !(voucher as any).status))
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher is not active.", voucher: null });
      
      // Activity Scope check
      if ((voucher as any).activityScope && (voucher as any).activityScope !== "universal") {
        const allowed = (voucher as any).activityScope === "hotels_apartments" 
          ? ["hotels", "apartments"] 
          : [(voucher as any).activityScope];
        if (!allowed.includes(body.activity))
          return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher is not applicable for this activity.", voucher: null });
      }

      // Country Scope check
      if ((voucher as any).countryScope && (voucher as any).countryScope !== body.guestCountry)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher is not applicable in your country.", voucher: null });

      // Tier check
      const tiers = (voucher as any).applicableTiers || [];
      if (tiers.length > 0 && (!body.guestTier || !tiers.includes(body.guestTier)))
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher is not applicable for your loyalty tier.", voucher: null });

      if (now < voucher.validFrom || now > voucher.validUntil)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher has expired or is not yet valid.", voucher: null });
      if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher usage limit has been reached.", voucher: null });
        
      // FIXME: Add lookup for guest usage to enforce usageLimitPerGuest
      // const guestUsageCount = await prisma.voucherRedemption.count({ where: { voucherId: voucher.id, guestId: body.guestId } });
      // if (guestUsageCount >= ((voucher as any).usageLimitPerGuest || 1)) 
      //   return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Your per-guest usage limit has been reached.", voucher: null });

      if (voucher.minOrderValue !== null && body.totalAmount < Number(voucher.minOrderValue))
        return sendSuccess(reply, 200, {
          valid: false,
          discountAmount: 0,
          voucherDiscount: 0,
          message: `Minimum order value of ${Number(voucher.minOrderValue)} required to use this voucher.`,
          voucher: null,
        });

      let discountAmount: number;
      if (voucher.discountType === "percentage") {
        discountAmount = body.totalAmount * (Number(voucher.discountValue) / 100);
      } else {
        discountAmount = Number(voucher.discountValue);
      }
      if (voucher.maxDiscount !== null && discountAmount > Number(voucher.maxDiscount)) {
        discountAmount = Number(voucher.maxDiscount);
      }
      discountAmount = Math.min(discountAmount, body.totalAmount);

      return sendSuccess(reply, 200, {
        valid: true,
        discountAmount,
        voucherDiscount: discountAmount,
        message: "Voucher is valid.",
        voucher: {
          code:          voucher.code,
          discountType:  voucher.discountType,
          discountValue: Number(voucher.discountValue),
          maxDiscount:   voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
          validUntil:    voucher.validUntil.toISOString(),
        },
      });
    },
  );

  // ── GET /vouchers/applicable — Best Offer Wallet ──────────────────────────
  // Returns all active, date-valid vouchers alongside their computed discounts
  // for the guest's current booking context so the UI can surface the best offer.
  app.get(
    "/vouchers/applicable",
    {
      schema: {
        tags: ["Vouchers"],
        summary: "List applicable vouchers for the current booking context (Best Offer Wallet)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["totalAmount"],
          properties: {
            totalAmount: { type: "number", minimum: 0 },
            currency:    { type: "string" },
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
                  vouchers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        code:            { type: "string" },
                        discountType:    { type: "string", enum: ["percentage", "fixed"] },
                        discountValue:   { type: "number" },
                        maxDiscount:     { type: "number", nullable: true },
                        minOrderValue:   { type: "number", nullable: true },
                        computedDiscount: { type: "number" },
                        validUntil:      { type: "string" },
                        applicable:      { type: "boolean" },
                        reason:          { type: "string", nullable: true },
                      },
                      required: [
                        "code", "discountType", "discountValue",
                        "computedDiscount", "validUntil", "applicable",
                      ],
                    },
                  },
                },
                required: ["vouchers"],
              },
            },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { totalAmount?: string; currency?: string };
      const totalAmount = parseFloat(q.totalAmount ?? "0");
      const now = new Date();

      // @ts-ignore - Assuming status overrides isActive in the future
      const vouchers = await prisma.voucher.findMany({
        where: {
          // status: "active", // Use status instead of isActive after DB migration
          isActive: true,
          validFrom:  { lte: now },
          validUntil: { gte: now },
        },
        orderBy: { discountValue: "desc" },
        take: 20,
      });

      const result = vouchers.map((v) => {
        // Usage-exhausted
        if (v.usageLimit !== null && v.usageCount >= v.usageLimit) {
          return {
            code: v.code, discountType: v.discountType,
            discountValue: Number(v.discountValue),
            maxDiscount:   v.maxDiscount ? Number(v.maxDiscount) : null,
            minOrderValue: v.minOrderValue ? Number(v.minOrderValue) : null,
            computedDiscount: 0,
            validUntil: v.validUntil.toISOString(),
            applicable: false,
            reason: "Usage limit reached.",
          };
        }

        // Below minimum order value (show as not applicable but still surfaced)
        if (v.minOrderValue !== null && totalAmount < Number(v.minOrderValue)) {
          return {
            code: v.code, discountType: v.discountType,
            discountValue: Number(v.discountValue),
            maxDiscount:   v.maxDiscount ? Number(v.maxDiscount) : null,
            minOrderValue: Number(v.minOrderValue),
            computedDiscount: 0,
            validUntil: v.validUntil.toISOString(),
            applicable: false,
            reason: `Minimum order value of ${Number(v.minOrderValue)} required.`,
          };
        }

        let computedDiscount: number;
        if (v.discountType === "percentage") {
          computedDiscount = totalAmount * (Number(v.discountValue) / 100);
        } else {
          computedDiscount = Number(v.discountValue);
        }
        if (v.maxDiscount !== null && computedDiscount > Number(v.maxDiscount)) {
          computedDiscount = Number(v.maxDiscount);
        }
        computedDiscount = Math.min(computedDiscount, totalAmount);

        return {
          code: v.code, discountType: v.discountType,
          discountValue: Number(v.discountValue),
          maxDiscount:   v.maxDiscount ? Number(v.maxDiscount) : null,
          minOrderValue: v.minOrderValue ? Number(v.minOrderValue) : null,
          computedDiscount,
          validUntil: v.validUntil.toISOString(),
          applicable: true,
          reason: null,
        };
      });

      return sendSuccess(reply, 200, { vouchers: result });
    },
  );

  // ── POST /admin/vouchers — create a voucher ───────────────────────────────
  app.post(
    "/admin/vouchers",
    {
      schema: {
        tags: ["Admin Vouchers"],
        summary: "Create a new voucher (admin)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["code", "title", "activityScope", "discountType", "discountValue", "validFrom", "validUntil"],
          properties: {
            code:          { type: "string", minLength: 6, maxLength: 12 },
            title:         { type: "string" },
            description:   { type: "string", maxLength: 120 },
            activityScope: { type: "string", enum: ["hotels", "apartments", "cars", "hotels_apartments", "universal"] },
            discountType:  { type: "string", enum: ["percentage", "fixed"] },
            discountValue: { type: "number", minimum: 0.01 },
            minOrderValue: { type: "number", minimum: 0, nullable: true },
            maxDiscount:   { type: "number", minimum: 0, nullable: true },
            usageLimit:    { type: "integer", minimum: 1, nullable: true },
            usageLimitPerGuest: { type: "integer", default: 1 },
            status:        { type: "string", enum: ["active", "paused", "expired", "exhausted"], default: "active" },
            applicableTiers: { type: "array", items: { type: "string" } },
            countryScope:  { type: "string", nullable: true },
            autoAssign:    { type: "boolean", default: false },
            validFrom:     { type: "string" },
            validUntil:    { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: voucherItemSchema,
            },
            required: ["success", "data"],
          },
          400: errSchema,
          409: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        code: string;
        title: string;
        description?: string;
        activityScope: string;
        discountType: "percentage" | "fixed";
        discountValue: number;
        minOrderValue?: number;
        maxDiscount?: number;
        usageLimit?: number;
        usageLimitPerGuest?: number;
        status?: string;
        applicableTiers?: string[];
        countryScope?: string;
        autoAssign?: boolean;
        validFrom: string;
        validUntil: string;
      };

      if (!["percentage", "fixed"].includes(body.discountType))
        return sendError(reply, 400, "VALIDATION_ERROR", "discountType must be 'percentage' or 'fixed'.");
      if (body.discountValue <= 0)
        return sendError(reply, 400, "VALIDATION_ERROR", "discountValue must be greater than 0.");
      if (body.discountType === "percentage" && body.discountValue > 100)
        return sendError(reply, 400, "VALIDATION_ERROR", "Percentage discount cannot exceed 100.");

      const validFrom  = new Date(body.validFrom);
      const validUntil = new Date(body.validUntil);
      if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime()))
        return sendError(reply, 400, "VALIDATION_ERROR", "validFrom and validUntil must be valid ISO dates.");
      if (validUntil <= validFrom)
        return sendError(reply, 400, "VALIDATION_ERROR", "validUntil must be after validFrom.");

      const existing = await prisma.voucher.findUnique({ where: { code: body.code.toUpperCase() } });
      if (existing)
        return sendError(reply, 409, "DUPLICATE_CODE", "A voucher with this code already exists.");

      // @ts-ignore - Assuming prisma schema is updated to include new fields
      const voucher = await prisma.voucher.create({
        data: {
          code:          body.code.toUpperCase(),
          title:         body.title,
          description:   body.description,
          activityScope: body.activityScope,
          discountType:  body.discountType,
          discountValue: body.discountValue,
          minOrderValue: body.minOrderValue ?? null,
          maxDiscount:   body.maxDiscount ?? null,
          usageLimit:    body.usageLimit ?? null,
          usageLimitPerGuest: body.usageLimitPerGuest ?? 1,
          status:        body.status ?? "active",
          applicableTiers: body.applicableTiers ?? [],
          countryScope:  body.countryScope ?? null,
          autoAssign:    body.autoAssign ?? false,
          validFrom,
          validUntil,
          createdBy: "admin",
        } as any,
      });

      return sendSuccess(reply, 201, {
        id:            voucher.id,
        code:          voucher.code,
        title:         (voucher as any).title,
        activityScope: (voucher as any).activityScope,
        discountType:  voucher.discountType,
        discountValue: Number(voucher.discountValue),
        minOrderValue: voucher.minOrderValue ? Number(voucher.minOrderValue) : null,
        maxDiscount:   voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
        usageLimit:    voucher.usageLimit,
        usageCount:    voucher.usageCount,
        status:        (voucher as any).status,
        validFrom:     voucher.validFrom.toISOString(),
        validUntil:    voucher.validUntil.toISOString(),
        isActive:      voucher.isActive, // Keep for backward compatibility
        createdAt:     voucher.createdAt.toISOString(),
      });
    },
  );


  // ── GET /admin/promotions — list all promotion campaigns ─────────────────
  app.get(
    "/admin/promotions",
    {
      schema: {
        tags: ["Admin Promotions"],
        summary: "List all promotion campaigns (admin)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            isActive: { type: "string", enum: ["true", "false"] },
            category: { type: "string" },
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
                  promotions: {
                    type: "array",
                    items: { type: "object", additionalProperties: true },
                  },
                },
                required: ["promotions"],
              },
            },
          },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { isActive?: string; category?: string };

      const ids = await redis.smembers("promos:all");
      if (!ids.length) return sendSuccess(reply, 200, { promotions: [] });

      const pipeline = redis.pipeline();
      for (const id of ids) pipeline.get(`promo:${id}`);
      const results = await pipeline.exec();

      let promotions: any[] = (results ?? [])
        .map((r) => {
          if (!r || r[0] != null || !r[1]) return null;
          try { return JSON.parse(r[1] as string); } catch { return null; }
        })
        .filter(Boolean);

      if (q.isActive === "true")  promotions = promotions.filter((p) => p.isActive);
      else if (q.isActive === "false") promotions = promotions.filter((p) => !p.isActive);
      if (q.category) promotions = promotions.filter(
        (p) => p.category === q.category || p.category === "all",
      );

      promotions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return sendSuccess(reply, 200, { promotions });
    },
  );

  // ── GET /promotions/active — public: active promotions by category ────────
  app.get(
    "/promotions/active",
    {
      schema: {
        tags: ["Promotions"],
        summary: "Get currently active (date-valid) promotions, optionally filtered by category",
        querystring: {
          type: "object",
          properties: {
            category: { type: "string", enum: ["hotel", "apartment", "car"] },
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
                  promotions: {
                    type: "array",
                    items: { type: "object", additionalProperties: true },
                  },
                },
                required: ["promotions"],
              },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { category?: string };
      const now = new Date();

      const ids = await redis.smembers("promos:all");
      if (!ids.length) return sendSuccess(reply, 200, { promotions: [] });

      const pipeline = redis.pipeline();
      for (const id of ids) pipeline.get(`promo:${id}`);
      const results = await pipeline.exec();

      let promotions: any[] = (results ?? [])
        .map((r) => {
          if (!r || r[0] != null || !r[1]) return null;
          try { return JSON.parse(r[1] as string); } catch { return null; }
        })
        .filter(Boolean)
        .filter((p: any) => p.isActive && new Date(p.validFrom) <= now && new Date(p.validUntil) >= now);

      if (q.category) {
        promotions = promotions.filter((p: any) => p.category === q.category || p.category === "all");
      }

      return sendSuccess(reply, 200, { promotions });
    },
  );

  // ── GET /admin/vouchers — list all vouchers ───────────────────────────
  app.get("/admin/vouchers", { schema: { tags: ["Admin Vouchers"] }, preHandler: [requireAdmin] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const vouchers = await prisma.voucher.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { redemptions: true } } },
    });

    return sendSuccess(reply, 200, {
      vouchers: vouchers.map((v) => ({
        id: v.id,
        code: v.code,
        discountType: v.discountType,
        discountValue: Number(v.discountValue),
        minOrderValue: v.minOrderValue ? Number(v.minOrderValue) : null,
        maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
        usageLimit: v.usageLimit,
        usageCount: v.usageCount,
        redemptionCount: v._count.redemptions,
        validFrom: v.validFrom.toISOString(),
        validUntil: v.validUntil.toISOString(),
        isActive: v.isActive,
        createdBy: v.createdBy,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  });
}
