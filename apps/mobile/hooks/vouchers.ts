import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";
import { getApplicableVouchersFull } from "../services/voucher-service";
import type {
  ApplicableVoucher,
  ApplicableVouchersResponse,
  VoucherWalletResponse,
  WalletVoucher,
} from "../lib/types/voucher";

export const VOUCHER_QK = {
  wallet: ["vouchers", "wallet"] as const,
  applicable: ["vouchers", "applicable", "rewards"] as const,
};

// GET /vouchers/applicable requires a totalAmount, but the Rewards screen has no
// cart total to check against. A large reference amount is used purely so real
// minOrderValue thresholds don't spuriously mark otherwise-valid vouchers as
// non-applicable — it is never shown to the user or used to compute a real charge.
const REWARDS_REFERENCE_AMOUNT = 100_000;

export function useVoucherWallet() {
  return useQuery<VoucherWalletResponse>({
    queryKey: VOUCHER_QK.wallet,
    queryFn: async () => {
      const res = await listingApi.get<{ data: VoucherWalletResponse }>("/vouchers/wallet");
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

export function useApplicableVouchers() {
  return useQuery<ApplicableVouchersResponse>({
    queryKey: VOUCHER_QK.applicable,
    queryFn: () => getApplicableVouchersFull(REWARDS_REFERENCE_AMOUNT),
    staleTime: 60_000,
  });
}

export function isVoucherExpired(iso: string): boolean {
  return new Date(iso) < new Date();
}

// A wallet voucher is usable when the backend reports it as active AND it
// hasn't quietly passed its expiry date (defensive against stale status).
export function isVoucherActive(v: WalletVoucher): boolean {
  return v.status === "active" && !isVoucherExpired(v.validUntil);
}

// The /vouchers/applicable endpoint already applies tier, activity, usage-limit,
// min-order and date checks server-side and exposes the verdict as `applicable`.
export function isApplicableVoucherUsable(v: ApplicableVoucher): boolean {
  return v.applicable === true && !isVoucherExpired(v.validUntil);
}

// Estimates the saving a voucher yields using its own minimum order value (or a
// typical booking size if none is set) as the reference amount, since the wallet
// has no cart total to compute an exact discount against.
export function estimatedVoucherSavings(v: Pick<WalletVoucher, "discountType" | "discountValue" | "maxDiscount" | "minOrderValue">): number {
  const baseAmount = v.minOrderValue ?? 100;
  const raw = v.discountType === "percentage" ? (baseAmount * v.discountValue) / 100 : v.discountValue;
  return v.maxDiscount != null ? Math.min(raw, v.maxDiscount) : raw;
}

export function pickBestVoucher(vouchers: WalletVoucher[]): WalletVoucher | null {
  const active = vouchers.filter(isVoucherActive);
  if (active.length === 0) return null;
  return active.reduce((best, v) =>
    estimatedVoucherSavings(v) > estimatedVoucherSavings(best) ? v : best
  );
}

// Normalizes an ApplicableVoucher (from /vouchers/applicable) into the
// WalletVoucher shape so both sources can render through the same VoucherCard.
// Only ever called with already-filtered usable vouchers, so status is "active".
export function applicableToDisplayVoucher(v: ApplicableVoucher): WalletVoucher {
  return {
    voucherId: v.code,
    code: v.code,
    title: v.title ?? v.code,
    description: v.description ?? null,
    discountType: v.discountType,
    discountValue: v.discountValue,
    maxDiscount: v.maxDiscount,
    minOrderValue: v.minOrderValue,
    activityScope: v.activityScope ?? "universal",
    validUntil: v.validUntil,
    hoursUntilExpiry: v.hoursUntilExpiry ?? Math.max(0, (new Date(v.validUntil).getTime() - Date.now()) / 3_600_000),
    status: "active",
    assignedAt: new Date().toISOString(),
  };
}

// Combines /vouchers/applicable (Best Offer) with /vouchers/wallet (My Coupons)
// so the Rewards screen and the full voucher-wallet screen pick the same hero
// voucher and the same "other" list, regardless of which source actually has data.
export function useMergedVouchers() {
  const wallet     = useVoucherWallet();
  const applicable = useApplicableVouchers();

  const rawApplicable    = applicable.data?.vouchers ?? [];
  const usableApplicable = rawApplicable.filter(isApplicableVoucherUsable);
  const rawWallet        = wallet.data?.vouchers ?? [];
  const usableWallet     = rawWallet.filter(isVoucherActive);

  let bestVoucher: WalletVoucher | null = null;
  let heroSource = "none";

  if (applicable.data?.bestVoucher && isApplicableVoucherUsable(applicable.data.bestVoucher)) {
    bestVoucher = applicableToDisplayVoucher(applicable.data.bestVoucher);
    heroSource = "applicable.bestVoucher";
  } else if (usableApplicable.length > 0) {
    const top = usableApplicable.reduce((a, b) => (b.computedDiscount > a.computedDiscount ? b : a));
    bestVoucher = applicableToDisplayVoucher(top);
    heroSource = "applicable.vouchers (client-picked, bestVoucher was null)";
  } else if (usableWallet.length > 0) {
    bestVoucher = pickBestVoucher(usableWallet);
    heroSource = "wallet (applicable had nothing usable)";
  }

  const otherVouchers = usableWallet.length > 0
    ? usableWallet.filter((v) => v.code !== bestVoucher?.code)
    : usableApplicable.filter((v) => v.code !== bestVoucher?.code).map(applicableToDisplayVoucher);

  return {
    bestVoucher,
    otherVouchers,
    heroSource,
    rawApplicableCount: rawApplicable.length,
    usableApplicableCount: usableApplicable.length,
    rawWalletCount: rawWallet.length,
    usableWalletCount: usableWallet.length,
    isLoading: applicable.isLoading || wallet.isLoading,
    isFetching: applicable.isFetching || wallet.isFetching,
    isError: applicable.isError && wallet.isError, // only fatal if BOTH sources failed
    refetch: () => { void applicable.refetch(); void wallet.refetch(); },
  };
}
