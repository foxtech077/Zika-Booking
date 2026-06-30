import { listingApi } from "../lib/listing-api";
import type {
  ApplicableVoucher,
  VoucherValidatePayload,
  VoucherValidateResult,
} from "../lib/types/voucher";

type SuccessEnvelope<T> = { success: true; data: T };

export async function getApplicableVouchers(
  totalAmount: number,
  currency?: string,
): Promise<ApplicableVoucher[]> {
  const params: Record<string, string> = { totalAmount: String(totalAmount) };
  if (currency) params.currency = currency;
  const res = await listingApi.get<SuccessEnvelope<{ vouchers: ApplicableVoucher[] }>>(
    "/vouchers/applicable",
    { params },
  );
  return res.data.data.vouchers;
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
