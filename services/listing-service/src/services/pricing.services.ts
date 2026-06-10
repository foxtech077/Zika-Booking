// services/pricing.service.ts
import { convertCurrency } from "./ fx.services";

export async function getPricing(req: any, basePriceUSD: number) {
  const country = req.location?.country || "IN";

  let currency = "USD";
  let price = basePriceUSD;

  if (country === "IN") {
    currency = "INR";
    price = await convertCurrency(basePriceUSD, "USD", "INR");
  }

  if (country === "NG") {
    currency = "NGN";
    price = await convertCurrency(basePriceUSD, "USD", "NGN");
  }

  return {
    basePriceUSD,
    displayPrice: Math.round(price),
    currency,
    country,
  };
}