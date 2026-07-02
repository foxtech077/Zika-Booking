export interface ActivePromotion {
  id: string;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  description?: string;
  category?: string;
  activity?: string;
  labelText?: string;
  labelColour?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  validFrom?: string;
  validUntil?: string;
  status?: string;
  applyToBooking?: boolean;
}

export const isPromotionValid = (promotion: ActivePromotion | null | undefined): boolean => {
  if (!promotion || promotion.status !== "active") return false;
  const now = new Date();
  const from = promotion.validFrom ? new Date(promotion.validFrom) : null;
  const until = promotion.validUntil ? new Date(promotion.validUntil) : null;
  if (from && now < from) return false;
  if (until && now > until) return false;
  return true;
};
