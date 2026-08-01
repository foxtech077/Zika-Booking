import { isTaraCountry } from "@zika/types";
import { parsePhoneNumber } from "libphonenumber-js";

const LISTING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

export class TaraNotAllowedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TaraNotAllowedError";
    this.code = code;
  }
}

/** Parse the ISO-3166-1 alpha-2 country of a phone number, or null. */
export function getTaraPhoneCountry(mobileNumber: string): string | null {
  try {
    const parsed = parsePhoneNumber(mobileNumber);
    return parsed?.country ?? null;
  } catch {
    return null;
  }
}

/**
 * Validate a Tara mobile-money payment and compute the XAF amount to charge.
 *
 * Rules (shared with the web/mobile apps):
 *  - The guest's phone country must be a Tara-supported country.
 *  - The listing's country must be a Tara-supported country.
 *  - The payment is always processed in XAF: when the listing currency is XAF
 *    the total is used as-is; otherwise the total is converted to XAF and
 *    ceiling-rounded to a whole XAF amount (Tara only accepts XAF).
 */
export async function computeTaraCharge(opts: {
  totalAmount: number;
  currency: string;
  listingCountry: string | null | undefined;
  phoneCountry: string | null;
}): Promise<{ amountXaf: number; phoneCountry: string }> {
  if (!opts.phoneCountry || !isTaraCountry(opts.phoneCountry)) {
    throw new TaraNotAllowedError(
      "UNSUPPORTED_COUNTRY",
      "Mobile money is only available for supported African countries. Please use card payment instead.",
    );
  }

  if (!opts.listingCountry || !isTaraCountry(opts.listingCountry)) {
    throw new TaraNotAllowedError(
      "UNSUPPORTED_COUNTRY",
      "Mobile money is not available for this listing's country. Please use card payment instead.",
    );
  }

  const currency = (opts.currency ?? "").toUpperCase();
  let amountXaf: number;

  if (currency === "XAF") {
    // XAF is a 0-decimal currency — Tara expects a whole amount.
    amountXaf = Math.ceil(opts.totalAmount);
  } else {
    const res = await fetch(`${LISTING_SERVICE_URL}/internal/fx/convert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify({ amount: opts.totalAmount, from: currency, to: "XAF" }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: { converted?: number } };
    if (!res.ok || !json.success || json.data?.converted == null) {
      throw new TaraNotAllowedError(
        "FX_UNAVAILABLE",
        "Could not convert your booking total to XAF right now. Please use card payment instead.",
      );
    }
    amountXaf = Number(json.data.converted);
  }

  if (!Number.isFinite(amountXaf) || amountXaf <= 0) {
    throw new TaraNotAllowedError("INVALID_AMOUNT", "The converted payment amount is invalid.");
  }

  return { amountXaf, phoneCountry: opts.phoneCountry };
}
