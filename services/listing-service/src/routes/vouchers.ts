import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider, requireAdmin } from "../middleware/auth.js";
import { getRedis } from "../lib/redis.js";
import { randomUUID } from "crypto";

// ── Reusable error schema fragment ────────────────────────────────────────────

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

// ── Reusable voucher item schema ──────────────────────────────────────────────

const voucherItemSchema = {
  type: "object",
  properties: {
    id:            { type: "string" },
    code:          { type: "string" },
    discountType:  { type: "string", enum: ["percentage", "fixed"] },
    discountValue: { type: "number" },
    minOrderValue: { type: "number", nullable: true },
    maxDiscount:   { type: "number", nullable: true },
    usageLimit:    { type: "integer", nullable: true },
    usageCount:    { type: "integer" },
    validFrom:     { type: "string" },
    validUntil:    { type: "string" },
    isActive:      { type: "boolean" },
    createdAt:     { type: "string" },
  },
  required: [
    "id", "code", "discountType", "discountValue",
    "minOrderValue", "maxDiscount", "usageLimit",
    "usageCount", "validFrom", "validUntil", "isActive", "createdAt",
  ],
};

// ── Route plugin ──────────────────────────────────────────────────────────────

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
          required: ["code", "totalAmount"],
          properties: {
            code:        { type: "string" },
            totalAmount: { type: "number", minimum: 0 },
            currency:    { type: "string", minLength: 3, maxLength: 3 },
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
      const body = req.body as { code: string; totalAmount: number; currency?: string };

      const now = new Date();
      const voucher = await prisma.voucher.findUnique({ where: { code: body.code } });

      if (!voucher)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher code not found.", voucher: null });
      if (!voucher.isActive)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher is not active.", voucher: null });
      if (now < voucher.validFrom || now > voucher.validUntil)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher has expired or is not yet valid.", voucher: null });
      if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit)
        return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher usage limit has been reached.", voucher: null });
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

      const vouchers = await prisma.voucher.findMany({
        where: {
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
          required: ["code", "discountType", "discountValue", "validFrom", "validUntil"],
          properties: {
            code:          { type: "string", maxLength: 30 },
            discountType:  { type: "string", enum: ["percentage", "fixed"] },
            discountValue: { type: "number", minimum: 0.01 },
            minOrderValue: { type: "number", minimum: 0, nullable: true },
            maxDiscount:   { type: "number", minimum: 0, nullable: true },
            usageLimit:    { type: "integer", minimum: 1, nullable: true },
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
        discountType: "percentage" | "fixed";
        discountValue: number;
        minOrderValue?: number;
        maxDiscount?: number;
        usageLimit?: number;
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

      const voucher = await prisma.voucher.create({
        data: {
          code:          body.code.toUpperCase(),
          discountType:  body.discountType,
          discountValue: body.discountValue,
          minOrderValue: body.minOrderValue ?? null,
          maxDiscount:   body.maxDiscount ?? null,
          usageLimit:    body.usageLimit ?? null,
          validFrom,
          validUntil,
          createdBy: "admin",
        },
      });

      return sendSuccess(reply, 201, {
        id:            voucher.id,
        code:          voucher.code,
        discountType:  voucher.discountType,
        discountValue: Number(voucher.discountValue),
        minOrderValue: voucher.minOrderValue ? Number(voucher.minOrderValue) : null,
        maxDiscount:   voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
        usageLimit:    voucher.usageLimit,
        usageCount:    voucher.usageCount,
        validFrom:     voucher.validFrom.toISOString(),
        validUntil:    voucher.validUntil.toISOString(),
        isActive:      voucher.isActive,
        createdAt:     voucher.createdAt.toISOString(),
      });
    },
  );

  // ── GET /admin/vouchers — list all vouchers ───────────────────────────────
  app.get(
    "/admin/vouchers",
    {
      schema: {
        tags: ["Admin Vouchers"],
        summary: "List all vouchers with redemption counts (admin)",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            isActive: { type: "string", enum: ["true", "false"] },
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
                        ...voucherItemSchema.properties,
                        redemptionCount: { type: "integer" },
                        createdBy:       { type: "string" },
                      },
                      required: [
                        ...voucherItemSchema.required,
                        "redemptionCount", "createdBy",
                      ],
                    },
                  },
                },
                required: ["vouchers"],
              },
            },
            required: ["success", "data"],
          },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const q = req.query as { isActive?: string };
      const where: any = {};
      if (q.isActive === "true")  where.isActive = true;
      else if (q.isActive === "false") where.isActive = false;

      const vouchers = await prisma.voucher.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { redemptions: true } } },
      });

      return sendSuccess(reply, 200, {
        vouchers: vouchers.map((v) => ({
          id:              v.id,
          code:            v.code,
          discountType:    v.discountType,
          discountValue:   Number(v.discountValue),
          minOrderValue:   v.minOrderValue ? Number(v.minOrderValue) : null,
          maxDiscount:     v.maxDiscount ? Number(v.maxDiscount) : null,
          usageLimit:      v.usageLimit,
          usageCount:      v.usageCount,
          redemptionCount: v._count.redemptions,
          validFrom:       v.validFrom.toISOString(),
          validUntil:      v.validUntil.toISOString(),
          isActive:        v.isActive,
          createdBy:       v.createdBy,
          createdAt:       v.createdAt.toISOString(),
        })),
      });
    },
  );

  // ── PATCH /admin/vouchers/:id — activate / deactivate ────────────────────
  app.patch(
    "/admin/vouchers/:id",
    {
      schema: {
        tags: ["Admin Vouchers"],
        summary: "Activate or deactivate a voucher (admin)",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
        body: {
          type: "object",
          required: ["isActive"],
          properties: { isActive: { type: "boolean" } },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id:       { type: "string" },
                  code:     { type: "string" },
                  isActive: { type: "boolean" },
                },
                required: ["id", "code", "isActive"],
              },
            },
          },
          404: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { id } = req.params as { id: string };
      const { isActive } = req.body as { isActive: boolean };

      const existing = await prisma.voucher.findUnique({ where: { id } });
      if (!existing) return sendError(reply, 404, "NOT_FOUND", "Voucher not found.");

      const updated = await prisma.voucher.update({ where: { id }, data: { isActive } });

      return sendSuccess(reply, 200, {
        id:       updated.id,
        code:     updated.code,
        isActive: updated.isActive,
      });
    },
  );

  // ── POST /admin/promotions — create a promotion campaign ─────────────────
  // Promotions are Redis-backed (no Promotion table in the DB schema).
  // Active promotions are indexed by category key: promo:active:{category}
  app.post(
    "/admin/promotions",
    {
      schema: {
        tags: ["Admin Promotions"],
        summary: "Create a promotion campaign (admin, Redis-backed)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["title", "category", "discountType", "discountValue", "validFrom", "validUntil"],
          properties: {
            title:         { type: "string", maxLength: 120 },
            description:   { type: "string", maxLength: 500 },
            category:      { type: "string", enum: ["hotel", "apartment", "car", "all"] },
            discountType:  { type: "string", enum: ["percentage", "fixed"] },
            discountValue: { type: "number", minimum: 0.01 },
            maxDiscount:   { type: "number", minimum: 0, nullable: true },
            validFrom:     { type: "string" },
            validUntil:    { type: "string" },
            isActive:      { type: "boolean", default: true },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id:            { type: "string" },
                  title:         { type: "string" },
                  description:   { type: "string", nullable: true },
                  category:      { type: "string" },
                  discountType:  { type: "string" },
                  discountValue: { type: "number" },
                  maxDiscount:   { type: "number", nullable: true },
                  validFrom:     { type: "string" },
                  validUntil:    { type: "string" },
                  isActive:      { type: "boolean" },
                  createdAt:     { type: "string" },
                },
                required: [
                  "id", "title", "category", "discountType", "discountValue",
                  "validFrom", "validUntil", "isActive", "createdAt",
                ],
              },
            },
            required: ["success", "data"],
          },
          400: errSchema,
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = req.body as {
        title: string;
        description?: string;
        category: string;
        discountType: "percentage" | "fixed";
        discountValue: number;
        maxDiscount?: number;
        validFrom: string;
        validUntil: string;
        isActive?: boolean;
      };

      if (body.discountType === "percentage" && body.discountValue > 100)
        return sendError(reply, 400, "VALIDATION_ERROR", "Percentage discount cannot exceed 100.");

      const validFrom  = new Date(body.validFrom);
      const validUntil = new Date(body.validUntil);
      if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime()))
        return sendError(reply, 400, "VALIDATION_ERROR", "validFrom and validUntil must be valid ISO dates.");
      if (validUntil <= validFrom)
        return sendError(reply, 400, "VALIDATION_ERROR", "validUntil must be after validFrom.");

      const id       = randomUUID();
      const isActive = body.isActive !== false;
      const createdAt = new Date().toISOString();

      const promo = {
        id,
        title:         body.title,
        description:   body.description ?? null,
        category:      body.category,
        discountType:  body.discountType,
        discountValue: body.discountValue,
        maxDiscount:   body.maxDiscount ?? null,
        validFrom:     validFrom.toISOString(),
        validUntil:    validUntil.toISOString(),
        isActive,
        createdAt,
      };

      // Persist in Redis
      await redis.set(`promo:${id}`, JSON.stringify(promo));
      await redis.sadd("promos:all", id);

      // Mark as active for each affected category
      if (isActive) {
        const cats = body.category === "all"
          ? ["hotel", "apartment", "car"]
          : [body.category];
        for (const cat of cats) {
          await redis.set(`promo:active:${cat}`, id);
        }
      }

      return sendSuccess(reply, 201, promo);
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

      const categoriesToCheck = q.category
        ? [q.category]
        : ["hotel", "apartment", "car"];

      const promotions: any[] = [];
      const seen = new Set<string>();

      for (const cat of categoriesToCheck) {
        const activeId = await redis.get(`promo:active:${cat}`);
        if (!activeId || seen.has(activeId)) continue;

        const raw = await redis.get(`promo:${activeId}`);
        if (!raw) continue;

        try {
          const promo = JSON.parse(raw);
          if (
            promo.isActive &&
            new Date(promo.validFrom)  <= now &&
            new Date(promo.validUntil) >= now
          ) {
            promotions.push(promo);
            seen.add(activeId);
          }
        } catch { /* skip malformed entries */ }
      }

      return sendSuccess(reply, 200, { promotions });
    },
  );
}