// Resolve the exact EUR (money-of-record) amount to charge / transfer for a
// booking whose price is denominated in the listing (base) currency.
//
// The conversion is performed on the platform side (listing-service) using the
// DB exchange-rate table with NO live-API fallback, so a stale/missing EUR rate
// surfaces as TEMPORARILY_UNAVAILABLE and schedules an immediate BullMQ re-sync
// rather than charging a wrong amount.
//
// A small +buffer is applied on top of the raw converted amount for customer
// charges to absorb exchange-rate fluctuation between quote and charge time.
// The buffer is NOT applied to provider payouts (they receive the market-rate
// conversion), so `applyBuffer` can be disabled for transfer paths.

import { EUR_CHARGE_BUFFER_MULTIPLIER } from "@zika/types";

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
  /** Buffer multiplier applied (1.015 for customer charges, 1 otherwise). */
  bufferApplied: number;
}

export async function resolveEurCharge(
  amount: number,
  currency: string,
  opts?: { applyBuffer?: boolean }
): Promise<EurChargeResult> {
  const applyBuffer = opts?.applyBuffer !== false;
  const bufferApplied = applyBuffer ? EUR_CHARGE_BUFFER_MULTIPLIER : 1;
  const from = (currency ?? "").toUpperCase();
  // No conversion needed when the booking is already in EUR — no FX risk, no buffer.
  if (from === "EUR") return { amountEur: Number(amount), rate: 1, bufferApplied: 1 };

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

    // raw = ceil(listing × rate); buffered = ceil(raw × (1 + buffer)).
    // This mirrors the booking snapshot so the charged amount matches the
    // amount the guest saw when booking.
    const amountEur = applyBuffer
      ? Math.ceil(Number(converted) * bufferApplied * 100) / 100
      : Number(converted);

    return { amountEur, rate: Number(rate ?? 1), bufferApplied };
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