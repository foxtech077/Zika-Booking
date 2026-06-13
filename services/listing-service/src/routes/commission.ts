import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireAdmin, type AdminRequest } from "../middleware/auth.js";
import { getEffectiveCommissionRate } from "../services/commission.service.js";

// Custom CSV converter to avoid dependency issues
function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ("" + (val ?? "")).replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

const DEFAULT_GLOBAL_RATE = 5.00;

interface GlobalAdjustmentBody {
  rate: number;
  effectiveFrom: string;
  applyToAllCountries: boolean;
  reason: string;
  notifyProviders: boolean;
}

interface CountryOverrideBody {
  country: string;
  rate: number;
  effectiveFrom?: string;
  reason: string;
  notifyProviders: boolean;
}

interface BulkOverrideBody {
  countries: string[];
  rate: number;
  effectiveFrom?: string;
  reason: string;
  notifyProviders: boolean;
}

function validateRate(rate: number): string | null {
  if (typeof rate !== "number" || isNaN(rate)) {
    return "Rate must be a valid number.";
  }
  if (rate < 0.00 || rate > 50.00) {
    return "Commission rate must be between 0.00 and 50.00%.";
  }
  const rateStr = rate.toString();
  if (rateStr.includes(".")) {
    const decimalPlaces = rateStr.split(".")[1]?.length ?? 0;
    if (decimalPlaces > 2) {
      return "Rate cannot have more than 2 decimal places.";
    }
  }
  return null;
}

function validateEffectiveDate(dateStr: string): string | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return "Invalid effective date.";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date < today) {
    return "Effective date cannot be in the past.";
  }
  return null;
}

