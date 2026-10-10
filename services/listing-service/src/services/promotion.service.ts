import { prisma } from "../lib/prisma.js";

/** Resolve the promotion that is actually valid for a listing's country. */
export async function getActivePromotion(
  activity: string,
  countryCode?: string | null,
  applyToBooking?: boolean,
) {
  const country = countryCode?.toUpperCase() ?? null;
  const promotions = await (prisma as any).activityPromotion.findMany({
    where: {
      activity,
      status: "active",
      validFrom: { lte: new Date() },
      validUntil: { gte: new Date() },
      ...(applyToBooking === undefined ? {} : { applyToBooking }),
      OR: [{ countryScope: null }, ...(country ? [{ countryScope: country }] : [])],
    },
    orderBy: { createdAt: "desc" },
  });
  return promotions.find((promotion: { countryScope?: string | null }) => promotion.countryScope === country)
    ?? promotions.find((promotion: { countryScope?: string | null }) => promotion.countryScope == null)
    ?? null;
}

export function promotionAmount(
  baseAmount: number,
  promotion: { discountType?: string | null; discountValue?: unknown } | null,
): number {
  if (!promotion || promotion.discountType === "label_only") return 0;
  const value = Number(promotion.discountValue ?? 0);
  const amount = promotion.discountType === "percentage" ? baseAmount * value / 100 : value;
  return Number(Math.max(0, Math.min(baseAmount, amount)).toFixed(2));
}

export function promotionDisplay(amount: number, baseAmount: number) {
  return {
    originalPrice: Number(baseAmount.toFixed(2)),
    discountedPrice: Number(Math.max(0, baseAmount - amount).toFixed(2)),
    discountAmount: Number(amount.toFixed(2)),
    discountPercent: baseAmount > 0 ? Number((amount / baseAmount * 100).toFixed(2)) : 0,
  };
}
