import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";

const DEFAULT_RATE = 0.05;

export async function commissionRoutes(app: FastifyInstance) {
  // ── GET /admin/commission-rates — list all country-specific rates ─────
  // FIX: added requireAdmin middleware
  app.get("/admin/commission-rates", { schema: { tags: ["Admin Commission"] }, preHandler: [requireAdmin] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const rates = await prisma.commissionRate.findMany({
      orderBy: { country: "asc" },
    });

    return sendSuccess(reply, 200, {
      defaultRate: DEFAULT_RATE,
      rates: rates.map((r) => ({
        id: r.id,
        country: r.country,
        rate: Number(r.rate),
        setBy: r.setBy,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  });

  // ── POST /admin/commission-rates — upsert a country rate ─────────────
  // FIX: added requireAdmin middleware
  app.post("/admin/commission-rates", { schema: { tags: ["Admin Commission"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { country: string; rate: number };

    if (!body.country || typeof body.country !== "string" || body.country.length !== 2) {
      return sendError(reply, 400, "VALIDATION_ERROR", "country must be a 2-character ISO code.");
    }
    if (body.rate === undefined || typeof body.rate !== "number" || body.rate < 0 || body.rate > 0.30) {
      return sendError(reply, 400, "VALIDATION_ERROR", "rate must be a number between 0 and 0.30.");
    }

    const countryCode = body.country.toUpperCase();

    const rate = await prisma.commissionRate.upsert({
      where: { country: countryCode },
      update: { rate: body.rate, setBy: "admin", updatedAt: new Date() },
      create: { country: countryCode, rate: body.rate, setBy: "admin" },
    });

    return sendSuccess(reply, 200, {
      id: rate.id,
      country: rate.country,
      rate: Number(rate.rate),
      setBy: rate.setBy,
      createdAt: rate.createdAt.toISOString(),
      updatedAt: rate.updatedAt.toISOString(),
    });
  });

  // ── DELETE /admin/commission-rates/:country — remove country rate ─────
  // FIX: added requireAdmin middleware
  app.delete("/admin/commission-rates/:country", { schema: { tags: ["Admin Commission"] }, preHandler: [requireAdmin] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { country } = req.params as { country: string };
    const countryCode = country.toUpperCase();

    const existing = await prisma.commissionRate.findUnique({ where: { country: countryCode } });
    if (!existing) return sendError(reply, 404, "NOT_FOUND", "Commission rate not found for this country.");

    await prisma.commissionRate.delete({ where: { country: countryCode } });

    return sendSuccess(reply, 200, { message: `Commission rate for ${countryCode} deleted. Default rate of ${DEFAULT_RATE} applies.` });
  });

  // ── GET /commission-rates/effective/:country — effective rate ─────────
  app.get("/commission-rates/effective/:country", { schema: { tags: ["Commission"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { country } = req.params as { country: string };
    const countryCode = country.toUpperCase();

    const rate = await prisma.commissionRate.findUnique({ where: { country: countryCode } });

    return sendSuccess(reply, 200, {
      country: countryCode,
      effectiveRate: rate ? Number(rate.rate) : DEFAULT_RATE,
      isCountrySpecific: rate !== null,
    });
  });
}