export async function commissionRoutes(app: FastifyInstance) {
  // ── GET /admin/commission-rates — list overall configurations ─────
  app.get("/admin/commission-rates", {
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminReq = req as AdminRequest;
    const role = adminReq.adminRole;

    const settings = await prisma.platformSettings.findFirst();
    const globalRate = settings ? Number(settings.globalCommissionRate) : DEFAULT_GLOBAL_RATE;

    let overrides = await prisma.countryCommission.findMany({
      orderBy: { country: "asc" },
    });

    if (role === "country_manager" || role === "sales_agent" || role === "support_agent") {
      overrides = overrides.filter(o => adminReq.countryScope.includes(o.country.toUpperCase()));
    }

    return sendSuccess(reply, 200, {
      globalCommissionRate: globalRate,
      countryOverrides: overrides.map((o) => ({
        id: o.id,
        country: o.country,
        currentRate: Number(o.currentRate),
        pendingRate: o.pendingRate ? Number(o.pendingRate) : null,
        effectiveFrom: o.effectiveFrom ? o.effectiveFrom.toISOString() : null,
        lastReason: o.lastReason,
        setBy: o.setBy,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    });
  });

  // ── POST /admin/commission/global — Super Admin only ─────────────
  app.post("/admin/commission/global", {
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminReq = req as AdminRequest;
    if (adminReq.adminRole !== "super_admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admin accounts can adjust the global default rate.");
    }

    const { rate, effectiveFrom, applyToAllCountries, reason, notifyProviders } = req.body as GlobalAdjustmentBody;

    if (!reason || reason.trim().length === 0) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Reason is required.");
    }
    if (reason.length > 500) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Reason cannot exceed 500 characters.");
    }

    const rateError = validateRate(rate);
    if (rateError) return sendError(reply, 400, "VALIDATION_ERROR", rateError);

    const dateError = validateEffectiveDate(effectiveFrom);
    if (dateError) return sendError(reply, 400, "VALIDATION_ERROR", dateError);

    const oldSettings = await prisma.platformSettings.findFirst();
    const oldRate = oldSettings ? Number(oldSettings.globalCommissionRate) : DEFAULT_GLOBAL_RATE;

    if (rate === oldRate) {
      return sendError(reply, 400, "DUPLICATE_RATE", "This country already has this commission rate");
    }

    const effectiveTime = new Date(effectiveFrom);
    
    const newSettings = await prisma.platformSettings.upsert({
      where: { id: 1 },
      update: {
        globalCommissionRate: rate,
        updatedBy: adminReq.adminId,
      },
      create: {
        id: 1,
        globalCommissionRate: rate,
        updatedBy: adminReq.adminId,
      }
    });

    if (applyToAllCountries) {
      await prisma.countryCommission.deleteMany({});
    }

    await prisma.commissionHistory.create({
      data: {
        scope: "global",
        oldRate,
        newRate: rate,
        effectiveFrom: effectiveTime,
        changedBy: adminReq.adminId,
        changedByRole: adminReq.adminRole,
        reason,
        applyToAll: applyToAllCountries,
        providersNotified: notifyProviders,
      }
    });

    return sendSuccess(reply, 200, {
      globalCommissionRate: Number(newSettings.globalCommissionRate),
      updatedAt: newSettings.updatedAt.toISOString(),
    });
  });

  // ── POST /admin/commission-rates — country overrides ─────────────
  app.post("/admin/commission-rates", {
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminReq = req as AdminRequest;
    const role = adminReq.adminRole;

    if (role !== "super_admin" && role !== "admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admin and Admin can adjust commission rates.");
    }

    const { country, rate, effectiveFrom, reason, notifyProviders } = req.body as CountryOverrideBody;
    const countryCode = country.toUpperCase();

    if (role === "admin" && adminReq.countryScope.length > 0 && !adminReq.countryScope.includes(countryCode)) {
      return sendError(reply, 403, "FORBIDDEN", "You do not have access to manage overrides for this country.");
    }

    if (!reason || reason.trim().length === 0) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Reason is required.");
    }

    const rateError = validateRate(rate);
    if (rateError) return sendError(reply, 400, "VALIDATION_ERROR", rateError);

    const effectiveTime = effectiveFrom ? new Date(effectiveFrom) : new Date();
    const isFuture = effectiveTime.getTime() > Date.now();

    const existing = await prisma.countryCommission.findUnique({
      where: { country: countryCode }
    });

    const currentRate = existing ? Number(existing.currentRate) : null;

    if (rate === currentRate) {
      return sendError(reply, 400, "DUPLICATE_RATE", "This country already has this commission rate");
    }

    let warning: string | null = null;
    if (existing?.pendingRate && existing.effectiveFrom) {
      warning = `Warning: Scheduled commission change of ${Number(existing.pendingRate)}% effective on ${existing.effectiveFrom.toISOString()} was overwritten.`;
    }

    let record;
    if (isFuture) {
      record = await prisma.countryCommission.upsert({
        where: { country: countryCode },
        update: {
          pendingRate: rate,
          effectiveFrom: effectiveTime,
          lastReason: reason,
          setBy: adminReq.adminId,
        },
        create: {
          country: countryCode,
          currentRate: currentRate || DEFAULT_GLOBAL_RATE,
          pendingRate: rate,
          effectiveFrom: effectiveTime,
          lastReason: reason,
          setBy: adminReq.adminId,
        }
      });
    } else {
      record = await prisma.countryCommission.upsert({
        where: { country: countryCode },
        update: {
          currentRate: rate,
          pendingRate: null,
          effectiveFrom: null,
          lastReason: reason,
          setBy: adminReq.adminId,
        },
        create: {
          country: countryCode,
          currentRate: rate,
          setBy: adminReq.adminId,
          lastReason: reason,
        }
      });

      await prisma.commissionHistory.create({
        data: {
          scope: "country",
          countryCode,
          oldRate: currentRate,
          newRate: rate,
          effectiveFrom: effectiveTime,
          changedBy: adminReq.adminId,
          changedByRole: adminReq.adminRole,
          reason,
          applyToAll: false,
          providersNotified: notifyProviders,
        }
      });
    }

    return sendSuccess(reply, 200, {
      id: record.id,
      country: record.country,
      currentRate: Number(record.currentRate),
      pendingRate: record.pendingRate ? Number(record.pendingRate) : null,
      effectiveFrom: record.effectiveFrom ? record.effectiveFrom.toISOString() : null,
      lastReason: record.lastReason,
      setBy: record.setBy,
      warning,
    });
  });

  // ── POST /admin/commission-rates/bulk — Bulk update ─────────────
  app.post("/admin/commission-rates/bulk", {
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminReq = req as AdminRequest;
    const role = adminReq.adminRole;

    if (role !== "super_admin" && role !== "admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admin and Admin can bulk adjust commission rates.");
    }

    const { countries, rate, effectiveFrom, reason, notifyProviders } = req.body as BulkOverrideBody;

    if (!countries || !Array.isArray(countries) || countries.length === 0) {
      return sendError(reply, 400, "VALIDATION_ERROR", "countries must be a non-empty array.");
    }

    if (!reason || reason.trim().length === 0) {
      return sendError(reply, 400, "VALIDATION_ERROR", "Reason is required.");
    }

    const rateError = validateRate(rate);
    if (rateError) return sendError(reply, 400, "VALIDATION_ERROR", rateError);

    const effectiveTime = effectiveFrom ? new Date(effectiveFrom) : new Date();
    const isFuture = effectiveTime.getTime() > Date.now();

    const results: any[] = [];
    for (const country of countries) {
      const countryCode = country.toUpperCase();

      if (role === "admin" && adminReq.countryScope.length > 0 && !adminReq.countryScope.includes(countryCode)) {
        continue;
      }

      const existing = await prisma.countryCommission.findUnique({
        where: { country: countryCode }
      });

      const currentRate = existing ? Number(existing.currentRate) : null;

      let record;
      if (isFuture) {
        record = await prisma.countryCommission.upsert({
          where: { country: countryCode },
          update: {
            pendingRate: rate,
            effectiveFrom: effectiveTime,
            lastReason: reason,
            setBy: adminReq.adminId,
          },
          create: {
            country: countryCode,
            currentRate: currentRate || DEFAULT_GLOBAL_RATE,
            pendingRate: rate,
            effectiveFrom: effectiveTime,
            lastReason: reason,
            setBy: adminReq.adminId,
          }
        });
      } else {
        record = await prisma.countryCommission.upsert({
          where: { country: countryCode },
          update: {
            currentRate: rate,
            pendingRate: null,
            effectiveFrom: null,
            lastReason: reason,
            setBy: adminReq.adminId,
          },
          create: {
            country: countryCode,
            currentRate: rate,
            setBy: adminReq.adminId,
            lastReason: reason,
          }
        });

        await prisma.commissionHistory.create({
          data: {
            scope: "country",
            countryCode,
            oldRate: currentRate,
            newRate: rate,
            effectiveFrom: effectiveTime,
            changedBy: adminReq.adminId,
            changedByRole: adminReq.adminRole,
            reason,
            applyToAll: false,
            providersNotified: notifyProviders,
          }
        });
      }
      results.push(record);
    }

    return sendSuccess(reply, 200, { updatedCount: results.length });
  });

  // ── DELETE /admin/commission-rates/:country — remove override ─────
  app.delete("/admin/commission-rates/:country", {
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminReq = req as AdminRequest;
    const { country } = req.params as { country: string };
    const countryCode = country.toUpperCase();
    const role = adminReq.adminRole;

    if (role !== "super_admin" && role !== "admin") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admin and Admin can delete overrides.");
    }

    if (role === "admin" && adminReq.countryScope.length > 0 && !adminReq.countryScope.includes(countryCode)) {
      return sendError(reply, 403, "FORBIDDEN", "You do not have access to manage overrides for this country.");
    }

    const existing = await prisma.countryCommission.findUnique({
      where: { country: countryCode }
    });
    if (!existing) {
      return sendError(reply, 404, "NOT_FOUND", "Commission override rate not found.");
    }

    await prisma.countryCommission.delete({
      where: { country: countryCode }
    });

    return sendSuccess(reply, 200, {
      message: `Commission override for ${countryCode} reverted to global default.`
    });
  });

  // ── GET /commission-rates/effective/:country — resolve rate ─────────
  app.get("/commission-rates/effective/:country", async (req: FastifyRequest, reply: FastifyReply) => {
    const { country } = req.params as { country: string };
    const countryCode = country.toUpperCase();

    const effectiveRate = await getEffectiveCommissionRate(countryCode);
    const hasOverride = await prisma.countryCommission.findUnique({
      where: { country: countryCode }
    });

    return sendSuccess(reply, 200, {
      country: countryCode,
      effectiveRate,
      isCountrySpecific: !!hasOverride,
    });
  });

  // ── GET /admin/commission/history — Audit trail list ─────────────────
  app.get("/admin/commission/history", {
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminReq = req as AdminRequest;
    const role = adminReq.adminRole;

    if (role !== "super_admin" && role !== "finance_agent" && role !== "admin" && role !== "country_manager") {
      return sendError(reply, 403, "FORBIDDEN", "You do not have access to view commission history.");
    }

    const { country, startDate, endDate, changedBy } = req.query as {
      country?: string;
      startDate?: string;
      endDate?: string;
      changedBy?: string;
    };

    const whereClause: any = {};

    if (country) {
      whereClause.countryCode = country.toUpperCase();
    }

    if (changedBy) {
      whereClause.changedBy = changedBy;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate);
      }
    }

    let history = await prisma.commissionHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    });

    if (role === "admin" || role === "country_manager") {
      history = history.filter(h => !h.countryCode || adminReq.countryScope.includes(h.countryCode.toUpperCase()));
    }

    return sendSuccess(reply, 200, history.map((h) => ({
      id: h.id,
      scope: h.scope,
      countryCode: h.countryCode,
      oldRate: h.oldRate ? Number(h.oldRate) : null,
      newRate: Number(h.newRate),
      effectiveFrom: h.effectiveFrom.toISOString(),
      changedBy: h.changedBy,
      changedByRole: h.changedByRole,
      reason: h.reason,
      createdAt: h.createdAt.toISOString(),
    })));
  });

  // ── GET /admin/commission/export — Export CSV ──
  app.get("/admin/commission/export", {
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const adminReq = req as AdminRequest;
    const role = adminReq.adminRole;

    if (role !== "super_admin" && role !== "finance_agent") {
      return sendError(reply, 403, "FORBIDDEN", "Only Super Admin and Finance Agent can export commission data.");
    }

    const history = await prisma.commissionHistory.findMany({
      orderBy: { createdAt: "desc" },
    });

    const csvData = history.map((h) => ({
      ID: h.id,
      Scope: h.scope,
      CountryCode: h.countryCode || "Global",
      OldRate: h.oldRate ? Number(h.oldRate) : "N/A",
      NewRate: Number(h.newRate),
      EffectiveFrom: h.effectiveFrom.toISOString(),
      ChangedBy: h.changedBy,
      ChangedByRole: h.changedByRole,
      Reason: h.reason,
      CreatedAt: h.createdAt.toISOString(),
    }));

    try {
      const csv = convertToCSV(csvData);
      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", 'attachment; filename="commission_history.csv"');
      return reply.send(csv);
    } catch (err: any) {
      return sendError(reply, 500, "EXPORT_ERROR", `Failed to export CSV: ${err.message}`);
    }
  });
}