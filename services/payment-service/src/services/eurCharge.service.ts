// Resolve the exact EUR (money-of-record) amount to charge / transfer for a
// booking whose price is denominated in the listing (base) currency.
//
// The conversion is performed on the platform side (listing-service) using the
// DB exchange-rate table with NO live-API fallback, so a stale/missing EUR rate
// surfaces as TEMPORARILY_UNAVAILABLE and schedules an immediate BullMQ re-sync
// rather than charging a wrong amount.

export class EurQuoteUnavailableError extends Error {
  code: string;
  constructor(message: string) {
    super(message);
    this.name = "EurQuoteUnavailableError";
    this.code = "TEMPORARILY_UNAVAILABLE";
  }
}

const LISTING_SERVICE_URL = process.env["BOOKING_SERVICE_URL"] ?? "http://localhost:3003";
const INTERNAL_SERVICE_KEY = process.env["INTERNAL_SERVICE_KEY"] ?? "";

export interface EurChargeResult {
  amountEur: number;
  rate: number;
}

export async function resolveEurCharge(
  amount: number,
  currency: string
): Promise<EurChargeResult> {
  const from = (currency ?? "").toUpperCase();
  if (from === "EUR") return { amountEur: Number(amount), rate: 1 };

  try {
    const res = await fetch(`${LISTING_SERVICE_URL}/internal/fx/eur-quote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
      },
      body: JSON.stringify({ amount: Number(amount), currency: from }),
      signal: AbortSignal.timeout(10_000),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      void triggerFxRefresh();
      throw new EurQuoteUnavailableError(
        "EUR conversion is temporarily unavailable. Please try again shortly."
      );
    }

    const converted = json?.data?.converted;
    const rate = json?.data?.rate;
    if (
      converted == null ||
      !Number.isFinite(Number(converted)) ||
      Number(converted) <= 0
    ) {
      void triggerFxRefresh();
      throw new EurQuoteUnavailableError(
        "EUR conversion is temporarily unavailable. Please try again shortly."
      );
    }

    return { amountEur: Number(converted), rate: Number(rate ?? 1) };
  } catch (err) {
    if (err instanceof EurQuoteUnavailableError) throw err;
    void triggerFxRefresh();
    throw new EurQuoteUnavailableError(
      "EUR conversion is temporarily unavailable. Please try again shortly."
    );
  }
}

async function triggerFxRefresh(): Promise<void> {
  try {
    await fetch(`${LISTING_SERVICE_URL}/internal/fx/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": INTERNAL_SERVICE_KEY,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* best effort */
  }
}