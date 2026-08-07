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
import { requireAuth, requireUser, requireAdmin, type AuthRequest } from "../middleware/auth.js";

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
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
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
      const normalizedTiers = tiers.map((t: string) => t.toLowerCase());
      const guestTierLower = body.guestTier?.toLowerCase();
      if (normalizedTiers.length > 0 && (!guestTierLower || !normalizedTiers.includes(guestTierLower)))
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher is not applicable for your loyalty tier.", voucher: null });

      if (now < voucher.validFrom || now > voucher.validUntil)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher has expired or is not yet valid.", voucher: null });
      if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher usage limit has been reached.", voucher: null });
        
      const guestUsageCount = await prisma.voucherRedemption.count({
        where: { voucherId: voucher.id, guestId: body.guestId, bookingId: { not: { startsWith: "wallet-" } } },
      });
      if (guestUsageCount >= ((voucher as any).usageLimitPerGuest || 1)) 
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Your per-guest usage limit has been reached.", voucher: null });

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
      } catch (err) {
        req.log.error({ err }, "Failed to validate voucher");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while validating the voucher.");
      }
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
        summary: "List applicable vouchers for the current booking context (Best Offer Wallet). Filters by guest loyalty tier and per-guest usage limits.",
        description: "Returns active, date-valid vouchers scoped to the authenticated guest's loyalty tier. Vouchers with empty `applicableTiers` are available to all tiers (universal). Per-guest usage limits are enforced.",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["totalAmount"],
          properties: {
            totalAmount: { type: "number", minimum: 0, description: "The booking total amount in the listing's currency" },
            currency:    { type: "string", description: "ISO 4217 currency code" },
            activity:    { type: "string", enum: ["hotels", "apartments", "cars", "hotels_apartments", "universal"], description: "Booking activity type — filters out vouchers scoped to other activities" },
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
                  bannerState: { type: "string", enum: ["active", "expiring_soon", "none"] },
                  bestVoucher: { type: "object", nullable: true, additionalProperties: true },
                  vouchers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        code:             { type: "string" },
                        title:            { type: "string" },
                        description:      { type: "string", nullable: true },
                        activityScope:    { type: "string" },
                        discountType:     { type: "string", enum: ["percentage", "fixed"] },
                        discountValue:    { type: "number" },
                        maxDiscount:      { type: "number", nullable: true },
                        minOrderValue:    { type: "number", nullable: true },
                        computedDiscount: { type: "number" },
                        validUntil:       { type: "string" },
                        hoursUntilExpiry: { type: "number" },
                        applicable:       { type: "boolean" },
                        reason:           { type: "string", nullable: true },
                      },
                      required: ["code", "discountType", "discountValue", "computedDiscount", "validUntil", "applicable"],
                    },
                  },
                },
                required: ["bannerState", "vouchers"],
              },
            },
          },
        },
      },
      preHandler: [requireAuth],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const guestId = (req as AuthRequest).authId as string;
        const q = req.query as { totalAmount?: string; currency?: string; activity?: string };
      const totalAmount = parseFloat(q.totalAmount ?? "0");
      const activity = q.activity;
      const now = new Date();

      // Fetch the guest's current loyalty tier from auth.User
      let guestTier = "bronze";
      try {
        const userRes = await prisma.$queryRawUnsafe<{ currentTier: string }[]>(
          `SELECT "currentTier" FROM auth."User" WHERE id = $1`,
          guestId
        );
        if (userRes[0]) guestTier = userRes[0].currentTier.toLowerCase();
      } catch {
        // fallback to bronze if query fails
      }

      const vouchers = await prisma.voucher.findMany({
        where: {
          isActive: true,
          validFrom:  { lte: now },
          validUntil: { gte: now },
        },
        orderBy: { discountValue: "desc" },
        take: 50,
      });

      // Fetch per-guest redemption counts for all vouchers in one query
      const voucherIds = vouchers.map((v) => v.id);
      const redemptionCounts = voucherIds.length > 0
        ? await prisma.voucherRedemption.groupBy({
            by: ["voucherId"],
            where: {
              voucherId: { in: voucherIds },
              guestId,
              // Wallet placeholder rows (auto-assigned vouchers) must not count
              // toward the per-guest usage limit.
              bookingId: { not: { startsWith: "wallet-" } },
            },
            _count: { voucherId: true },
          })
        : [];
      const guestRedemptionMap = new Map<string, number>();
      for (const r of redemptionCounts) {
        guestRedemptionMap.set(r.voucherId, r._count.voucherId);
      }

      const result: any[] = [];
      for (const v of vouchers) {
        // Tier eligibility: empty applicableTiers = universal (all tiers)
        const applicableTiers: string[] = ((v as any).applicableTiers || []).map((t: string) => t.toLowerCase());
        if (applicableTiers.length > 0 && !applicableTiers.includes(guestTier)) {
          continue;
        }

        // Activity scope: skip vouchers that don't apply to the current booking type
        if (activity) {
          const scope: string = (v as any).activityScope ?? "universal";
          if (scope !== "universal") {
            const allowed = scope === "hotels_apartments" ? ["hotels", "apartments"] : [scope];
            if (!allowed.includes(activity)) continue;
          }
        }

        // Global usage limit
        if (v.usageLimit !== null && v.usageCount >= v.usageLimit) {
          result.push({
            code: v.code, title: (v as any).title ?? "", description: (v as any).description ?? null,
            activityScope: (v as any).activityScope ?? "universal",
            discountType: v.discountType, discountValue: Number(v.discountValue),
            maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
            minOrderValue: v.minOrderValue ? Number(v.minOrderValue) : null,
            computedDiscount: 0, validUntil: v.validUntil.toISOString(),
            hoursUntilExpiry: Math.max(0, (v.validUntil.getTime() - now.getTime()) / 3_600_000),
            applicable: false, reason: "Voucher usage limit has been reached.",
          });
          continue;
        }

        // Per-guest usage limit
        const guestUsageCount = guestRedemptionMap.get(v.id) ?? 0;
        const perGuestLimit = (v as any).usageLimitPerGuest ?? 1;
        if (guestUsageCount >= perGuestLimit) {
          result.push({
            code: v.code, title: (v as any).title ?? "", description: (v as any).description ?? null,
            activityScope: (v as any).activityScope ?? "universal",
            discountType: v.discountType, discountValue: Number(v.discountValue),
            maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
            minOrderValue: v.minOrderValue ? Number(v.minOrderValue) : null,
            computedDiscount: 0, validUntil: v.validUntil.toISOString(),
            hoursUntilExpiry: Math.max(0, (v.validUntil.getTime() - now.getTime()) / 3_600_000),
            applicable: false, reason: "Your per-guest usage limit for this voucher has been reached.",
          });
          continue;
        }

        // Below minimum order value
        if (v.minOrderValue !== null && totalAmount < Number(v.minOrderValue)) {
          result.push({
            code: v.code, title: (v as any).title ?? "", description: (v as any).description ?? null,
            activityScope: (v as any).activityScope ?? "universal",
            discountType: v.discountType, discountValue: Number(v.discountValue),
            maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
            minOrderValue: Number(v.minOrderValue),
            computedDiscount: 0, validUntil: v.validUntil.toISOString(),
            hoursUntilExpiry: Math.max(0, (v.validUntil.getTime() - now.getTime()) / 3_600_000),
            applicable: false, reason: `Minimum order value of ${Number(v.minOrderValue)} required.`,
          });
          continue;
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

        const hoursUntilExpiry = Math.max(0, (v.validUntil.getTime() - now.getTime()) / 3_600_000);
        result.push({
          code: v.code, title: (v as any).title ?? "", description: (v as any).description ?? null,
          activityScope: (v as any).activityScope ?? "universal",
          discountType: v.discountType, discountValue: Number(v.discountValue),
          maxDiscount: v.maxDiscount ? Number(v.maxDiscount) : null,
          minOrderValue: v.minOrderValue ? Number(v.minOrderValue) : null,
          computedDiscount, validUntil: v.validUntil.toISOString(),
          hoursUntilExpiry, applicable: true, reason: null,
        });
      }

      // Compute banner state: pick best applicable voucher
      const applicable = result.filter((v) => v.applicable);
      const bestVoucher = applicable.length > 0
        ? applicable.reduce((a, b) => b.computedDiscount > a.computedDiscount ? b : a)
        : null;
      const bannerState = bestVoucher === null ? "none"
        : bestVoucher.hoursUntilExpiry <= 48 ? "expiring_soon"
        : "active";

      return sendSuccess(reply, 200, { bannerState, bestVoucher, vouchers: result });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch applicable vouchers");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching applicable vouchers.");
      }
    },
  );

  // ── GET /vouchers/wallet — guest's auto-assigned vouchers ────────────────
  app.get(
    "/vouchers/wallet",
    {
      schema: {
        tags: ["Vouchers"],
        summary: "Get the authenticated guest's voucher wallet (auto-assigned vouchers)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            activity: { type: "string", enum: ["hotels", "apartments", "cars", "hotels_apartments", "universal"], description: "Current booking activity context" },
            guestCountry: { type: "string", description: "Guest's ISO 3166-1 alpha-2 country code" },
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
                        voucherId:        { type: "string" },
                        code:             { type: "string" },
                        title:            { type: "string" },
                        description:      { type: "string", nullable: true },
                        activityScope:    { type: "string" },
                        discountType:     { type: "string" },
                        discountValue:    { type: "number" },
                        maxDiscount:      { type: "number", nullable: true },
                        minOrderValue:    { type: "number", nullable: true },
                        validUntil:       { type: "string" },
                        hoursUntilExpiry: { type: "number" },
                        status:           { type: "string" },
                        assignedAt:       { type: "string" },
                      },
                    },
                  },
                },
                required: ["vouchers"],
              },
            },
          },
        },
      },
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const guestId = (req as AuthRequest).authId as string;
        const q = req.query as { activity?: string; guestCountry?: string };
        const now = new Date();

        // Auto-assigned wallet entries use the bookingId prefix "wallet-"
        const assignments = await prisma.voucherRedemption.findMany({
          where: { guestId, bookingId: { startsWith: "wallet-" } },
          include: { voucher: true },
          orderBy: { createdAt: "desc" },
        });

        const vouchers = assignments.map((a) => {
          const v = a.voucher;
          return {
            voucherId:        v.id,
            code:             v.code,
            title:            (v as any).title ?? "",
            description:      (v as any).description ?? null,
            activityScope:    (v as any).activityScope ?? "universal",
            discountType:     v.discountType,
            discountValue:    Number(v.discountValue),
            maxDiscount:      v.maxDiscount ? Number(v.maxDiscount) : null,
            minOrderValue:    v.minOrderValue ? Number(v.minOrderValue) : null,
            validUntil:       v.validUntil.toISOString(),
            hoursUntilExpiry: Math.max(0, (v.validUntil.getTime() - now.getTime()) / 3_600_000),
            status:           (v as any).status ?? "active",
            assignedAt:       a.createdAt.toISOString(),
          };
        }).filter((item) => {
          if (q.activity && item.activityScope !== "universal") {
            const allowed = item.activityScope === "hotels_apartments" 
              ? ["hotels", "apartments"] 
              : [item.activityScope];
            if (!allowed.includes(q.activity)) return false;
          }
          if (q.guestCountry) {
            const vRaw = assignments.find((a) => a.voucher.id === item.voucherId)?.voucher as any;
            if (vRaw?.countryScope && vRaw.countryScope !== q.guestCountry) return false;
          }
          return true;
        });

        return sendSuccess(reply, 200, { vouchers });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch voucher wallet");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching your voucher wallet.");
      }
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
          500: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
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
      } catch (err) {
        req.log.error({ err }, "Failed to create voucher");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while creating voucher.");
      }
    },
  );


  // ── POST /admin/promotions — create a promotion campaign ─────────────────
  app.post(
    "/admin/promotions",
    {
      schema: {
        tags: ["Admin Promotions"],
        summary: "Create an activity promotion (admin). One active promotion per category — any existing active/scheduled one is superseded.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["activity", "labelText", "bannerTitle", "validFrom", "validUntil"],
          properties: {
            activity:      { type: "string", enum: ["hotel", "apartment", "car"] },
            labelText:     { type: "string", minLength: 1, maxLength: 20 },
            labelColour:   { type: "string", maxLength: 10, default: "#C84B2F" },
            discountType:  { type: "string", enum: ["percentage", "fixed", "label_only"], default: "label_only" },
            discountValue: { type: "number", minimum: 0, nullable: true },
            validFrom:     { type: "string" },
            validUntil:    { type: "string" },
            applyToBooking: { type: "boolean", default: false },
            bannerTitle:   { type: "string", maxLength: 100 },
            bannerSubtitle: { type: "string", maxLength: 200, nullable: true },
            status:        { type: "string", enum: ["scheduled", "active", "paused", "expired", "superseded"], default: "active" },
            countryScope:  { type: "string", minLength: 2, maxLength: 2, nullable: true },
          },
        },
        response: {
          201: { type: "object", properties: { success: { type: "boolean" }, data: { type: "object", additionalProperties: true } } },
          400: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = req.body as {
          activity: string; labelText: string; labelColour?: string;
          discountType?: string; discountValue?: number; validFrom: string;
          validUntil: string; applyToBooking?: boolean; bannerTitle: string;
          bannerSubtitle?: string; status?: string; countryScope?: string;
        };

        const validFrom  = new Date(body.validFrom);
        const validUntil = new Date(body.validUntil);
        if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime()))
          return sendError(reply, 400, "VALIDATION_ERROR", "validFrom and validUntil must be valid ISO dates.");
        if (validUntil <= validFrom)
          return sendError(reply, 400, "VALIDATION_ERROR", "validUntil must be after validFrom.");
        if ((body.discountType === "percentage" || body.discountType === "fixed") && !body.discountValue)
          return sendError(reply, 400, "VALIDATION_ERROR", "discountValue is required when discountType is percentage or fixed.");

        const status = body.status ?? "active";

        // Supersede any existing active or scheduled promotion for this activity if activating/scheduling
        if (status === "active" || status === "scheduled") {
          await (prisma as any).activityPromotion.updateMany({
            where: { activity: body.activity, status: { in: ["active", "scheduled"] } },
            data:  { status: "superseded" },
          });
        }

        const promo = await (prisma as any).activityPromotion.create({
          data: {
            activity:       body.activity,
            labelText:      body.labelText.toUpperCase(),
            labelColour:    body.labelColour ?? "#C84B2F",
            discountType:   body.discountType ?? "label_only",
            discountValue:  body.discountValue ?? null,
            validFrom,
            validUntil,
            applyToBooking: body.applyToBooking ?? false,
            bannerTitle:    body.bannerTitle,
            bannerSubtitle: body.bannerSubtitle ?? null,
            status,
            countryScope:   body.countryScope ?? null,
          },
        });

        return sendSuccess(reply, 201, promo);
      } catch (err) {
        req.log.error({ err }, "Failed to create promotion");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while creating promotion.");
      }
    },
  );
