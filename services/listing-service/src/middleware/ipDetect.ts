// middleware/ipDetect.middleware.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import geoip from "geoip-lite";
import { paymentRoutingConfig } from "../config/payment.config.js";

// Use the exact same set as payment routing to ensure consistency
const AFRICA_COUNTRIES = paymentRoutingConfig.taraCountries;

export async function ipDetect(req: FastifyRequest, _reply: FastifyReply) {
  // 1. Safe IP detection (relies on Fastify's trustProxy: true)
  const ip = req.ip;

  let country: string | undefined;

  // 2. Lookup Geo IP locally (Offline, 0 latency)
  if (ip && ip !== "127.0.0.1" && ip !== "::1") {
    const geo = geoip.lookup(ip);
    if (geo && geo.country) {
      country = geo.country.toUpperCase();
    }
  }

  // 3. Fallback to UNKNOWN
  if (!country) {
    country = "UNKNOWN";
  }

  // 4. Normalize and append
  req.location = {
    ip,
    country,
    region: AFRICA_COUNTRIES.has(country) ? "AFRICA" : "OTHER",
  };
}