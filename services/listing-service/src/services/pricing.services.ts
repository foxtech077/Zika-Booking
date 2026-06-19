// services/pricing.service.ts
import { convertCurrency } from "./ fx.services";

export async function getPricing(basePrice: number, baseCurrency: string, targetCurrency: string) {
  let displayPrice = basePrice;

  if (baseCurrency !== targetCurrency) {
    displayPrice = await convertCurrency(basePrice, baseCurrency, targetCurrency);
  }

  return {
    basePrice,
    baseCurrency,
    displayPrice: Math.round(displayPrice),
    currency: targetCurrency,
  };
}