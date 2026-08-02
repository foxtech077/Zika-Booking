// services/pricing.service.ts
import { getLocalizedContext } from "./exchangeRate.services";

export async function getPricing(basePrice: number, baseCurrency: string, targetCurrency: string) {
  const ctx = await getLocalizedContext(baseCurrency, targetCurrency);

  let displayPrice: number | null;
  if (ctx.currency === null) {
    // Conversion requested but unavailable — never show a wrong amount.
    displayPrice = null;
  } else if (ctx.rate !== null) {
    displayPrice = Math.round(basePrice * ctx.rate);
  } else {
    // Identity — same currency.
    displayPrice = basePrice;
  }

  return {
    basePrice,
    baseCurrency,
    displayPrice,
    currency: ctx.currency,
  };
}
