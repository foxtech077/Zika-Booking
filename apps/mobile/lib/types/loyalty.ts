export type LoyaltyTier = "bronze" | "silver" | "gold" | "diamond";

export interface TierBenefit {
  label: string;
}

export interface LoyaltyProfile {
  currentTier: LoyaltyTier;
  loyaltyPoints: number;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number | null;
  tierBenefits: TierBenefit[];
}

export type PointsTransactionType =
  | "earned"
  | "redeemed"
  | "reversed"
  | "refunded"
  | "expired"
  | "adjusted";

export interface PointsTransaction {
  id: string;
  type: PointsTransactionType;
  points: number;
  description: string;
  bookingReference?: string | null;
  createdAt: string;
}

export interface PointsHistoryResponse {
  transactions: PointsTransaction[];
  totalEarned: number;
  totalRedeemed: number;
  totalReversed: number;
  totalRefunded: number;
  nextCursor: string | null;
}
