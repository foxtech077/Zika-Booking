import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendSuccess, sendError } from "../lib/errors.js";

const IPAPI_BASE = "https://ipapi.co";

export async function locationRoutes(app: FastifyInstance) {
  app.get(
    "/location",
    {
      schema: {
        tags: ["Location"],
        description: "Returns approximate location of the caller based on their IP address",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  ip:          { type: "string" },
                  city:        { type: ["string", "null"] },
                  region:      { type: ["string", "null"] },
                  country:     { type: ["string", "null"] },
                  countryCode: { type: ["string", "null"] },
                  lat:         { type: ["number", "null"] },
                  lng:         { type: ["number", "null"] },
                  timezone:    { type: ["string", "null"] },
                  currency:    { type: ["string", "null"] },
                  isLocalhost: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const ip = req.ip;
        const isLocalhost =
          ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

        if (isLocalhost) {
          return sendSuccess(reply, 200, {
            ip,
            city:        null,
            region:      null,
            country:     null,
            countryCode: null,
            lat:         null,
            lng:         null,
            timezone:    null,
            currency:    null,
            isLocalhost: true,
          });
        }

        const res = await fetch(`${IPAPI_BASE}/${ip}/json/`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
          req.log.warn({ ip, status: res.status }, "ipapi.co returned non-OK status");
          return sendError(reply, 502, "LOCATION_FETCH_FAILED", "Failed to fetch location data.");
        }

        const data = (await res.json()) as Record<string, unknown>;

        if (data["error"]) {
          return sendError(reply, 400, "LOCATION_ERROR", String(data["reason"] ?? "Location lookup failed."));
        }

        return sendSuccess(reply, 200, {
          ip,
          city:        (data["city"]         as string  | null) ?? null,
          region:      (data["region"]        as string  | null) ?? null,
          country:     (data["country_name"]  as string  | null) ?? null,
          countryCode: (data["country_code"]  as string  | null) ?? null,
          lat:         (data["latitude"]      as number  | null) ?? null,
          lng:         (data["longitude"]     as number  | null) ?? null,
          timezone:    (data["timezone"]      as string  | null) ?? null,
          currency:    (data["currency"]      as string  | null) ?? null,
          isLocalhost: false,
        });
      } catch (err) {
        req.log.error({ err }, "Location lookup failed");
        return sendError(reply, 500, "INTERNAL_ERROR", "An unexpected error occurred during location lookup.");
      }
    },
  );
}
