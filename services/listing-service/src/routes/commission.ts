import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import { sendSuccess, sendError } from "../lib/errors.js";

const DEFAULT_RATE = 0.05;

export async function commissionRoutes(app: FastifyInstance) {
  // ── GET /admin/commission-rates — list all country-specific rates ─────
<<<<<<< HEAD
  app.get("/admin/commission-rates", { schema: { tags: ["Admin Commission"] } }, async (_req: FastifyRequest, reply: FastifyReply) => {
=======
  app.get("/admin/commission-rates", {
    schema: {
      tags: ["Admin Commission"],
      response: {
        200: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            data: {
              type: "object",
              properties: {
                defaultRate: { type: "number" },
                rates: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      country: { type: "string" },
                      rate: { type: "number" },
                      setBy: { type: "string" },
                      createdAt: { type: "string" },
                      updatedAt: { type: "string" }
                    },
                    required: ["id", "country", "rate", "setBy", "createdAt", "updatedAt"]
                  }
                }
              },
              required: ["defaultRate", "rates"]
            }
          },
          required: ["success", "data"]
        }
      }
    },
    preHandler: [requireAdmin]
  }, async (_req: FastifyRequest, reply: FastifyReply) => {
>>>>>>> fcb38d33ef126f802619ec41f030654c65b4f260
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
<<<<<<< HEAD
  app.post("/admin/commission-rates", { schema: { tags: ["Admin Commission"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
=======
  app.post("/admin/commission-rates", {
    schema: {
      tags: ["Admin Commission"],
      body: {
        type: "object",
        required: ["country", "rate"],
        properties: {
          country: { type: "string", minLength: 2, maxLength: 2 },
          rate: { type: "number", minimum: 0, maximum: 0.30 }
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
                id: { type: "string" },
                country: { type: "string" },
                rate: { type: "number" },
                setBy: { type: "string" },
                createdAt: { type: "string" },
                updatedAt: { type: "string" }
              },
              required: ["id", "country", "rate", "setBy", "createdAt", "updatedAt"]
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
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
>>>>>>> fcb38d33ef126f802619ec41f030654c65b4f260
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
<<<<<<< HEAD
  app.delete("/admin/commission-rates/:country", { schema: { tags: ["Admin Commission"] } }, async (req: FastifyRequest, reply: FastifyReply) => {
=======
  app.delete("/admin/commission-rates/:country", {
    schema: {
      tags: ["Admin Commission"],
      params: {
        type: "object",
        required: ["country"],
        properties: {
          country: { type: "string", minLength: 2, maxLength: 2 }
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
                message: { type: "string" }
              },
              required: ["message"]
            }
          },
          required: ["success", "data"]
        },
        404: {
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
    preHandler: [requireAdmin]
  }, async (req: FastifyRequest, reply: FastifyReply) => {
>>>>>>> fcb38d33ef126f802619ec41f030654c65b4f260
    const { country } = req.params as { country: string };
    const countryCode = country.toUpperCase();

    const existing = await prisma.commissionRate.findUnique({ where: { country: countryCode } });
    if (!existing) return sendError(reply, 404, "NOT_FOUND", "Commission rate not found for this country.");

    await prisma.commissionRate.delete({ where: { country: countryCode } });

    return sendSuccess(reply, 200, { message: `Commission rate for ${countryCode} deleted. Default rate of ${DEFAULT_RATE} applies.` });
  });

  // ── GET /commission-rates/effective/:country — effective rate ─────────
  app.get("/commission-rates/effective/:country", {
    schema: {
      tags: ["Commission"],
      params: {
        type: "object",
        required: ["country"],
        properties: {
          country: { type: "string", minLength: 2, maxLength: 2 }
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
                country: { type: "string" },
                effectiveRate: { type: "number" },
                isCountrySpecific: { type: "boolean" }
              },
              required: ["country", "effectiveRate", "isCountrySpecific"]
            }
          },
          required: ["success", "data"]
        }
      }
    }
  }, async (req: FastifyRequest, reply: FastifyReply) => {
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
