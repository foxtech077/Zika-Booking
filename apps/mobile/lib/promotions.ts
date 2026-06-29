// Matches the actual /promotions/active API response shape
export interface ActivePromotion {
  activity: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  labelText: string;
  bannerTitle: string;
  status: string;
  applyToBooking: boolean;
}

export interface PromotedPricing {
  hasPromotion: boolean;
  originalPrice: number | null;
  discountedPrice: number | null;
  savings: number | null;
  labelText: string;
  bannerTitle: string;
}

export function applyPromotion(
  originalPrice: number | null | undefined,
  promotion: ActivePromotion | null | undefined,
): PromotedPricing {
  const empty: PromotedPricing = {
    hasPromotion: false,
    originalPrice: originalPrice ?? null,
    discountedPrice: null,
    savings: null,
    labelText: "",
    bannerTitle: "",
  };

  if (!promotion || originalPrice == null || originalPrice <= 0) return empty;

  const val = parseFloat(promotion.discountValue) || 0;
  if (val <= 0) return empty;

  const savings =
    promotion.discountType === "percentage"
      ? (originalPrice * val) / 100
      : val;

  return {
    hasPromotion: true,
    originalPrice,
    discountedPrice: Math.max(0, originalPrice - savings),
    savings,
    labelText: promotion.labelText,
    bannerTitle: promotion.bannerTitle,
  };
}
