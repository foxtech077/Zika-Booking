export type ActivityScope =
  | "hotels"
  | "apartments"
  | "cars"
  | "hotels_apartments"
  | "universal";

export type DiscountType = "percentage" | "fixed";

export interface ApplicableVoucher {
  code: string;
  title?: string;
  description?: string;
  activityScope?: ActivityScope;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  computedDiscount: number;
  validUntil: string;
  hoursUntilExpiry?: number;
  applicable: boolean;
  reason: string | null;
}

export type VoucherBannerState = "active" | "expiring_soon" | "none";

export interface ApplicableVouchersResponse {
  bannerState: VoucherBannerState;
  bestVoucher: ApplicableVoucher | null;
  vouchers: ApplicableVoucher[];
}

export interface ValidatedVoucher {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number | null;
  validUntil: string;
}

export interface VoucherValidatePayload {
  code: string;
  totalAmount: number;
  currency?: string;
  activity: ActivityScope;
  guestId: string;
  guestTier?: string;
  guestCountry?: string;
}

export interface VoucherValidateResult {
  valid: boolean;
  discountAmount: number;
  voucherDiscount: number;
  message: string;
  voucher: ValidatedVoucher | null;
}

export type WalletVoucherStatus = "active" | "paused" | "expired" | "exhausted";

// Matches the actual GET /vouchers/wallet response shape.
export interface WalletVoucher {
  voucherId: string;
  code: string;
  title: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
  activityScope: ActivityScope;
  validUntil: string;
  hoursUntilExpiry: number;
  status: WalletVoucherStatus;
  assignedAt: string;
}

export interface VoucherWalletResponse {
  vouchers: WalletVoucher[];
}
