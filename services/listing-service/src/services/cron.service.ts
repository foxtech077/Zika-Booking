import { prisma } from "../lib/prisma.js";

/**
 * Promotes any country commission overrides whose effective date has arrived.
 * Runs nightly at 00:01 UTC.
 */
export async function promotePendingRates(): Promise<void> {
  const now = new Date();

  // Find all country overrides with pending rates that should take effect (effectiveFrom <= now)
  const pendingOverrides = await prisma.countryCommission.findMany({
    where: {
      pendingRate: { not: null },
      effectiveFrom: { lte: now },
    },
  });

  for (const override of pendingOverrides) {
    if (override.pendingRate === null) continue;

    const oldRate = override.currentRate;
    const newRate = override.pendingRate;

    await prisma.$transaction([
      // 1. Promote pending to current
      prisma.countryCommission.update({
        where: { id: override.id },
        data: {
          currentRate: newRate,
          pendingRate: null,
          effectiveFrom: null,
        },
      }),
      // 2. Add to commission history
      prisma.commissionHistory.create({
        data: {
          scope: "country",
          countryCode: override.country,
          oldRate,
          newRate,
          effectiveFrom: override.effectiveFrom || now,
          changedBy: override.setBy,
          changedByRole: "admin",
          reason: override.lastReason || "Promoted scheduled rate change",
          applyToAll: false,
          providersNotified: false,
        },
      }),
    ]);
  }
}

/**
 * Schedules the nightly promotion job to run every day at 00:01 UTC.
 */
export function startNightlyJob(): void {
  promotePendingRates().catch((err) => console.error("Error running initial promotePendingRates:", err));

  function scheduleNextRun() {
    const now = new Date();
    const nextRun = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 1, 0, 0
    ));

    const delay = nextRun.getTime() - now.getTime();

    setTimeout(() => {
      promotePendingRates()
        .catch((err) => console.error("Error in nightly promotePendingRates:", err))
        .finally(() => scheduleNextRun());
    }, delay);
  }

  scheduleNextRun();
}
