import { prisma } from "../lib/prisma.js";

const DEFAULT_GLOBAL_RATE = 5.00; // 5.00%

/**
 * Resolves the effective commission rate for a booking.
 * Resolution order:
 * 1. Country-specific override (if listing country exists in country_commissions)
 * 2. Global default (stored in platform_settings, fallback to 5.00% if not initialized)
 */
export async function getEffectiveCommissionRate(countryCode: string | null): Promise<number> {
  if (countryCode) {
    const override = await prisma.countryCommission.findUnique({
      where: { country: countryCode.toUpperCase() },
    });
    if (override) {
      return Number(override.currentRate);
    }
  }

  const settings = await prisma.platformSettings.findFirst();
  if (settings) {
    return Number(settings.globalCommissionRate);
  }

  return DEFAULT_GLOBAL_RATE;
}
