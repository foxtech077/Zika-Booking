import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendSuccess, sendError } from "../lib/errors.js";
import { convertCurrency } from "../services/fx.services.js";
import { ceilingForCurrency, getEurRateOrNull, getRatesBatch } from "../services/exchangeRate.services.js";
import { requireAdmin } from "../middleware/auth.js";
import { enqueueExchangeRateRefresh } from "../jobs.js";

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

  /**
   * Strict EUR quote for the money-of-record charge/transfer path.
   * Uses the DB exchange-rate table only (NO live-API fallback). If the rate
   * is stale or missing it enqueues an immediate BullMQ re-sync and returns
   * 503 TEMPORARILY_UNAVAILABLE so the caller can retry instead of charging a
   * wrong amount.
   */
  app.post(
    "/internal/fx/eur-quote",
    {
      schema: {
        tags: ["FX"],
        summary: "Strict quote of a base-currency amount in EUR (service-to-service)",
        body: {
          type: "object",
          required: ["amount", "currency"],
          properties: {
            amount: { type: "number" },
            currency: { type: "string", minLength: 3, maxLength: 3 },
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

      const { amount, currency } = req.body as { amount: number; currency: string };
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) {
        return sendError(reply, 400, "INVALID_AMOUNT", "amount must be a non-negative number.");
      }
      const from = currency.toUpperCase();

      const rate = await getEurRateOrNull(from);
      if (rate === null) {
        void enqueueExchangeRateRefresh();
        return sendError(reply, 503, "TEMPORARILY_UNAVAILABLE", "EUR conversion is temporarily unavailable. Please try again shortly.");
      }

      const rawConverted = n * rate;
      const converted = ceilingForCurrency(rawConverted, "EUR");
      return sendSuccess(reply, 200, {
        amount: n,
        converted,
        rawConverted: Number(rawConverted.toFixed(8)),
        rate: Number(rate.toFixed(6)),
        from,
        to: "EUR",
      });
    },
  );

  /**
   * Trigger an immediate exchange-rate re-sync (schedules a BullMQ
   * ExchangeRateRefresher job). Used by the payment service when a stale-EUR
   * failure occurs so the guest can retry shortly.
   */
  app.post(
    "/internal/fx/refresh",
    {
      schema: {
        tags: ["FX"],
        summary: "Schedule an immediate exchange-rate refresh (service-to-service)",
        body: { type: "object", additionalProperties: false },
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
      await enqueueExchangeRateRefresh();
      return sendSuccess(reply, 200, { message: "Exchange-rate refresh scheduled." });
    },
  );

  // ── POST /admin/fx/to-eur — batch conversion to EUR for admin display ───────
  // Every transaction moves money as EUR (Stripe) or XAF (Tara mobile money,
  // pegged to EUR), so the admin portal shows all amounts in EUR. This endpoint
  // converts a batch of { currency → amount } pairs to EUR using the DB rate
  // table (identity for EUR, cross-rate for XAF and everything else).
  app.post(
    "/admin/fx/to-eur",
    {
      schema: {
        tags: ["Admin FX"],
        summary: "Convert a batch of amounts into EUR for admin display (admin-only)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["amounts"],
          properties: {
            amounts: {
              type: "object",
              additionalProperties: { type: "number" },
              description: "Map of currency → amount, e.g. { \"KES\": 13000, \"XAF\": 50000, \"EUR\": 300 }",
            },
          },
        },
      },
      preHandler: [requireAdmin],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { amounts } = req.body as { amounts?: Record<string, number> };
      const entries = Object.entries(amounts ?? {});
      if (entries.length === 0) {
        return sendSuccess(reply, 200, { baseCurrency: "EUR", rates: {}, converted: {} });
      }

      const currencies = entries.map(([c]) => c);
      const rates = await getRatesBatch(currencies, "EUR");

      const ratesOut: Record<string, number> = {};
      const converted: Record<string, number | null> = {};
      for (const [currency, amount] of entries) {
        const upper = currency.toUpperCase();
        const rate = rates.get(upper);
        if (rate == null) {
          converted[currency] = null; // rate unavailable — never fabricate a number
          continue;
        }
        ratesOut[upper] = rate;
        converted[currency] = Number((Number(amount) * rate).toFixed(2));
      }

      return sendSuccess(reply, 200, { baseCurrency: "EUR", rates: ratesOut, converted });
    },
  );
}
