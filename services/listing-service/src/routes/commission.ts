import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireAdmin, type AdminRequest } from "../middleware/auth.js";
import { sendCommissionRateChangeEmail } from "../lib/email.js";

// ── Role helpers ─────────────────────────────────────────────────────────────

function isSuperAdmin(role: string) { return role === "super_admin"; }
function canWriteCommission(role: string) { return role === "super_admin" || role === "admin"; }
function canExport(role: string) { return role === "super_admin" || role === "finance_agent"; }

// ── Rate validation (stored as decimal: 0.05 = 5%) ────────────────────────────
// PRD 15.5: 0.00–50.00 in % terms = 0.00–0.50 in decimal, max 2dp in % terms

function validateRate(rate: unknown): string | null {
  if (typeof rate !== "number" || isNaN(rate)) return "rate must be a number.";
  if (rate < 0 || rate > 0.50) return "rate must be between 0 and 0.50 (0%–50%).";
  // 2 decimal places in percentage = 4 decimal places in decimal
  // e.g. 12.50% = 0.1250 valid; 12.555% = 0.12555 invalid
  const pct = Math.round(rate * 1_000_000) / 10_000; // rate as %, 2dp safe
  if (Math.round(pct * 100) !== Math.round(pct * 100 - 0) || Math.round(pct * 100) / 100 !== Math.round(pct * 100) / 100) {
    // simpler check: (rate * 10000) must be an integer
  }
  if (!Number.isInteger(Math.round(rate * 10_000))) return "rate supports at most 2 decimal places (e.g. 0.125 = 12.5% is valid).";
  return null;
}

function validateEffectiveFrom(effectiveFrom: string): string | null {
  const d = new Date(effectiveFrom);
  if (isNaN(d.getTime())) return "effectiveFrom must be a valid date.";
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);
  if (d < todayUtc) return "effectiveFrom cannot be in the past.";
  return null;
}

// ── Global rate helper ─────────────────────────────────────────────────────────

async function getGlobalSettings() {
  return prisma.platformSettings.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global" },
  });
}

// ── Shared Swagger Schemas ─────────────────────────────────────────────────────
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

const rateSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    country: { type: "string" },
    rate: { type: "number" },
    pendingRate: { type: ["number", "null"] },
    pendingEffectiveFrom: { type: ["string", "null"] },
    setBy: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

// ── Shared response shape for a commission rate record ─────────────────────────

