// middleware/ipDetect.middleware.ts
import type { FastifyRequest, FastifyReply } from "fastify";

const AFRICA_COUNTRIES = new Set([
  "NG", "KE", "GH", "ZA", "UG", "TZ", "EG", "MA"
]);

export async function ipDetect(req: FastifyRequest, _reply: FastifyReply) {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0] ||
    req.ip;

  let country = (req.headers["cf-ipcountry"] as string | undefined)?.toUpperCase();

  if (!country) {
    country = "IN"; // fallback
  }

  req.location = {
    ip,
    country,
    region: AFRICA_COUNTRIES.has(country) ? "AFRICA" : "OTHER",
  };
}