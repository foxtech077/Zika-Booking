import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendSuccess, sendError } from "../lib/errors.js";
import { convertCurrency } from "../services/fx.services.js";
import { ceilingForCurrency } from "../services/exchangeRate.services.js";

const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

/**
 * FX conversion endpoints.
 *
 * - GET /fx/convert — public, used by the web/mobile apps to display the
 *   XAF amount a guest will pay via Tara mobile money before they confirm.
 * - POST /internal/fx/convert — service-to-service, used by the payment
 *   service to compute the exact XAF amount to charge Tara.
 *
 * Both convert `amount` from `from` to `to` using the exchange-rate table
 * (scheduled refresh) with a live-API fallback, and ceiling the result for
 * the target currency's precision (XAF is a 0-decimal currency → integer).
 */
export async function fxRoutes(app: FastifyInstance) {
  app.get(
    "/fx/convert",
    {
      schema: {
        tags: ["FX"],
        summary: "Convert an amount between currencies (public, read-only)",
        querystring: {
          type: "object",
          required: ["amount", "from", "to"],
          properties: {
            amount: { type: "number", description: "Amount to convert" },
            from: { type: "string", minLength: 3, maxLength: 3, description: "ISO 4217 source currency, e.g. KES" },
            to: { type: "string", minLength: 3, maxLength: 3, description: "ISO 4217 target currency, e.g. XAF" },
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
                  amount: { type: "number" },
                  converted: { type: "number" },
                  rate: { type: "number" },
                  from: { type: "string" },
                  to: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { amount, from, to } = req.query as { amount: string; from: string; to: string };
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) {
        return sendError(reply, 400, "INVALID_AMOUNT", "amount must be a non-negative number.");
      }
      try {
        const raw = await convertCurrency(n, from, to);
        const converted = ceilingForCurrency(raw, to);
        const rate = Number((raw / Math.max(n, 0.0000001)).toFixed(6));
        return sendSuccess(reply, 200, {
          amount: n,
          converted,
          rate,
          from: from.toUpperCase(),
          to: to.toUpperCase(),
        });
      } catch (err) {
        req.log.error({ err, from, to }, "FX conversion failed");
        return sendError(reply, 502, "FX_UNAVAILABLE", "Exchange rate unavailable. Please try again later.");
      }
    },
  );

  app.post(
    "/internal/fx/convert",
    {
      schema: {
        tags: ["FX"],
        summary: "Convert an amount between currencies (service-to-service)",
        body: {
          type: "object",
          required: ["amount", "from", "to"],
          properties: {
            amount: { type: "number", description: "Amount to convert" },
            from: { type: "string", minLength: 3, maxLength: 3 },
            to: { type: "string", minLength: 3, maxLength: 3 },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      if (!INTERNAL_SERVICE_KEY) {
        return sendError(reply, 503, "SERVICE_UNAVAILABLE", "Internal service key not configured.");
      }
      const token = req.headers["x-service-key"];
      if (!token || token !== INTERNAL_SERVICE_KEY) {
        return sendError(reply, 401, "UNAUTHORIZED", "Invalid or missing service token.");
      }

      const { amount, from, to } = req.body as { amount: number; from: string; to: string };
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) {
        return sendError(reply, 400, "INVALID_AMOUNT", "amount must be a non-negative number.");
      }
      try {
        const raw = await convertCurrency(n, from, to);
        const converted = ceilingForCurrency(raw, to);
        const rate = Number((raw / Math.max(n, 0.0000001)).toFixed(6));
        return sendSuccess(reply, 200, {
          amount: n,
          converted,
          rate,
          from: from.toUpperCase(),
          to: to.toUpperCase(),
        });
      } catch (err) {
        req.log.error({ err, from, to }, "Internal FX conversion failed");
        return sendError(reply, 502, "FX_UNAVAILABLE", "Exchange rate unavailable. Please try again later.");
      }
    },
  );
}
