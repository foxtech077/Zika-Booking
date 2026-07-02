import { listingApi } from "../lib/listing-api";
import type {
  ApplicableVoucher,
  ApplicableVouchersResponse,
  VoucherValidatePayload,
  VoucherValidateResult,
} from "../lib/types/voucher";

type SuccessEnvelope<T> = { success: true; data: T };

// Full /vouchers/applicable envelope (bannerState + bestVoucher + vouchers[]) —
// used by the Rewards screen, which needs the server-picked bestVoucher.
export async function getApplicableVouchersFull(
  totalAmount: number,
  currency?: string,
): Promise<ApplicableVouchersResponse> {
  const params: Record<string, string> = { totalAmount: String(totalAmount) };
  if (currency) params.currency = currency;
  const res = await listingApi.get<SuccessEnvelope<ApplicableVouchersResponse>>(
    "/vouchers/applicable",
    { params },
  );
  return res.data.data;
}

export async function getApplicableVouchers(
  totalAmount: number,
  currency?: string,
): Promise<ApplicableVoucher[]> {
  const data = await getApplicableVouchersFull(totalAmount, currency);
  return data.vouchers;
}

export async function validateVoucher(
  payload: VoucherValidatePayload,
): Promise<VoucherValidateResult> {
  const res = await listingApi.post<SuccessEnvelope<VoucherValidateResult>>(
    "/vouchers/validate",
    payload,
  );
  return res.data.data;
}
