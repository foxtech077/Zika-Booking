import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireProvider } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";

export async function voucherRoutes(app: FastifyInstance) {
  // ── POST /vouchers/validate — validate a voucher code ────────────────
  app.post("/vouchers/validate", {
    schema: {
      tags: ["Vouchers"],
      body: {
        type: "object",
        required: ["code", "totalAmount"],
        properties: {
          code: { type: "string" },
          totalAmount: { type: "number", minimum: 0 },
          currency: { type: "string", minLength: 3, maxLength: 3 }
        }
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                valid: { type: "boolean" },
                discountAmount: { type: "number" },
                voucherDiscount: { type: "number" },
                message: { type: "string" },
                voucher: {
                  type: "object",
                  nullable: true,
                  properties: {
                    code: { type: "string" },
                    discountType: { type: "string", enum: ["percentage", "fixed"] },
                    discountValue: { type: "number" },
                    maxDiscount: { type: "number", nullable: true },
                    validUntil: { type: "string" }
                  },
                  required: ["code", "discountType", "discountValue", "maxDiscount", "validUntil"]
                }
              },
              required: ["valid", "discountAmount", "voucherDiscount", "message"]
            }
          },
          required: ["success", "data"]
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        }
      }
    },
    preHandler: [requireProvider]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { code: string; totalAmount: number; currency?: string };

    if (!body.code || body.totalAmount === undefined) {
      return sendError(reply, 400, "VALIDATION_ERROR", "code and totalAmount are required.");
    }

    const now = new Date();
    const voucher = await prisma.voucher.findUnique({ where: { code: body.code } });

    if (!voucher) {
      return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher code not found.", voucher: null });
    }
    if (!voucher.isActive) {
      return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher is not active.", voucher: null });
    }
    if (now < voucher.validFrom || now > voucher.validUntil) {
      return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher has expired or is not yet valid.", voucher: null });
    }
    if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
      return sendSuccess(reply, 200, { valid: false, discountAmount: 0, voucherDiscount: 0, message: "Voucher usage limit has been reached.", voucher: null });
    }
    if (voucher.minOrderValue !== null && body.totalAmount < Number(voucher.minOrderValue)) {
      return sendSuccess(reply, 200, {
        valid: false,
        discountAmount: 0,
        voucherDiscount: 0,
        message: `Minimum order value of ${Number(voucher.minOrderValue)} required to use this voucher.`,
        voucher: null
      });
    }

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
        code: voucher.code,
        discountType: voucher.discountType,
        discountValue: Number(voucher.discountValue),
        maxDiscount: voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
        validUntil: voucher.validUntil.toISOString(),
      },
    });
  });

  // ── POST /admin/vouchers — create a voucher ───────────────────────────
  app.post("/admin/vouchers", {
    schema: {
      tags: ["Admin Vouchers"],
      body: {
        type: "object",
        required: ["code", "discountType", "discountValue", "validFrom", "validUntil"],
        properties: {
          code: { type: "string" },
          discountType: { type: "string", enum: ["percentage", "fixed"] },
          discountValue: { type: "number", minimum: 0.01 },
          minOrderValue: { type: "number", minimum: 0, nullable: true },
          maxDiscount: { type: "number", minimum: 0, nullable: true },
          usageLimit: { type: "integer", minimum: 1, nullable: true },
          validFrom: { type: "string" },
          validUntil: { type: "string" }
        }
      },
      response: {
        201: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                id: { type: "string" },
                code: { type: "string" },
                discountType: { type: "string", enum: ["percentage", "fixed"] },
                discountValue: { type: "number" },
                minOrderValue: { type: "number", nullable: true },
                maxDiscount: { type: "number", nullable: true },
                usageLimit: { type: "integer", nullable: true },
                usageCount: { type: "integer" },
                validFrom: { type: "string" },
                validUntil: { type: "string" },
                isActive: { type: "boolean" },
                createdAt: { type: "string" }
              },
              required: [
                "id", "code", "discountType", "discountValue", "minOrderValue",
                "maxDiscount", "usageLimit", "usageCount", "validFrom", "validUntil",
                "isActive", "createdAt"
              ]
            }
          },
          required: ["success", "data"]
        },
        400: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        },
        409: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" }
              },
              required: ["code", "message"]
            }
          },
          required: ["success", "error"]
        }
      }
    },
    // FIX: requireAdmin added — previously unprotected
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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

    if (!body.code || !body.discountType || body.discountValue === undefined || !body.validFrom || !body.validUntil) {
      return sendError(reply, 400, "VALIDATION_ERROR", "code, discountType, discountValue, validFrom, and validUntil are required.");
    }
    if (!["percentage", "fixed"].includes(body.discountType)) {
      return sendError(reply, 400, "VALIDATION_ERROR", "discountType must be 'percentage' or 'fixed'.");
    }
    if (body.discountValue <= 0) {
      return sendError(reply, 400, "VALIDATION_ERROR", "discountValue must be greater than 0.");
    }
    if (body.discountType === "percentage" && body.discountValue > 100) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Percentage discount cannot exceed 100.");
    }

    const validFrom = new Date(body.validFrom);
    const validUntil = new Date(body.validUntil);
    if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) {
      return sendError(reply, 400, "VALIDATION_ERROR", "validFrom and validUntil must be valid dates.");
    }
    if (validUntil <= validFrom) {
      return sendError(reply, 400, "VALIDATION_ERROR", "validUntil must be after validFrom.");
    }

    const existing = await prisma.voucher.findUnique({ where: { code: body.code } });
    if (existing) {
      return sendError(reply, 409, "DUPLICATE_CODE", "A voucher with this code already exists.");
    }

    const voucher = await prisma.voucher.create({
      data: {
        code: body.code,
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderValue: body.minOrderValue ?? null,
        maxDiscount: body.maxDiscount ?? null,
        usageLimit: body.usageLimit ?? null,
        validFrom,
        validUntil,
        createdBy: "admin",
      },
    });

    return sendSuccess(reply, 201, {
      id: voucher.id,
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      minOrderValue: voucher.minOrderValue ? Number(voucher.minOrderValue) : null,
      maxDiscount: voucher.maxDiscount ? Number(voucher.maxDiscount) : null,
      usageLimit: voucher.usageLimit,
      usageCount: voucher.usageCount,
      validFrom: voucher.validFrom.toISOString(),
      validUntil: voucher.validUntil.toISOString(),
      isActive: voucher.isActive,
      createdAt: voucher.createdAt.toISOString(),
    });
  });

  // ── GET /admin/vouchers — list all vouchers ───────────────────────────
  app.get("/admin/vouchers", {
    schema: {
      tags: ["Admin Vouchers"],
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
                      id: { type: "string" },
                      code: { type: "string" },
                      discountType: { type: "string", enum: ["percentage", "fixed"] },
                      discountValue: { type: "number" },
                      minOrderValue: { type: "number", nullable: true },
                      maxDiscount: { type: "number", nullable: true },
                      usageLimit: { type: "integer", nullable: true },
                      usageCount: { type: "integer" },
                      redemptionCount: { type: "integer" },
                      validFrom: { type: "string" },
                      validUntil: { type: "string" },
                      isActive: { type: "boolean" },
                      createdBy: { type: "string" },
                      createdAt: { type: "string" }
                    },
                    required: [
                      "id", "code", "discountType", "discountValue", "minOrderValue",
                      "maxDiscount", "usageLimit", "usageCount", "redemptionCount",
                      "validFrom", "validUntil", "isActive", "createdBy", "createdAt"
                    ]
                  }
                }
              },
              required: ["vouchers"]
            }
          },
          required: ["success", "data"]
        }
      }
    },
    // FIX: requireAdmin added — previously unprotected
    preHandler: [requireAdmin]
  }, async (_req: FastifyRequest, reply: FastifyReply) => {
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