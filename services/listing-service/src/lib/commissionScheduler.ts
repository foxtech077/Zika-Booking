import { prisma } from "./prisma.js";
import { sendCommissionRateChangeEmail } from "./email.js";
import { fireNotification } from "./notifications.js";

// Runs nightly at 00:01 UTC — promotes pending commission rates whose
// effectiveFrom date has been reached to the current rate, then writes history.

async function promotePendingRates(): Promise<void> {
  const now = new Date();

  // ── 1. Country-level pending rates ────────────────────────────────────────
  const dueCrates = await prisma.commissionRate.findMany({
    where: {
      pendingRate: { not: null },
      pendingEffectiveFrom: { lte: now },
    },
  });

  for (const cr of dueCrates) {
    if (cr.pendingRate == null || cr.pendingEffectiveFrom == null) continue;

    const oldRate = Number(cr.rate);
    const newRate = Number(cr.pendingRate);

    await prisma.$transaction(async (tx) => {
      await tx.commissionRate.update({
        where: { id: cr.id },
        data: {
          rate: newRate,
          pendingRate: null,
          pendingEffectiveFrom: null,
          pendingReason: null,
        },
      });
      await tx.commissionHistory.create({
        data: {
          scope: "country",
          countryCode: cr.country,
          oldRate,
          newRate,
          effectiveFrom: cr.pendingEffectiveFrom!,
          changedBy: cr.setBy,
          changedByRole: "scheduled",
          reason: cr.pendingReason ?? "Scheduled rate change",
          applyToAll: false,
          providersNotified: false,
        },
      });
    });

    console.log(`[CommissionScheduler] Promoted ${cr.country}: ${oldRate} → ${newRate}`);

    // Notify providers in this country
    sendCountryEmail(cr.country, newRate, oldRate, cr.pendingEffectiveFrom, cr.pendingReason ?? "Scheduled rate change").catch(() => null);
    prisma.listing.findMany({
      where: { country: cr.country, status: "active" },
      select: { providerId: true },
      distinct: ["providerId"],
    })
      .then((rows) => {
        const providerIds = rows.map((r) => r.providerId);
        const effectiveDateStr = cr.pendingEffectiveFrom!.toISOString().split("T")[0];
        for (const providerId of providerIds) {
          fireNotification(providerId, {
            type: "commission_update",
            title: "Commission Rate Update",
            body: `The commission rate for ${cr.country} has been updated to ${(newRate * 100).toFixed(2)}%, effective ${effectiveDateStr}.`,
            data: { scope: cr.country, newRate, effectiveDate: effectiveDateStr },
          });
        }
      })
      .catch(() => null);
  }

  // ── 2. Global pending rate ────────────────────────────────────────────────
  const settings = await prisma.platformSettings.findUnique({ where: { id: "global" } });
  if (
    settings?.pendingGlobalRate != null &&
    settings.pendingGlobalEffectiveFrom != null &&
    settings.pendingGlobalEffectiveFrom <= now
  ) {
    const oldRate = Number(settings.globalCommissionRate);
    const newRate = Number(settings.pendingGlobalRate);

    await prisma.$transaction(async (tx) => {
      await tx.platformSettings.update({
        where: { id: "global" },
        data: {
          globalCommissionRate: newRate,
          pendingGlobalRate: null,
          pendingGlobalEffectiveFrom: null,
          pendingGlobalReason: null,
        },
      });
      await tx.commissionHistory.create({
        data: {
          scope: "global",
          oldRate,
          newRate,
          effectiveFrom: settings.pendingGlobalEffectiveFrom!,
          changedBy: settings.updatedBy ?? "scheduler",
          changedByRole: "scheduled",
          reason: settings.pendingGlobalReason ?? "Scheduled global rate change",
          applyToAll: false,
          providersNotified: false,
        },
      });
    });

    console.log(`[CommissionScheduler] Promoted global rate: ${oldRate} → ${newRate}`);

    sendGlobalEmail(newRate, oldRate, settings.pendingGlobalEffectiveFrom, settings.pendingGlobalReason ?? "Scheduled rate change").catch(() => null);
    prisma.listing.findMany({
      where: { status: "active" },
      select: { providerId: true },
      distinct: ["providerId"],
    })
      .then((rows) => {
        const providerIds = rows.map((r) => r.providerId);
        const effectiveDateStr = settings.pendingGlobalEffectiveFrom!.toISOString().split("T")[0];
        for (const providerId of providerIds) {
          fireNotification(providerId, {
            type: "commission_update",
            title: "Commission Rate Update",
            body: `The commission rate for All markets has been updated to ${(newRate * 100).toFixed(2)}%, effective ${effectiveDateStr}.`,
            data: { scope: "All markets", newRate, effectiveDate: effectiveDateStr },
          });
        }
      })
      .catch(() => null);
  }
}

async function sendCountryEmail(
  countryCode: string,
  newRate: number,
  oldRate: number,
  effectiveDate: Date,
  reason: string,
): Promise<void> {
  const providers = await prisma.listing.findMany({
    where: { country: countryCode, status: "active" },
    select: { providerId: true },
    distinct: ["providerId"],
  });
  const emails = await fetchProviderEmails(providers.map((p) => p.providerId));
  for (const email of emails) {
    await sendCommissionRateChangeEmail(email, {
      scope: countryCode,
      oldRate,
      newRate,
      effectiveDate: effectiveDate.toISOString().split("T")[0]!,
      reason,
    }).catch(() => null);
  }
}

async function sendGlobalEmail(
  newRate: number,
  oldRate: number,
  effectiveDate: Date,
  reason: string,
): Promise<void> {
  const providers = await prisma.listing.findMany({
    where: { status: "active" },
    select: { providerId: true },
    distinct: ["providerId"],
  });
  const emails = await fetchProviderEmails(providers.map((p) => p.providerId));
  for (const email of emails) {
    await sendCommissionRateChangeEmail(email, {
      scope: "All markets",
      oldRate,
      newRate,
      effectiveDate: effectiveDate.toISOString().split("T")[0]!,
      reason,
    }).catch(() => null);
  }
}

async function fetchProviderEmails(providerIds: string[]): Promise<string[]> {
  if (providerIds.length === 0) return [];
  const AUTH_SERVICE_URL = process.env["AUTH_SERVICE_URL"] ?? "http://localhost:3001";
  try {
    const res = await fetch(`${AUTH_SERVICE_URL}/internal/users/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: providerIds }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { emails?: string[] };
    return json.emails ?? [];
  } catch {
    return [];
  }
}

export { promotePendingRates };