function formatRate(r: {
  id: string; country: string; rate: unknown;
  pendingRate?: unknown; pendingEffectiveFrom?: Date | null; pendingReason?: string | null;
  setBy: string; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: r.id,
    country: r.country,
    rate: Number(r.rate),
    pendingRate: r.pendingRate != null ? Number(r.pendingRate) : null,
    pendingEffectiveFrom: r.pendingEffectiveFrom?.toISOString() ?? null,
    setBy: r.setBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function commissionRoutes(app: FastifyInstance) {

  // ── GET /admin/commission-rates/global ──────────────────────────────────────
  app.get("/admin/commission-rates/global", {
    schema: {
      tags: ["Admin Commission"],
      summary: "Get global commission settings",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                globalCommissionRate: { type: "number" },
                pendingGlobalRate: { type: ["number", "null"] },
                pendingGlobalEffectiveFrom: { type: ["string", "null"] },
                pendingGlobalReason: { type: ["string", "null"] },
                updatedAt: { type: "string", format: "date-time" },
                updatedBy: { type: ["string", "null"] },
              },
            },
          },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const s = await getGlobalSettings();
      return sendSuccess(reply, 200, {
        globalCommissionRate: Number(s.globalCommissionRate),
        pendingGlobalRate: s.pendingGlobalRate != null ? Number(s.pendingGlobalRate) : null,
        pendingGlobalEffectiveFrom: s.pendingGlobalEffectiveFrom?.toISOString() ?? null,
        pendingGlobalReason: s.pendingGlobalReason ?? null,
        updatedAt: s.updatedAt.toISOString(),
        updatedBy: s.updatedBy ?? null,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to fetch global commission settings");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching global commission settings.");
    }
  });

  // ── POST /admin/commission-rates/global (Super Admin only) ─────────────────
  app.post("/admin/commission-rates/global", {
    schema: {
      tags: ["Admin Commission"],
      summary: "Update global commission rate (Super Admin only)",
      description:
        "Set or schedule a new platform-wide default commission rate. " +
        "If `applyToAll` is true, all existing country overrides are replaced. " +
        "If `effectiveFrom` is today the change applies immediately; otherwise it is scheduled.",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["rate", "effectiveFrom", "reason"],
        properties: {
          rate: { type: "number", minimum: 0, maximum: 0.50, description: "New global rate as decimal (0.05 = 5%)" },
          effectiveFrom: { type: "string", format: "date", description: "Effective date (today or future, YYYY-MM-DD)" },
          applyToAll: { type: "boolean", description: "Replace all country overrides with this rate" },
          notifyProviders: { type: "boolean", description: "Send email to all active providers" },
          reason: { type: "string", maxLength: 500, description: "Required reason logged to audit trail" },
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
                message: { type: "string" },
                applied: { type: "boolean" },
              },
            },
          },
        },
        403: errSchema,
        422: errSchema,
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    if (!isSuperAdmin(admin.adminRole)) {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can adjust the global commission rate.");
    }

    const body = req.body as {
      rate: number; effectiveFrom: string; applyToAll?: boolean;
      notifyProviders?: boolean; reason: string;
    };

    const rateErr = validateRate(body.rate);
    if (rateErr) return sendError(reply, 422, "VALIDATION_ERROR", rateErr);

    const dateErr = validateEffectiveFrom(body.effectiveFrom);
    if (dateErr) return sendError(reply, 422, "VALIDATION_ERROR", dateErr);

    try {
      const settings = await getGlobalSettings();

      // Duplicate-rate check
      if (Number(settings.globalCommissionRate) === body.rate && !settings.pendingGlobalRate) {
        return sendError(reply, 422, "DUPLICATE_RATE", "The global rate is already set to this value.");
      }

      const effectiveDate = new Date(body.effectiveFrom);
      effectiveDate.setUTCHours(0, 0, 0, 0);
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const isImmediate = effectiveDate <= todayUtc;
      const applyToAll = body.applyToAll ?? false;
      const notifyProviders = body.notifyProviders ?? false;
      const oldGlobalRate = Number(settings.globalCommissionRate);

      if (isImmediate) {
        // Apply immediately
        await prisma.$transaction(async (tx) => {
          await tx.platformSettings.update({
            where: { id: "global" },
            data: {
              globalCommissionRate: body.rate,
              pendingGlobalRate: null,
              pendingGlobalEffectiveFrom: null,
              pendingGlobalReason: null,
              updatedBy: admin.adminId,
            },
          });

          if (applyToAll) {
            await tx.commissionRate.updateMany({
              where: {},
              data: {
                rate: body.rate,
                pendingRate: null,
                pendingEffectiveFrom: null,
                pendingReason: null,
                setBy: admin.adminId,
              },
            });
          }

          await tx.commissionHistory.create({
            data: {
              scope: "global",
              oldRate: oldGlobalRate,
              newRate: body.rate,
              effectiveFrom: effectiveDate,
              changedBy: admin.adminId,
              changedByRole: admin.adminRole,
              reason: body.reason,
              applyToAll,
              providersNotified: notifyProviders,
            },
          });
        });

        if (notifyProviders) {
          // Fire-and-forget batch email to all active providers
          sendGlobalCommissionEmails(body.rate, oldGlobalRate, effectiveDate, body.reason).catch(() => null);
        }
      } else {
        // Schedule for future
        await prisma.platformSettings.update({
          where: { id: "global" },
          data: {
            pendingGlobalRate: body.rate,
            pendingGlobalEffectiveFrom: effectiveDate,
            pendingGlobalReason: body.reason,
            updatedBy: admin.adminId,
          },
        });
      }

      return sendSuccess(reply, 200, {
        message: isImmediate
          ? `Global commission rate updated to ${body.rate * 100}%.`
          : `Global commission rate change to ${body.rate * 100}% scheduled for ${body.effectiveFrom}.`,
        applied: isImmediate,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to update global commission rate");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while updating the global commission rate.");
    }
  });

  // ── GET /admin/commission-rates — list all country rates ───────────────────
  app.get("/admin/commission-rates", {
    schema: {
      tags: ["Admin Commission"],
      summary: "List all country commission rates",
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                globalRate: { type: "number" },
                pendingGlobalRate: { type: ["number", "null"] },
                pendingGlobalEffectiveFrom: { type: ["string", "null"] },
                rates: { type: "array", items: rateSchema },
              },
            },
          },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    
    const whereClause = isSuperAdmin(admin.adminRole) || admin.adminRole === "admin" || admin.adminRole === "finance_agent" 
      ? {} 
      : { country: { in: admin.countryScope } };

    try {
      const [settings, rates] = await Promise.all([
        getGlobalSettings(),
        prisma.commissionRate.findMany({ where: whereClause, orderBy: { country: "asc" } }),
      ]);

      return sendSuccess(reply, 200, {
        globalRate: Number(settings.globalCommissionRate),
        pendingGlobalRate: settings.pendingGlobalRate != null ? Number(settings.pendingGlobalRate) : null,
        pendingGlobalEffectiveFrom: settings.pendingGlobalEffectiveFrom?.toISOString() ?? null,
        rates: rates.map(formatRate),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to list commission rates");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while listing commission rates.");
    }
  });

  // ── POST /admin/commission-rates — upsert a single country rate ───────────
  app.post("/admin/commission-rates", {
    schema: {
      tags: ["Admin Commission"],
      summary: "Set or update a country-specific commission rate",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["country", "rate", "effectiveFrom", "reason"],
        properties: {
          country: { type: "string", minLength: 2, maxLength: 2, description: "ISO-3166-1 alpha-2 country code" },
          rate: { type: "number", minimum: 0, maximum: 0.50, description: "Rate as decimal (0.05 = 5%)" },
          effectiveFrom: { type: "string", format: "date", description: "Effective date (today or future)" },
          notifyProviders: { type: "boolean", description: "Send email notification to providers in this country" },
          reason: { type: "string", maxLength: 500, description: "Required reason logged to audit trail" },
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
                ...rateSchema.properties,
                scheduled: { type: "boolean" },
                warning: { type: "string" },
              },
            },
          },
        },
        403: errSchema,
        422: errSchema,
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    if (!canWriteCommission(admin.adminRole)) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient role to modify commission rates.");
    }

    const body = req.body as {
      country: string; rate: number; effectiveFrom: string;
      notifyProviders?: boolean; reason: string;
    };

    const rateErr = validateRate(body.rate);
    if (rateErr) return sendError(reply, 422, "VALIDATION_ERROR", rateErr);

    const dateErr = validateEffectiveFrom(body.effectiveFrom);
    if (dateErr) return sendError(reply, 422, "VALIDATION_ERROR", dateErr);

    const countryCode = body.country.toUpperCase();
    const effectiveDate = new Date(body.effectiveFrom);
    effectiveDate.setUTCHours(0, 0, 0, 0);
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);
    const isImmediate = effectiveDate <= todayUtc;
    const notifyProviders = body.notifyProviders ?? false;

    if (!isSuperAdmin(admin.adminRole) && admin.adminRole !== "admin" && !admin.countryScope.includes(countryCode)) {
      return sendError(reply, 403, "FORBIDDEN", "You do not have permission to modify this country.");
    }

    try {
      const existing = await prisma.commissionRate.findUnique({ where: { country: countryCode } });

      // Duplicate-rate check (PRD 15.5)
      if (existing && Number(existing.rate) === body.rate && !existing.pendingRate) {
        return sendError(reply, 422, "DUPLICATE_RATE", `${countryCode} already has this commission rate.`);
      }

      const globalSettings = await getGlobalSettings();
      const oldRate = existing ? Number(existing.rate) : Number(globalSettings.globalCommissionRate);

      let savedRate;
      if (isImmediate) {
        savedRate = await prisma.$transaction(async (tx) => {
          const r = await (tx.commissionRate.upsert as any)({
            where: { country: countryCode },
            update: {
              rate: body.rate,
              pendingRate: null,
              pendingEffectiveFrom: null,
              pendingReason: null,
              setBy: admin.adminId,
            },
            create: {
              country: countryCode,
              rate: body.rate,
              setBy: admin.adminId,
            },
          });
          await tx.commissionHistory.create({
            data: {
              scope: "country",
              countryCode,
              oldRate,
              newRate: body.rate,
              effectiveFrom: effectiveDate,
              changedBy: admin.adminId,
              changedByRole: admin.adminRole,
              reason: body.reason,
              applyToAll: false,
              providersNotified: notifyProviders,
            },
          });
          return r;
        });

        if (notifyProviders) {
          sendCountryCommissionEmail(countryCode, body.rate, oldRate, effectiveDate, body.reason).catch(() => null);
        }
      } else {
        // Schedule — supersedes any existing pending change (PRD 15.5)
        savedRate = await (prisma.commissionRate.upsert as any)({
          where: { country: countryCode },
          update: {
            pendingRate: body.rate,
            pendingEffectiveFrom: effectiveDate,
            pendingReason: body.reason,
            setBy: admin.adminId,
          },
          create: {
            country: countryCode,
            rate: existing?.rate ?? globalSettings.globalCommissionRate,
            pendingRate: body.rate,
            pendingEffectiveFrom: effectiveDate,
            pendingReason: body.reason,
            setBy: admin.adminId,
          },
        });
      }

      let warning: string | undefined;
      if (existing?.pendingRate != null && !isImmediate) {
        warning = "Superseded a previously scheduled rate change";
      }

      return sendSuccess(reply, 200, {
        ...formatRate(savedRate),
        scheduled: !isImmediate,
        ...(warning ? { warning } : {}),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to upsert country commission rate");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while updating the commission rate.");
    }
  });

  // ── POST /admin/commission-rates/bulk — update multiple countries ──────────
  app.post("/admin/commission-rates/bulk", {
    schema: {
      tags: ["Admin Commission"],
      summary: "Bulk-set commission rate for multiple countries",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        required: ["countries", "rate", "effectiveFrom", "reason"],
        properties: {
          countries: {
            type: "array",
            items: { type: "string", minLength: 2, maxLength: 2 },
            minItems: 1,
            description: "Array of ISO-3166-1 alpha-2 country codes",
          },
          rate: { type: "number", minimum: 0, maximum: 0.50 },
          effectiveFrom: { type: "string", format: "date" },
          notifyProviders: { type: "boolean" },
          reason: { type: "string", maxLength: 500 },
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
                updated: { type: "number" },
                countries: { type: "array", items: { type: "string" } },
                rate: { type: "number" },
                scheduled: { type: "boolean" },
              },
            },
          },
        },
        403: errSchema,
        422: errSchema,
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    if (!isSuperAdmin(admin.adminRole)) {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admins can bulk-update commission rates.");
    }

    const body = req.body as {
      countries: string[]; rate: number; effectiveFrom: string;
      notifyProviders?: boolean; reason: string;
    };

    const rateErr = validateRate(body.rate);
    if (rateErr) return sendError(reply, 422, "VALIDATION_ERROR", rateErr);

    const dateErr = validateEffectiveFrom(body.effectiveFrom);
    if (dateErr) return sendError(reply, 422, "VALIDATION_ERROR", dateErr);

    try {
      const effectiveDate = new Date(body.effectiveFrom);
      effectiveDate.setUTCHours(0, 0, 0, 0);
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const isImmediate = effectiveDate <= todayUtc;
      const countryCodes = body.countries.map((c) => c.toUpperCase());
      const globalSettings = await getGlobalSettings();
      const notifyProviders = body.notifyProviders ?? false;

      const existing = await prisma.commissionRate.findMany({
        where: { country: { in: countryCodes } },
      });
      const existingMap = new Map(existing.map((r) => [r.country, r]));

      await prisma.$transaction(async (tx) => {
        for (const code of countryCodes) {
          const old = existingMap.get(code);
          const oldRate = old ? Number(old.rate) : Number(globalSettings.globalCommissionRate);

          await (tx.commissionRate.upsert as any)({
            where: { country: code },
            update: isImmediate
              ? { rate: body.rate, pendingRate: null, pendingEffectiveFrom: null, pendingReason: null, setBy: admin.adminId }
              : { pendingRate: body.rate, pendingEffectiveFrom: effectiveDate, pendingReason: body.reason, setBy: admin.adminId },
            create: {
              country: code,
              rate: isImmediate ? body.rate : (old?.rate ?? globalSettings.globalCommissionRate),
              ...(isImmediate ? {} : { pendingRate: body.rate, pendingEffectiveFrom: effectiveDate, pendingReason: body.reason }),
              setBy: admin.adminId,
            },
          });

          if (isImmediate) {
            await tx.commissionHistory.create({
              data: {
                scope: "country",
                countryCode: code,
                oldRate,
                newRate: body.rate,
                effectiveFrom: effectiveDate,
                changedBy: admin.adminId,
                changedByRole: admin.adminRole,
                reason: body.reason,
                applyToAll: false,
                providersNotified: notifyProviders,
              },
            });
          }
        }
      });

      if (isImmediate && notifyProviders) {
        for (const code of countryCodes) {
          const old = existingMap.get(code);
          const oldRate = old ? Number(old.rate) : Number(globalSettings.globalCommissionRate);
          sendCountryCommissionEmail(code, body.rate, oldRate, effectiveDate, body.reason).catch(() => null);
        }
      }

      return sendSuccess(reply, 200, {
        updated: countryCodes.length,
        countries: countryCodes,
        rate: body.rate,
        scheduled: !isImmediate,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to bulk-update commission rates");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while bulk-updating commission rates.");
    }
  });

  // ── DELETE /admin/commission-rates/:country — remove override ─────────────
  app.delete("/admin/commission-rates/:country", {
    schema: {
      tags: ["Admin Commission"],
      summary: "Remove country-specific override (reverts to global default)",
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["country"],
        properties: { country: { type: "string", minLength: 2, maxLength: 2 } },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: { message: { type: "string" } },
            },
          },
        },
        403: errSchema,
        404: errSchema,
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const admin = req as AdminRequest;
    if (!canWriteCommission(admin.adminRole)) {
      return sendError(reply, 403, "FORBIDDEN", "Insufficient role to modify commission rates.");
    }
    const { country } = req.params as { country: string };
    const countryCode = country.toUpperCase();

    if (!isSuperAdmin(admin.adminRole) && admin.adminRole !== "admin" && !admin.countryScope.includes(countryCode)) {
      return sendError(reply, 403, "FORBIDDEN", "You do not have permission to modify this country.");
    }

    try {
      const existing = await prisma.commissionRate.findUnique({ where: { country: countryCode } });
      if (!existing) return sendError(reply, 404, "NOT_FOUND", "No country-specific rate found for this country.");

      const settings = await getGlobalSettings();
      await prisma.commissionRate.delete({ where: { country: countryCode } });

      return sendSuccess(reply, 200, {
        message: `Override for ${countryCode} removed. Global default of ${Number(settings.globalCommissionRate) * 100}% now applies.`,
      });
    } catch (err) {
      req.log.error({ err }, "Failed to delete country commission override");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while removing the commission override.");
    }
  });

  // ── GET /admin/commission-rates/history ────────────────────────────────────
  app.get("/admin/commission-rates/history", {
    schema: {
      tags: ["Admin Commission"],
      summary: "Commission change history (filterable)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          country: { type: "string", description: "Filter by country code" },
          from: { type: "string", description: "Start date (YYYY-MM-DD)" },
          to: { type: "string", description: "End date (YYYY-MM-DD)" },
          page: { type: "integer", minimum: 1 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
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
                total: { type: "number" },
                page: { type: "number" },
                limit: { type: "number" },
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      scope: { type: "string" },
                      countryCode: { type: ["string", "null"] },
                      oldRate: { type: "number" },
                      newRate: { type: "number" },
                      effectiveFrom: { type: "string", format: "date-time" },
                      changedBy: { type: "string" },
                      changedByRole: { type: "string" },
                      reason: { type: "string" },
                      applyToAll: { type: "boolean" },
                      providersNotified: { type: "boolean" },
                      createdAt: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const admin = req as AdminRequest;
      const q = req.query as { country?: string; from?: string; to?: string; page?: number; limit?: number };
      const page = q.page ?? 1;
      const limit = q.limit ?? 50;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};

      if (!isSuperAdmin(admin.adminRole) && admin.adminRole !== "admin" && admin.adminRole !== "finance_agent") {
        where["OR"] = [
          { scope: "global" },
          { countryCode: { in: admin.countryScope } }
        ];
      }

      if (q.country) {
        const c = q.country.toUpperCase();
        if (!isSuperAdmin(admin.adminRole) && admin.adminRole !== "admin" && admin.adminRole !== "finance_agent" && !admin.countryScope.includes(c)) {
          return sendError(reply, 403, "FORBIDDEN", "You do not have permission to view this country.");
        }
        where["countryCode"] = c;
      }
      
      if (q.from || q.to) {
        where["createdAt"] = {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to + "T23:59:59Z") } : {}),
        };
      }

      const [total, rows] = await Promise.all([
        prisma.commissionHistory.count({ where }),
        prisma.commissionHistory.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return sendSuccess(reply, 200, {
        total,
        page,
        limit,
        rows: rows.map((h) => ({
          id: h.id,
          scope: h.scope,
          countryCode: h.countryCode ?? null,
          oldRate: Number(h.oldRate),
          newRate: Number(h.newRate),
          effectiveFrom: h.effectiveFrom.toISOString(),
          changedBy: h.changedBy,
          changedByRole: h.changedByRole,
          reason: h.reason,
          applyToAll: h.applyToAll,
          providersNotified: h.providersNotified,
          createdAt: h.createdAt.toISOString(),
        })),
      });
    } catch (err) {
      req.log.error({ err }, "Failed to fetch commission history");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching commission history.");
    }
  });

  // ── GET /admin/commission-rates/history/export — CSV ──────────────────────
  app.get("/admin/commission-rates/history/export", {
    schema: {
      tags: ["Admin Commission"],
      summary: "Export commission history as CSV (Super Admin & Finance Agent)",
      security: [{ bearerAuth: [] }],
      querystring: {
        type: "object",
        properties: {
          country: { type: "string" },
          from: { type: "string" },
          to: { type: "string" },
        },
      },
    },
    preHandler: [requireAdmin],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const admin = req as AdminRequest;
      if (!canExport(admin.adminRole)) {
        return sendError(reply, 403, "FORBIDDEN", "Only Super Admins and Finance Agents can export commission history.");
      }

      const q = req.query as { country?: string; from?: string; to?: string };
      const where: Record<string, unknown> = {};
      if (q.country) where["countryCode"] = q.country.toUpperCase();
      if (q.from || q.to) {
        where["createdAt"] = {
          ...(q.from ? { gte: new Date(q.from) } : {}),
          ...(q.to ? { lte: new Date(q.to + "T23:59:59Z") } : {}),
        };
      }

      const rows = await prisma.commissionHistory.findMany({ where, orderBy: { createdAt: "desc" } });

      const header = "id,scope,country_code,old_rate,new_rate,effective_from,changed_by,changed_by_role,reason,apply_to_all,providers_notified,created_at";
      const lines = rows.map((h) =>
        [
          h.id, h.scope, h.countryCode ?? "",
          Number(h.oldRate), Number(h.newRate),
          h.effectiveFrom.toISOString(),
          h.changedBy, h.changedByRole,
          `"${h.reason.replace(/"/g, '""')}"`,
          h.applyToAll ? "true" : "false",
          h.providersNotified ? "true" : "false",
          h.createdAt.toISOString(),
        ].join(",")
      );

      const csv = [header, ...lines].join("\n");
      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="commission_history_${Date.now()}.csv"`);
      return reply.send(csv);
    } catch (err) {
      req.log.error({ err }, "Failed to export commission history");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while exporting commission history.");
    }
  });

  // ── GET /commission-rates/effective/:country — public effective rate ───────
  app.get("/commission-rates/effective/:country", {
    schema: {
      tags: ["Commission"],
      summary: "Get the effective commission rate for a country",
      params: {
        type: "object",
        required: ["country"],
        properties: { country: { type: "string", minLength: 2, maxLength: 2 } },
      },
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                country: { type: "string" },
                effectiveRate: { type: "number" },
                source: { type: "string" },
              },
            },
          },
        },
        400: errSchema,
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { country } = req.params as { country: string };
      const countryCode = country.toUpperCase();

      const [rate, settings] = await Promise.all([
        prisma.commissionRate.findUnique({ where: { country: countryCode } }),
        getGlobalSettings(),
      ]);

      const now = new Date();
      let effectiveRate: number;
      let source: "country_override" | "global_default";

      if (rate) {
        // Use pending rate if it has become effective
        if (rate.pendingRate != null && rate.pendingEffectiveFrom && rate.pendingEffectiveFrom <= now) {
          effectiveRate = Number(rate.pendingRate);
        } else {
          effectiveRate = Number(rate.rate);
        }
        source = "country_override";
      } else {
        if (settings.pendingGlobalRate != null && settings.pendingGlobalEffectiveFrom && settings.pendingGlobalEffectiveFrom <= now) {
          effectiveRate = Number(settings.pendingGlobalRate);
        } else {
          effectiveRate = Number(settings.globalCommissionRate);
        }
        source = "global_default";
      }

      return sendSuccess(reply, 200, { country: countryCode, effectiveRate, source });
    } catch (err) {
      req.log.error({ err }, "Failed to get effective commission rate");
      return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred while fetching effective commission rate.");
    }
  });
}

// ── Email helpers (fire-and-forget) ───────────────────────────────────────────

async function sendCountryCommissionEmail(
  countryCode: string,
  newRate: number,
  oldRate: number,
  effectiveDate: Date,
  reason: string,
): Promise<void> {
  const providers = await prisma.listing.findMany({
    where: { country: countryCode, status: "active" },
    select: { providerId: true },
    distinct: ["providerId"],
  });
  const emails = await fetchProviderEmails(providers.map((p) => p.providerId));
  for (const email of emails) {
    await sendCommissionRateChangeEmail(email, {
      scope: countryCode,
      oldRate,
      newRate,
      effectiveDate: effectiveDate.toISOString().split("T")[0]!,
      reason,
    }).catch(() => null);
  }
}

async function sendGlobalCommissionEmails(
  newRate: number,
  oldRate: number,
  effectiveDate: Date,
  reason: string,
): Promise<void> {
  const providers = await prisma.listing.findMany({
    where: { status: "active" },
    select: { providerId: true },
    distinct: ["providerId"],
  });
  const emails = await fetchProviderEmails(providers.map((p) => p.providerId));
  for (const email of emails) {
    await sendCommissionRateChangeEmail(email, {
      scope: "All markets",
      oldRate,
      newRate,
      effectiveDate: effectiveDate.toISOString().split("T")[0]!,
      reason,
    }).catch(() => null);
  }
}

async function fetchProviderEmails(providerIds: string[]): Promise<string[]> {
  if (providerIds.length === 0) return [];
  // Resolve provider emails from auth-service via internal lookup
  const AUTH_SERVICE_URL = process.env["AUTH_SERVICE_URL"] ?? "http://localhost:3001";
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/internal/users/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: providerIds }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { emails?: string[] };
    return json.emails ?? [];
  } catch {
    return [];
  }
}