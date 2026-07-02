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
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  computedDiscount: number;
  validUntil: string;
  applicable: boolean;
  reason: string | null;
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

export interface WalletVoucher {
  code: string;
  title: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
  activity: ActivityScope;
  validFrom: string;
  validUntil: string;
  usedAt?: string | null;
  isUsed: boolean;
}

export interface VoucherWalletResponse {
  vouchers: WalletVoucher[];
  total: number;
}