// Add this helper function here:
async function updatePromotionStatuses(prisma: any): Promise<void> {
  const now = new Date();

  // 1. Transition 'scheduled' promotions to 'active' if they have started
  await prisma.activityPromotion.updateMany({
    where: {
      status: "scheduled",
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    data: { status: "active" },
  });

  // 2. Transition 'active' or 'scheduled' promotions to 'expired' if their end date has passed
  await prisma.activityPromotion.updateMany({
    where: {
      status: { in: ["active", "scheduled"] },
      validUntil: { lt: now },
    },
    data: { status: "expired" },
  });

  // 3. Transition 'active' promotions to 'scheduled' if their start date is in the future
  await prisma.activityPromotion.updateMany({
    where: {
      status: "active",
      validFrom: { gt: now },
    },
    data: { status: "scheduled" },
  });
}


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
            status:   { type: "string", enum: ["scheduled", "active", "paused", "expired", "superseded"] },
            activity: { type: "string", enum: ["hotel", "apartment", "car"] },
            page:     { type: "integer", minimum: 1, default: 1 },
            limit:    { type: "integer", minimum: 1, maximum: 100, default: 20 },
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
                  promotions: { type: "array", items: { type: "object", additionalProperties: true } },
                  pagination: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await updatePromotionStatuses(prisma);
        const q = req.query as { status?: string; activity?: string; page?: number; limit?: number };
        const page  = Number(q.page  ?? 1);
        const limit = Number(q.limit ?? 20);
        const skip  = (page - 1) * limit;

        const where: any = {};

        if (q.status) {
          // Caller explicitly requested a specific status (including 'superseded') — honour it.
          where.status = q.status;
        } else {
          // Default: exclude 'superseded' promotions.
          // When a new promotion is created it sets the previous active/scheduled one to
          // 'superseded' (see POST /admin/promotions, supersede block) but leaves the row
          // in the database. Without this exclusion, deleting the latest promotion causes
          // the old superseded row to reappear in the list on refresh.
          where.status = { not: "superseded" };
        }

        if (q.activity) where.activity = q.activity;

        const [promotions, total] = await Promise.all([
          (prisma as any).activityPromotion.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
          (prisma as any).activityPromotion.count({ where }),
        ]);

        return sendSuccess(reply, 200, {
          promotions,
          pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
      } catch (err) {
        req.log.error({ err }, "Failed to list admin promotions");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while listing promotions.");
      }
    },
  );

  // ── PATCH /admin/promotions/:id — update a promotion ─────────────────────
  app.patch(
    "/admin/promotions/:id",
    {
      schema: {
        tags: ["Admin Promotions"],
        summary: "Update a promotion campaign (admin). Setting status to active supersedes other active promotions for the same activity.",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          properties: {
            labelText:      { type: "string", minLength: 1, maxLength: 20 },
            labelColour:    { type: "string", maxLength: 10 },
            discountType:   { type: "string", enum: ["percentage", "fixed", "label_only"] },
            discountValue:  { type: "number", minimum: 0, nullable: true },
            validFrom:      { type: "string" },
            validUntil:     { type: "string" },
            applyToBooking: { type: "boolean" },
            bannerTitle:    { type: "string", maxLength: 100 },
            bannerSubtitle: { type: "string", maxLength: 200, nullable: true },
            status:         { type: "string", enum: ["scheduled", "active", "paused", "expired", "superseded"] },
            countryScope:   { type: "string", minLength: 2, maxLength: 2, nullable: true },
          },
        },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" }, data: { type: "object", additionalProperties: true } } },
          404: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };
        const body = req.body as any;

        const existing = await (prisma as any).activityPromotion.findUnique({ where: { id } });
        if (!existing) return sendError(reply, 404, "NOT_FOUND", "Promotion not found.");

        // If activating, supersede other active/scheduled promotions for same activity
        if (body.status === "active") {
          await (prisma as any).activityPromotion.updateMany({
            where: { activity: existing.activity, status: { in: ["active", "scheduled"] }, id: { not: id } },
            data:  { status: "superseded" },
          });
        }

        const data: any = {};
        if (body.labelText      !== undefined) data.labelText      = body.labelText.toUpperCase();
        if (body.labelColour    !== undefined) data.labelColour    = body.labelColour;
        if (body.discountType   !== undefined) data.discountType   = body.discountType;
        if (body.discountValue  !== undefined) data.discountValue  = body.discountValue;
        if (body.validFrom      !== undefined) data.validFrom      = new Date(body.validFrom);
        if (body.validUntil     !== undefined) data.validUntil     = new Date(body.validUntil);
        if (body.applyToBooking !== undefined) data.applyToBooking = body.applyToBooking;
        if (body.bannerTitle    !== undefined) data.bannerTitle    = body.bannerTitle;
        if (body.bannerSubtitle !== undefined) data.bannerSubtitle = body.bannerSubtitle;
        if (body.status         !== undefined) data.status         = body.status;
        if (body.countryScope   !== undefined) data.countryScope   = body.countryScope;

        const promo = await (prisma as any).activityPromotion.update({ where: { id }, data });
        return sendSuccess(reply, 200, promo);
      } catch (err) {
        req.log.error({ err }, "Failed to update promotion");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while updating promotion.");
      }
    },
  );

  // ── DELETE /admin/promotions/:id — remove a promotion ────────────────────
  app.delete(
    "/admin/promotions/:id",
    {
      schema: {
        tags: ["Admin Promotions"],
        summary: "Delete a promotion campaign (admin)",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          404: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };
        const existing = await (prisma as any).activityPromotion.findUnique({ where: { id } });
        if (!existing) return sendError(reply, 404, "NOT_FOUND", "Promotion not found.");
        await (prisma as any).activityPromotion.delete({ where: { id } });
        return sendSuccess(reply, 200, { deleted: true });
      } catch (err) {
        req.log.error({ err }, "Failed to delete promotion");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while deleting promotion.");
      }
    },
  );

  // ── GET /promotions/active — public: active promotions by category ────────
  app.get(
    "/promotions/active",
    {
      schema: {
        tags: ["Promotions"],
        summary: "Get currently active (date-valid) promotions, optionally filtered by activity category",
        querystring: {
          type: "object",
          properties: {
            activity: { type: "string", enum: ["hotel", "apartment", "car"] },
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
                  promotions: { type: "array", items: { type: "object", additionalProperties: true } },
                },
                required: ["promotions"],
              },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await updatePromotionStatuses(prisma);
        const q = req.query as { activity?: string };
        const now = new Date();

        const where: any = {
          status:    "active",
          validFrom: { lte: now },
          validUntil: { gte: now },
        };
        if (q.activity) where.activity = q.activity;

        const promotions = await (prisma as any).activityPromotion.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return sendSuccess(reply, 200, { promotions });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch active promotions");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching active promotions.");
      }
    },
  );

  // ── PATCH /admin/vouchers/:id — update a voucher ─────────────────────
  app.patch(
    "/admin/vouchers/:id",
    {
      schema: {
        tags: ["Admin Vouchers"],
        summary: "Update a voucher (admin)",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        body: {
          type: "object",
          properties: {
            code:               { type: "string", minLength: 6, maxLength: 12 },
            title:              { type: "string" },
            description:        { type: "string", maxLength: 120, nullable: true },
            activityScope:      { type: "string", enum: ["hotels", "apartments", "cars", "hotels_apartments", "universal"] },
            discountType:       { type: "string", enum: ["percentage", "fixed"] },
            discountValue:      { type: "number", minimum: 0.01 },
            minOrderValue:      { type: "number", minimum: 0, nullable: true },
            maxDiscount:        { type: "number", minimum: 0, nullable: true },
            usageLimit:         { type: "integer", minimum: 1, nullable: true },
            usageLimitPerGuest: { type: "integer", minimum: 1 },
            isActive:           { type: "boolean" },
            applicableTiers:    { type: "array", items: { type: "string" } },
            countryScope:       { type: "string", nullable: true },
            autoAssign:         { type: "boolean" },
            validFrom:          { type: "string" },
            validUntil:         { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: { success: { type: "boolean" }, data: voucherItemSchema },
            required: ["success", "data"],
          },
          400: errSchema,
          404: errSchema,
          409: errSchema,
          500: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };
        const body = req.body as {
          code?: string;
          title?: string;
          description?: string;
          activityScope?: string;
          discountType?: "percentage" | "fixed";
          discountValue?: number;
          minOrderValue?: number | null;
          maxDiscount?: number | null;
          usageLimit?: number | null;
          usageLimitPerGuest?: number;
          isActive?: boolean;
          applicableTiers?: string[];
          countryScope?: string | null;
          autoAssign?: boolean;
          validFrom?: string;
          validUntil?: string;
        };

        const existing = await prisma.voucher.findUnique({ where: { id } });
        if (!existing) return sendError(reply, 404, "NOT_FOUND", "Voucher not found.");

        if (body.discountType && !["percentage", "fixed"].includes(body.discountType))
          return sendError(reply, 400, "VALIDATION_ERROR", "discountType must be 'percentage' or 'fixed'.");
        if (body.discountValue !== undefined && body.discountValue <= 0)
          return sendError(reply, 400, "VALIDATION_ERROR", "discountValue must be greater than 0.");
        const effectiveDiscountType = body.discountType ?? (existing as any).discountType;
        const effectiveDiscountValue = body.discountValue ?? Number((existing as any).discountValue);
        if (effectiveDiscountType === "percentage" && effectiveDiscountValue > 100)
          return sendError(reply, 400, "VALIDATION_ERROR", "Percentage discount cannot exceed 100.");

        let validFrom: Date | undefined;
        let validUntil: Date | undefined;
        if (body.validFrom) {
          validFrom = new Date(body.validFrom);
          if (isNaN(validFrom.getTime()))
            return sendError(reply, 400, "VALIDATION_ERROR", "validFrom must be a valid ISO date.");
        }
        if (body.validUntil) {
          validUntil = new Date(body.validUntil);
          if (isNaN(validUntil.getTime()))
            return sendError(reply, 400, "VALIDATION_ERROR", "validUntil must be a valid ISO date.");
        }
        const effectiveFrom  = validFrom  ?? (existing as any).validFrom;
        const effectiveUntil = validUntil ?? (existing as any).validUntil;
        if (effectiveUntil <= effectiveFrom)
          return sendError(reply, 400, "VALIDATION_ERROR", "validUntil must be after validFrom.");

        if (body.code) {
          const upper = body.code.toUpperCase();
          const dup = await prisma.voucher.findUnique({ where: { code: upper } });
          if (dup && dup.id !== id)
            return sendError(reply, 409, "DUPLICATE_CODE", "A voucher with this code already exists.");
          body.code = upper;
        }

        const updateData: Record<string, unknown> = {};
        if (body.code               !== undefined) updateData.code               = body.code;
        if (body.title              !== undefined) updateData.title              = body.title;
        if (body.description        !== undefined) updateData.description        = body.description;
        if (body.activityScope      !== undefined) updateData.activityScope      = body.activityScope;
        if (body.discountType       !== undefined) updateData.discountType       = body.discountType;
        if (body.discountValue      !== undefined) updateData.discountValue      = body.discountValue;
        if (body.minOrderValue      !== undefined) updateData.minOrderValue      = body.minOrderValue;
        if (body.maxDiscount        !== undefined) updateData.maxDiscount        = body.maxDiscount;
        if (body.usageLimit         !== undefined) updateData.usageLimit         = body.usageLimit;
        if (body.usageLimitPerGuest !== undefined) updateData.usageLimitPerGuest = body.usageLimitPerGuest;
        if (body.applicableTiers    !== undefined) updateData.applicableTiers    = body.applicableTiers;
        if (body.countryScope       !== undefined) updateData.countryScope       = body.countryScope;
        if (body.autoAssign         !== undefined) updateData.autoAssign         = body.autoAssign;
        if (validFrom               !== undefined) updateData.validFrom          = validFrom;
        if (validUntil              !== undefined) updateData.validUntil         = validUntil;
        if (body.isActive           !== undefined) {
          updateData.isActive = body.isActive;
          updateData.status   = body.isActive ? "active" : "paused";
        }

        const voucher = await (prisma.voucher.update as any)({
          where: { id },
          data: updateData,
        });

        return sendSuccess(reply, 200, {
          id:                 voucher.id,
          code:               voucher.code,
          title:              voucher.title,
          activityScope:      voucher.activityScope,
          discountType:       voucher.discountType,
          discountValue:      Number(voucher.discountValue),
          minOrderValue:      voucher.minOrderValue ? Number(voucher.minOrderValue) : null,
          maxDiscount:        voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
          usageLimit:         voucher.usageLimit,
          usageLimitPerGuest: voucher.usageLimitPerGuest,
          usageCount:         voucher.usageCount,
          status:             voucher.status,
          isActive:           voucher.isActive,
          validFrom:          voucher.validFrom.toISOString(),
          validUntil:         voucher.validUntil.toISOString(),
          createdBy:          voucher.createdBy,
          createdAt:          voucher.createdAt.toISOString(),
        });
      } catch (err) {
        req.log.error({ err }, "Failed to update voucher");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while updating voucher.");
      }
    },
  );

  // ── DELETE /admin/vouchers/:id — delete a voucher ────────────────────
  app.delete(
    "/admin/vouchers/:id",
    {
      schema: {
        tags: ["Admin Vouchers"],
        summary: "Delete a voucher (admin)",
        security: [{ bearerAuth: [] }],
        params: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
        response: {
          200: { type: "object", properties: { success: { type: "boolean" } } },
          404: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id } = req.params as { id: string };
        const existing = await prisma.voucher.findUnique({ where: { id } });
        if (!existing) return sendError(reply, 404, "NOT_FOUND", "Voucher not found.");
        await prisma.voucherRedemption.deleteMany({ where: { voucherId: id } });
        await prisma.voucher.delete({ where: { id } });
        return sendSuccess(reply, 200, { deleted: true });
      } catch (err) {
        req.log.error({ err }, "Failed to delete voucher");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while deleting voucher.");
      }
    },
  );

  // ── GET /admin/vouchers — list all vouchers ───────────────────────────
  app.get(
    "/admin/vouchers",
    {
      schema: {
        tags: ["Admin Vouchers"],
        summary: "List all vouchers with optional isActive filter and pagination (admin)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            isActive: { type: "string", enum: ["true", "false"] },
            status:   { type: "string", enum: ["active", "paused", "expired", "exhausted"] },
            page:     { type: "integer", minimum: 1, default: 1 },
            limit:    { type: "integer", minimum: 1, maximum: 100, default: 20 },
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
                  vouchers: { type: "array", items: { type: "object", additionalProperties: true } },
                  pagination: {
                    type: "object",
                    properties: {
                      total:       { type: "integer" },
                      page:        { type: "integer" },
                      limit:       { type: "integer" },
                      totalPages:  { type: "integer" },
                    },
                    required: ["total", "page", "limit", "totalPages"],
                  },
                },
                required: ["vouchers", "pagination"],
              },
            },
          },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const q = req.query as { isActive?: string; status?: string; page?: number; limit?: number };
        const page  = Number(q.page  ?? 1);
      const limit = Number(q.limit ?? 20);
      const skip  = (page - 1) * limit;

      const where: any = {};
      if (q.isActive === "true")  where.isActive = true;
      else if (q.isActive === "false") where.isActive = false;
      if (q.status) where.status = q.status;

      const [vouchers, total] = await Promise.all([
        prisma.voucher.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          // Note: _count removed — computed separately below with a safe fallback
          // so the endpoint works even if the production DB is missing new columns.
        }),
        prisma.voucher.count({ where }),
      ]);

      // Fetch redemption counts and financial metrics per voucher; fall back to 0 if table unavailable
      const redemptionCountMap = new Map<string, number>();
      const totalDiscountMap = new Map<string, number>();
      const totalBookingValueMap = new Map<string, number>();
      
      try {
        const voucherIds = vouchers.map((v) => v.id);
        if (voucherIds.length > 0) {
          // Get redemption counts
          const counts = await prisma.voucherRedemption.groupBy({
            by: ["voucherId"],
            where: { voucherId: { in: voucherIds } },
            _count: { voucherId: true },
          });
          for (const c of counts) {
            redemptionCountMap.set(c.voucherId, c._count.voucherId);
          }

          // Get total discount given per voucher
          const discountAgg = await prisma.voucherRedemption.groupBy({
            by: ["voucherId"],
            where: { voucherId: { in: voucherIds } },
            _sum: { discount: true },
          });
          for (const d of discountAgg) {
            totalDiscountMap.set(d.voucherId, Number(d._sum.discount ?? 0));
          }

          // Get total booking value for vouchers (sum of totalAmount from bookings where voucher was used)
          const bookingAgg = await prisma.voucherRedemption.groupBy({
            by: ["voucherId"],
            where: { voucherId: { in: voucherIds } },
            _sum: { discount: true },
          });
          
          // Fetch booking totalAmount for each redemption
          const redemptions = await prisma.voucherRedemption.findMany({
            where: { voucherId: { in: voucherIds } },
            select: { voucherId: true, bookingId: true, discount: true },
          });
          
          // Batch fetch bookings
          const bookingIds = redemptions.map((r) => r.bookingId);
          if (bookingIds.length > 0) {
            const bookings = await prisma.booking.findMany({
              where: { id: { in: bookingIds } },
              select: { id: true, totalAmount: true },
            });
            const bookingAmountMap = new Map(bookings.map((b) => [b.id, Number(b.totalAmount)]));
            
            // Aggregate total booking value per voucher
            for (const r of redemptions) {
              const current = totalBookingValueMap.get(r.voucherId) ?? 0;
              const bookingAmount = bookingAmountMap.get(r.bookingId) ?? 0;
              totalBookingValueMap.set(r.voucherId, current + bookingAmount);
            }
          }
        }
      } catch {
        // voucher_redemptions table not yet available on this environment — default to 0
      }

      return sendSuccess(reply, 200, {
        vouchers: vouchers.map((v) => {
          const redemptionCount = redemptionCountMap.get(v.id) ?? 0;
          const totalDiscountGiven = totalDiscountMap.get(v.id) ?? 0;
          const totalBookingValue = totalBookingValueMap.get(v.id) ?? 0;
          
          return {
            id:              v.id,
            code:            v.code,
            title:           (v as any).title ?? "",
            activityScope:   (v as any).activityScope ?? "universal",
            discountType:    v.discountType,
            discountValue:   Number(v.discountValue),
            minOrderValue:   v.minOrderValue ? Number(v.minOrderValue) : null,
            maxDiscount:     v.maxDiscount ? Number(v.maxDiscount) : null,
            usageLimit:      v.usageLimit,
            usageLimitPerGuest: (v as any).usageLimitPerGuest ?? 1,
            usageCount:      v.usageCount,
            status:          (v as any).status ?? (v.isActive ? "active" : "paused"),
            applicableTiers: (v as any).applicableTiers ?? [],
            countryScope:    (v as any).countryScope ?? null,
            autoAssign:      (v as any).autoAssign ?? false,
            redemptionCount,
            totalDiscountGiven,
            avgDiscountPerRedemption: redemptionCount > 0 ? totalDiscountGiven / redemptionCount : 0,
            totalBookingValue,
            validFrom:       v.validFrom.toISOString(),
            validUntil:      v.validUntil.toISOString(),
            isActive:        v.isActive,
            createdBy:       v.createdBy,
            createdAt:       v.createdAt.toISOString(),
          };
        }),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
      } catch (err) {
        req.log.error({ err }, "Failed to fetch admin vouchers list");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching vouchers.");
      }
    },
  );
}